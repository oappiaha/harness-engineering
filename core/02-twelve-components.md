# 02 — The Twelve Components of a Production Harness

Synthesized across Anthropic (Claude Agent SDK), OpenAI (Agents SDK / Codex), LangChain/LangGraph, and the broader practitioner community. A production agent harness has twelve distinct components.

The order matters — earlier components are foundational, later components are the safety/scale ring on top.

```
                ╔══════════════════════════════════════════════╗
                ║          Safety & Scale (8 → 12)             ║
                ║   ┌────────────────────────────────────┐     ║
                ║   │       Capabilities (2 → 7)         │     ║
                ║   │   ┌──────────────────────────┐     │     ║
                ║   │   │   Runtime (1, parts of   │     │     ║
                ║   │   │    5, 6, 8)              │     │     ║
                ║   │   │      ┌─────────┐         │     │     ║
                ║   │   │      │   LLM   │         │     │     ║
                ║   │   │      │  weights│         │     │     ║
                ║   │   │      └─────────┘         │     │     ║
                ║   │   │  stateless model         │     │     ║
                ║   │   └──────────────────────────┘     │     ║
                ║   └────────────────────────────────────┘     ║
                ╚══════════════════════════════════════════════╝
```

---

## 1. Orchestration loop — the heartbeat

Implements the Thought‑Action‑Observation (TAO) cycle, a.k.a. ReAct loop:

```
assemble prompt → call LLM → parse output → execute any tool calls → feed results back → repeat until done
```

- Mechanically often **just a while loop**.
- The complexity lives in *what the loop manages*, not the loop itself.
- Anthropic's runtime is described as a "dumb loop where all intelligence lives in the model. The harness just manages turns."
- **Exit conditions are layered** (see `08-verification-and-termination.md`): no tool calls, max turns, token budget exhausted, guardrail tripwire, user interrupt, safety refusal.
- **"User interrupt" is not one primitive.** Pi (earendil‑works/pi) separates three live‑control operations: `steer(msg)` redirects the *current* run without killing it, `followUp(msg)` queues work to drain after the run goes idle, and `abort()` stops. Both queues are back‑pressured by a `QueueMode`. Collapsing these into a single stop‑condition under‑specifies the loop. *(Verified 2026‑05‑29: `packages/agent/src/agent.ts:264-270, 300`.)*

Implementations:
- **Claude Agent SDK:** `query()` returns an async iterator.
- **OpenAI Agents SDK:** `Runner` class with async / sync / streamed modes.
- **LangGraph:** explicit state graph with `llm_call` and `tool_node` connected by conditional edges.

---

## 2. Tools — the agent's hands

Tools are **schemas** (name, description, parameter types) injected into the LLM's context so the model knows what's available.

The tool layer handles:
1. **Registration** (declare to model)
2. **Schema validation** (sanity‑check arguments)
3. **Argument extraction** (parse from model output)
4. **Sandboxed execution** (run in controlled environment)
5. **Result capture**
6. **Formatting** (results back into LLM‑readable observations)

Claude Code provides tools across six categories: file ops, search, execution, web access, code intelligence, subagent spawning.

OpenAI's Agents SDK supports three tool types:
- **Function tools** (`@function_tool`)
- **Hosted tools** (`WebSearch`, `CodeInterpreter`, `FileSearch`)
- **MCP server tools**

Deep dive → `05-tools-and-skills.md`.

---

## 3. Memory — multiple timescales

| Timescale | Where it lives |
|---|---|
| **Short‑term** | Conversation history within a session |
| **Long‑term** | Anthropic `CLAUDE.md` (manual) + `MEMORY.md` (auto‑generated); LangGraph namespace‑organized JSON Store; OpenAI Sessions (SQLite or Redis) |

Claude Code implements a **three‑tier hierarchy**:
1. **Lightweight index** — ~150 chars per entry, always loaded.
2. **Detailed topic files** — pulled in on demand.
3. **Raw transcripts** — accessed via search only.

**Critical design principle:** the agent treats its own memory as a **hint** and *verifies against actual state* before acting.

Deep dive → `04-context-and-memory.md`.

---

## 4. Context management — where most agents fail silently

The core problem is **context rot**: model performance degrades 30%+ when key content falls in mid‑window positions (Chroma research, corroborated by Stanford's "Lost in the Middle"). Even million‑token windows suffer instruction‑following degradation as context grows.

Production strategies:

| Strategy | Mechanic | Source |
|---|---|---|
| **Compaction** | Summarize conversation history when nearing limit (Claude Code preserves architectural decisions and unresolved bugs while discarding redundant tool outputs) | Anthropic |
| **Observation masking** | Hide old tool outputs while keeping tool calls visible | JetBrains Junie |
| **Just‑in‑time retrieval** | Maintain lightweight identifiers, load data dynamically (Claude Code uses grep / glob / head / tail rather than reading full files) | Anthropic |
| **Sub‑agent delegation** | Each subagent explores extensively but returns 1,000–2,000 token condensed summaries | Multi‑source |

> The goal: *find the smallest possible set of high‑signal tokens that maximize likelihood of the desired outcome.* — Anthropic context engineering guide

Deep dive → `04-context-and-memory.md`.

---

## 5. Prompt construction — the priority stack

Assembles what the model actually sees at each step. Hierarchical:

1. **System prompt** (server‑controlled, highest priority)
2. **Tool definitions**
3. **Developer instructions**
4. **User instructions** (cascading `AGENTS.md` files; OpenAI Codex caps at 32 KiB)
5. **Conversation history**

Important positioning rule: **place high‑importance content at the beginning AND end** of the prompt — mid‑window is where signal gets lost.

---

## 6. Output parsing

Modern harnesses rely on **native tool calling**: the model returns structured `tool_calls` objects rather than free text that must be regex‑parsed.

- The harness checks: are there tool calls? Execute them and loop. No tool calls? Final answer.
- For **structured outputs**, both OpenAI and LangChain support schema‑constrained responses via Pydantic models.
- Legacy: `RetryWithErrorOutputParser` (feeds the original prompt + failed completion + parsing error back to the model) remains available for edge cases.

---

## 7. State management — the four bets

The four canonical strategies (LangGraph naming):

| Strategy | Mechanic |
|---|---|
| **Typed state graph** | LangGraph: typed dicts flow through nodes; reducers merge updates; checkpoint at super‑step boundaries → enables resume + time‑travel debugging |
| **Strategy choice** | OpenAI: pick one of four — application memory, SDK sessions, server‑side Conversations API, or lightweight `previous_response_id` chaining |
| **Filesystem + git** | Claude Code: git commits as checkpoints; progress files as structured scratchpads |
| **Message history only** | AutoGen / older systems: replay the conversation |
| **Branching session tree** | Pi: every entry carries a `parentId`; a movable leaf pointer makes the LLM context the *root‑to‑leaf path* (`getPathToRoot`), and `moveTo()` forks to any prior entry. Model / thinking‑level / active‑tool changes are tree nodes too, so a branch time‑travels *config* state, not just messages; compaction is itself a node. Tree‑structured resume **without git**. *(Verified 2026‑05‑29: `packages/agent/src/harness/session/session.ts:109-116, 246-265`.)* |

Deep dive → `07-state-and-persistence.md`.

---

## 8. Error handling — why this matters mathematically

A 10‑step process with **99% per‑step success has only ~90.4% end‑to‑end success.** Errors compound fast.

LangGraph distinguishes **four error types**:

| Type | Strategy |
|---|---|
| **Transient** | Retry with exponential backoff |
| **LLM‑recoverable** | Return error as `ToolMessage` so the model can adjust |
| **User‑fixable** | Interrupt for human input |
| **Unexpected** | Bubble up for debugging |

Anthropic catches failures within tool handlers and returns them as error results to keep the loop running. **Stripe's production harness caps retry attempts at two** — more than that suggests a structural problem, not a transient one.

---

## 9. Guardrails and safety

OpenAI's SDK implements **three levels**:
1. **Input guardrails** (run on first agent)
2. **Output guardrails** (run on final output)
3. **Tool guardrails** (run on every tool invocation)

A **tripwire** mechanism halts the agent immediately when triggered.

Anthropic separates permission enforcement from model reasoning architecturally:
- The **model decides what to attempt**.
- The **tool system decides what's allowed.**

Claude Code gates ~40 discrete tool capabilities independently across three stages:
1. **Trust establishment** at project load.
2. **Permission check** before each tool call.
3. **Explicit user confirmation** for high‑risk operations.

Deep dive → `09-error-handling-and-guardrails.md`.

---

## 10. Verification loops — toy demo vs production agent

This is the dividing line. Anthropic recommends three approaches:

| Approach | What it looks like |
|---|---|
| **Rules‑based feedback** | Tests, linters, type checkers, e2e suites |
| **Visual feedback** | Screenshots via Playwright for UI tasks |
| **LLM‑as‑judge** | A separate subagent evaluates output |

> Boris Cherny, creator of Claude Code: *"giving the model a way to verify its work improves quality by 2 to 3×."*

The walkinglabs course makes the same point harder: an Anthropic experiment compared a single agent (20 min, $9) producing an unresponsive game vs. a three‑agent harness — planner + generator + evaluator (6 hours, $200, same Opus 4.5) producing a playable one. 22× the cost, but the dividing line between "demo" and "ship."

Deep dive → `08-verification-and-termination.md`.

---

## 11. Subagent orchestration

Claude Code supports **three execution models**:

| Model | Mechanic |
|---|---|
| **Fork** | Byte‑identical copy of parent context |
| **Teammate** | Separate terminal pane with file‑based mailbox communication |
| **Worktree** | Own git worktree, isolated branch per agent |

OpenAI's SDK supports two patterns:
- **Agents‑as‑tools** — specialist handles a bounded subtask, returns to parent.
- **Handoffs** — specialist takes full control.

LangGraph implements subagents as **nested state graphs**.

Two universal patterns:

**Fan‑out (parallel investigation):**
```
        ┌────────────┐
        │ Main agent │
        └────┬───────┘
   ┌─────────┼─────────┐
   ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐
│Sub A │ │Sub B │ │Sub C │
└──┬───┘ └──┬───┘ └──┬───┘
   └────────┼────────┘
            ▼
     summaries only
```

**Pipeline (sequential depth):**
```
   ┌─────────────┐
   │ UX designer │ ← experience lens
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │ Architect   │ ← feasibility
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │ Devil's Adv │ ← finds gaps
   └──────┬──────┘
          ▼
   layered output
```

Deep dive → `06-subagents.md`.

---

## 12. Observability

The newest and most underrated component. Without it, **30–50% of session time is wasted on redundant diagnosis.**

Core artifacts (walkinglabs lecture 11):
- **Sprint Contract** — pre‑coding agreement on scope / verification / exclusions.
- **Evaluator Rubric** — A/B/C/D scoring table on multiple dimensions.
- **OpenTelemetry** traces — one trace per session, one span per task, sub‑spans per verification step.
- **Task Trace** — full decision‑path record (like distributed request tracing).

Deep dive → `10-observability.md`.

---

## Putting the twelve in priority order

If you're starting from zero, build them in this order:

| Phase | Components | Why this order |
|---|---|---|
| **MVP** | 1 (loop), 2 (tools), 6 (output parsing) | You can't have an agent without these |
| **Reliable demo** | 5 (prompt construction), 8 (error handling), 9 (guardrails) | First place demo agents collapse |
| **Production‑ready** | 4 (context), 7 (state), 10 (verification) | The "demo vs ship" dividing line |
| **Scale** | 3 (memory), 11 (subagents), 12 (observability) | Needed only once you have real users / long‑running tasks |

A common mistake: jumping to subagents (11) before verification (10). Subagents that aren't independently verified amplify hallucination.

---

## Component‑by‑framework matrix

|  | Claude Agent SDK | OpenAI Agents SDK | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|---|
| **Loop** | Dumb loop, smart model | Runner class | State graph | Sequential / Hierarchical | Conversation‑driven |
| **State** | Git commits + files | 4 strategies | Typed dicts + checkpoints | Task results | Message history |
| **Multi‑agent** | Fork / Teammate / Worktree | Agents‑as‑tools + Handoffs | Nested graphs | Agent‑Task‑Crew | 5 orchestration patterns |
| **Philosophy** | Thin harness, trust the model | Code‑first | Graph‑based control | Role‑based collaboration | Conversation as protocol |

**Same pattern, different bets on where control should live.** See `framework-comparison.md`.

> **Pi (earendil‑works)**, added to this picture 2026‑05‑29 by direct source inspection: Loop = dumb event‑driven loop + steer/follow‑up; State = **branching session tree**; Multi‑agent = via extensions (not core); Philosophy = *thin core, arbitrary‑code extensions*. It both **confirms** the convergence and contributes a 5th state pattern. Full notes: `../sources/source-notes.md` Source 6.
