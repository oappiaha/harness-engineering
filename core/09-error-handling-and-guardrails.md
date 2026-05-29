# 09 — Error Handling and Guardrails

Errors are not exceptional events — they are the **median case** at scale. A harness without explicit error handling and guardrails compounds failure and lets unsafe operations through.

---

## Part 1 — Why error handling is mandatory

A 10‑step process with 99% per‑step success has only **~90.4% end‑to‑end success.** Errors compound.

Two strategies to fight compounding:
1. **Verification loops** — catch + correct (see `08-verification-and-termination.md`).
2. **Error handling** — categorize + retry / surface / abort intelligently (this doc).

---

## Part 2 — Four error types (LangGraph taxonomy)

| Type | Definition | Strategy |
|---|---|---|
| **Transient** | Temporary failure (network blip, rate limit) | Retry with exponential backoff |
| **LLM‑recoverable** | Tool returned an error the model can read and adapt to (e.g., "file not found, did you mean X?") | Return error as `ToolMessage` so the model can adjust |
| **User‑fixable** | Requires human input (missing credential, ambiguous request) | Interrupt the loop, ask for human input |
| **Unexpected** | A programming bug in the harness, schema mismatch, etc. | Bubble up; do not silently swallow |

The wrong strategy for each type:
- Transient as unexpected → noisy on flaky networks.
- LLM‑recoverable as transient → endless retries that the model could have routed around.
- User‑fixable as LLM‑recoverable → model invents a credential rather than asking.
- Unexpected as LLM‑recoverable → the model is "told" about a harness bug it can't actually fix.

---

## Part 3 — Retry caps (Stripe pattern)

> **Stripe's production harness caps retry attempts at two.** More than that suggests a structural problem, not a transient one.

Recommended defaults:

| Operation | Max retries | Reason |
|---|---|---|
| Idempotent API call (GET, search) | 3 with backoff | Network flake recovery |
| Mutating API call | 1 with idempotency key | Avoid double‑charge / double‑post |
| Tool execution (file read, grep) | 2 | Filesystem races are rare; surface fast |
| LLM API call | 3 with backoff | Provider blips |
| LLM‑recoverable tool error | **0** | The model decides; don't auto‑retry |

Wire a circuit breaker if a class of operations is failing > 20% — surface it as user‑fixable rather than burning retries.

---

## Part 4 — Anthropic's error packaging pattern

> *"Anthropic catches failures within tool handlers and returns them as error results to keep the loop running."*

```python
def execute_tool(call):
    try:
        result = handlers[call.name](**call.args)
        return ToolMessage(content=result, tool_call_id=call.id)
    except ToolError as e:
        # LLM-recoverable
        return ToolMessage(content=f"ERROR: {e}", tool_call_id=call.id, is_error=True)
    except TransientError as e:
        # Retry policy at the harness layer
        raise
    except Exception as e:
        # Unexpected — bubble for debug, but don't crash the loop
        log.exception("Unexpected error in %s", call.name)
        return ToolMessage(content=f"ERROR: internal — {e}", tool_call_id=call.id, is_error=True)
```

Two key choices:
- **`is_error` flag** so the model knows it's seeing a failure, not normal output.
- **Loop survives unexpected errors** — they're surfaced to the model + logged, not crashed.

---

## Part 5 — Guardrails (OpenAI three‑level model)

```
   ┌─────────────────────────────────────────┐
   │  Input guardrails                       │
   │  (run on first agent, before any work)  │
   └────────────────────┬────────────────────┘
                        ▼
   ┌─────────────────────────────────────────┐
   │  Tool guardrails                        │
   │  (run on every tool invocation)         │
   └────────────────────┬────────────────────┘
                        ▼
   ┌─────────────────────────────────────────┐
   │  Output guardrails                      │
   │  (run on final output before return)    │
   └─────────────────────────────────────────┘
```

A **tripwire** mechanism halts the agent immediately when triggered. Examples:

- **Input:** prompt injection detection, PII redaction, jurisdiction check.
- **Tool:** spending cap, destructive‑command block, rate limit per user.
- **Output:** PII leak detection, factual claim verification, format check.

Triggers should be **policy decisions**, not model decisions. The model decides what to attempt; the guardrail decides what's allowed.

---

## Part 6 — Anthropic's permission separation pattern

> **The model decides what to attempt; the tool system decides what's allowed.**

This is an **architectural separation**, not a single check. Claude Code gates ~40 discrete tool capabilities independently across three stages:

| Stage | When | What |
|---|---|---|
| **Trust establishment** | Project load | "Do you trust this project / this codebase?" — single decision that gates whole tool classes |
| **Permission check** | Before each tool call | "Is this tool allowed in this mode?" — per‑tool policy |
| **Explicit user confirmation** | High‑risk operations | Modal: "Allow `rm -rf /tmp/*`?" — per‑invocation |

Three‑stage gates **prevent two failure modes** that single‑stage gates can't:
1. **Stage 1 alone** = blanket trust, escalation impossible.
2. **Stage 3 alone** = confirmation fatigue, users approve everything.

Stages 1 and 2 carry the policy; stage 3 only fires for the actually risky calls.

---

## Part 7 — Sandbox isolation

Execution should happen in a **sandboxed environment** with:

- **Filesystem isolation** (chroot / container / per‑user workspace).
- **Command allow‑lists** (no `sudo`, no arbitrary shell unless explicit).
- **Timeouts** (every tool call has one).
- **Network policy** (no outbound except allow‑listed).
- **Resource limits** (memory, CPU, disk).

The **inside vs outside the sandbox** debate (see `../architectural-decisions.md`) is about *where the loop lives* — but **sandbox execution** of tool calls is universal.

For multi‑user systems, the sandbox is also a **suspension boundary** (Mendral / Blaxel): the sandbox suspends when not actively executing, freeing resources during LLM thinking / waiting. 25ms resume from standby.

---

## Part 8 — Risk tiers for tool gating

A useful taxonomy when designing tool permissions:

| Tier | Examples | Default policy |
|---|---|---|
| **0 — Read** | grep, glob, head, web fetch | Allow without prompt |
| **1 — Local mutate** | file edit, file write within workspace | Allow with notification |
| **2 — Local execute** | bash within workspace, npm test | Allow with policy / autoresolve in trusted projects |
| **3 — External effect** | git push, deploy, send email, payment | **Always** require user confirmation |
| **4 — Irreversible** | rm -rf, force push, drop table | Require user confirmation + (in some harnesses) typed acknowledgment |

The harness should ship with these tiers defined. Custom tools register at a tier — that's how you scale permissions without writing a policy per tool.

---

## Part 9 — Real‑world guardrail wiring (Mendral pattern)

When the loop runs **outside the sandbox** (multi‑user SaaS):

```
   User credentials live with the LOOP, not the SANDBOX.
   ────────────────────────────────────────────────────
   - LLM API keys held by the loop (never in the sandbox)
   - User OAuth tokens held by the loop
   - DB access held by the loop
   - Sandbox sees only the narrowed RPC interface
```

The loop holds the **credentials**; the sandbox holds the **execution surface**. A compromised sandbox can't exfiltrate user tokens because it never had them. A compromised loop is bad — but the surface is smaller and easier to defend.

---

## Part 10 — Anti‑patterns

| Anti‑pattern | Why it fails |
|---|---|
| Single `try/except: pass` in tool execution | Hides every error class, loop limps along blindly |
| Same retry policy for every error type | LLM‑recoverable errors should never auto‑retry |
| Endless retry on rate limits | Burns cost; the right move is backoff *or* surface as user‑fixable |
| Permission check only at session start | Trust drift across long sessions; new tools get blanket grant |
| Per‑invocation confirmation on read‑only ops | Confirmation fatigue; users approve everything |
| No outbound network policy in sandbox | Exfiltration risk via prompt injection |
| No timeout on tool execution | One stuck tool hangs the loop |
| Letting the model see raw stack traces | Wastes context; format as actionable error |
| Skipping `is_error=true` on tool errors | Model can't distinguish failure from data |

---

## Part 11 — Wire diagram: error path

```
    LLM tool call
         │
         ▼
   ┌─────────────┐
   │ validation  │ ─── invalid args ──▶ return error to model
   └─────┬───────┘                       (LLM‑recoverable)
         ▼
   ┌─────────────┐
   │ permission  │ ─── denied ────────▶ return error or prompt user
   └─────┬───────┘                       (user‑fixable)
         ▼
   ┌─────────────┐
   │ timeout box │ ─── timeout ───────▶ return error to model
   └─────┬───────┘                       (LLM‑recoverable; possibly retry once)
         ▼
   ┌─────────────┐
   │  execute    │ ─── tool exception ─▶ classify by type
   └─────┬───────┘     • Transient    → harness retries (cap 2)
         │              • Recoverable  → ToolMessage(error)
         │              • User‑fixable → interrupt
         │              • Unexpected   → log + ToolMessage(error)
         ▼
   ┌─────────────┐
   │ post‑hook   │ ─── tripwire ──────▶ halt loop
   └─────┬───────┘
         ▼
     return result to LLM
```

---

## Part 12 — A 7‑item checklist for a new tool

For every new tool you add, decide:

1. **Risk tier** (0–4)
2. **Read‑only or mutating** (affects concurrency)
3. **Timeout** (default + max)
4. **Error categories** (what's transient, recoverable, user‑fixable, unexpected)
5. **Sandbox boundaries** (does this need network / external creds?)
6. **Audit logging** (does this need to be in the trace?)
7. **Tripwire conditions** (what response should halt the loop)

If you can't answer all seven, **don't ship the tool yet.**

---

## Cross‑references

- The loop that runs these checks: `03-loop-in-motion.md`
- Tools and their categories: `05-tools-and-skills.md`
- Verification (the other half of reliability): `08-verification-and-termination.md`
- Inside vs outside the sandbox: `../architectural-decisions.md`
- Observability for incidents: `10-observability.md`
