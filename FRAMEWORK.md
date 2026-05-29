# FRAMEWORK — Building Harnesses

> The capstone doc. If you're a Claude Code session pointed at this folder to build an agent, **this is what you read first.** Other docs are depth; this is the playbook.

This doc is the synthesis of everything else in `harness-engineering/`. It's deliberately opinionated: when there's a choice, I tell you which way to lean *and why*, plus where to read more if you want to challenge it.

---

## At a glance — the 60‑second version

1. A **harness** is the software wrapping an LLM that turns it into an agent. The model is one line; the harness is everything else.
2. **Answer 5 pre‑flight questions in writing** before you write code.
3. Build in **5 phases** (skeleton → reliability → domain fit → production hardening → maintenance). Each phase has explicit gates.
4. Use **Akshay's 7 decisions** to lock your architectural bets.
5. Pick the closest **blueprint** (`blueprints/01–05`) and modify, don't start from scratch.
6. Wire the **non‑negotiables**: `pre-stop` hook, separate evaluator, tiered permissions, observability traces, ratchet log.
7. **Ratchet** — every failure becomes a permanent harness change.

If you're already familiar with harness engineering, skim the rest as a checklist. If you're new, read top to bottom — every section earns its place.

---

## Operator's guide for Claude Code sessions

**If you are a Claude Code (or similar agent) session reading this folder to build a harness, these instructions are addressed to you. Read them before doing anything else.**

### Ten rules you must follow

1. **Do NOT generate `AGENTS.md` (or `CLAUDE.md`) yourself.** Author it *with* the user, line by line. ETH research: LLM‑generated AGENTS.md produces ~3% performance drop, >20% inference cost increase, 2–4 extra reasoning steps. If the user insists you draft it, propose a *minimal* skeleton with TODO markers and explicitly tell them which lines they should write personally.

2. **Save Phase 0 pre‑flight answers in writing.** Create `docs/harness-design.md` (or copy `templates/harness-design.md`) and fill it in **before any code.** No mental answers. No "I'll write it later." If the user doesn't have answers, ask them.

3. **Use the `templates/` folder as starting points.** Don't invent file formats from scratch. Copy `templates/AGENTS.md`, `templates/Makefile`, `templates/pre-stop.sh`, etc. and adapt.

4. **Verify each phase gate using the self‑audit script** in this doc before moving to the next phase. Each phase has explicit pass/fail criteria. Run them. If a gate fails, fix the gap — don't proceed and don't claim the phase is done.

5. **Run a separate evaluator agent** for any open‑ended output. Use a different prompt, ideally a different model, and an explicit rubric. Self‑evaluation bias is real and well‑documented (Anthropic's $9 vs $200 case).

6. **Default architecture by tenancy:** single user / local = inside sandbox + filesystem state. Multi‑user / hosted = outside sandbox + durable execution + path‑based filesystem dispatch (Mendral pattern). When in doubt, ask the user about tenancy *before* writing infrastructure code.

7. **Wire the `pre-stop` hook FIRST** after the loop skeleton — *before* adding any tools. The hook runs the verification command and rejects termination if verification fails. Without it, premature‑victory failures slip through and you'll rebuild verification later.

8. **Treat memory as a hint, not ground truth.** Before acting on any remembered fact (file path, deploy command, last‑known state), verify it against actual state (run `ls`, `git status`, `grep`). Stale memory acted on confidently is a top failure mode.

9. **If asked to skip pre‑flight, push back.** *"Let's just start coding and figure it out as we go"* is the most expensive sentence in agent engineering. Politely insist on the 5 questions. If the user truly refuses, log the refusal in `DECISIONS.md` and proceed with explicit warnings.

10. **Log every correction in `DECISIONS.md` as it happens** (session‑scale ratchet). Even within one session: when the user corrects your approach or you discover a gap, write a `DECISIONS.md` entry *immediately*. Don't wait for Phase 5.

### Anti‑patterns specific to LLM operators

These are mistakes a Claude Code session is *especially* likely to make. Read them before starting:

| Anti‑pattern | Counter |
|---|---|
| Generating `AGENTS.md` yourself | Co‑author with the human; or hand them a TODO‑marked skeleton |
| Skipping the writing step on pre‑flight | Make the user dictate; transcribe into the worksheet |
| Picking a framework before pre‑flight is done | Pre‑flight outputs determine framework; resist the urge to commit early |
| Proceeding past Phase 1 without `pre-stop` hook | Wire the hook before any non‑trivial work |
| Self‑evaluating outputs | Spawn a separate evaluator agent with different prompt + rubric |
| Loading every available MCP tool | Be selective per project; use search‑based loading where supported |
| Treating tool errors as crashes | Return as `ToolMessage(is_error=True)` so the model can self‑correct |
| Adding rules to `AGENTS.md` "just in case" | Every rule must trace to a *specific* failure or external constraint |
| Building tools before risk‑tiering them | Tier first; the tier drives the tool's permission UX |
| Declaring done because no tool calls were emitted | Run the verification command; that's the actual signal |

### How to engage with the user

A Claude Code session building a harness with a user should follow this rhythm:

```
1. Read README.md → FRAMEWORK.md (this file)
2. Ask the user the 5 pre-flight questions (one at a time)
3. Write answers to docs/harness-design.md as you go
4. Once all 5 are answered, propose architectural choices (the 7 decisions)
5. Get user approval on the 7 decisions
6. Copy starter templates from templates/
7. Build Phase 1 → run Phase 1 self-audit → demo to user
8. Iterate through Phases 2–4 with user review at each gate
9. Hand off Phase 5 (maintenance) to the user with clear protocol
```

**Stop and surface the decision to the user at each gate.** Don't ride past a gate silently.

---

## Pre‑flight: 5 questions you MUST answer in writing first

Before any code. Open a file (`docs/harness-design.md` is a good name) and answer each. Each unanswered question blocks a downstream architecture decision.

### Q1. Who is the user, and what is the smallest thing the agent does that's valuable?

> Forces narrow MVP scope.
> *Blocks:* tool inventory, success metric, blueprint choice.

**Bad answer:** "Power users who want to automate their workflow."
**Good answer:** "A backend engineer at our company who wants to fix flaky tests in our auth service without context‑switching from the terminal."

### Q2. Is the work single‑session or multi‑session? Hours? Days? Weeks?

> Determines if you need durable execution and a Ralph Loop.
> *Blocks:* state files, framework choice, infrastructure.

**Critical thresholds:**
- Minutes / single window → standard loop is fine
- Hours / single window → standard loop + verification + cost cap
- Days / multi‑window → **Ralph Loop** mandatory; durable execution mandatory
- Weeks → Ralph Loop + observability that survives long horizons + periodic quality scoring

### Q3. Is the model co‑trained on this domain?

> Determines thin vs thick harness.
> *Blocks:* framework choice, where logic lives (model vs code).

**Calibration:**
- **Yes** (coding, web tasks, text summarization) → thin harness. Trust the model.
- **Mostly** (research, writing, analysis) → medium‑thin. Trust with verification.
- **Mostly no** (fashion judgment, vertical workflows, regulated processes) → thick harness. Encode the rules until model coverage catches up.
- **No** (proprietary domain knowledge) → thick harness + custom training data + frequent re‑evaluation.

> The future‑proofing test: *"If a stronger model would let you delete half this harness in 6 months, you're on the right side."*

### Q4. What's the risk tier of the most impactful action?

> Determines permission model and verification rigor.
> *Blocks:* permission UX, hook system, confirmation flows.

```
Tier 0 — Read only (grep, search, fetch)              → auto-allow
Tier 1 — Mutate local state (file edit, write memory) → notice
Tier 2 — Mutate user state (cart add, calendar event) → policy/confirm
Tier 3 — External effect (deploy, charge, send msg)   → ALWAYS confirm
Tier 4 — Irreversible (drop DB, mass send, big spend) → typed confirm + cooldown
```

The highest tier in your tool set drives the architecture. **One Tier‑3 tool makes the whole harness "outside‑the‑sandbox by default" territory** if you're multi‑user.

### Q5. Single user (local) or multi‑user (hosted)?

> Determines inside vs outside sandbox; the whole deployment model.
> *Blocks:* infrastructure, security model, state architecture.

| Tenancy | Architecture |
|---|---|
| Single user, local CLI | Inside sandbox. Filesystem state. Standard SDK. |
| Single user, hosted per‑user infra | Inside sandbox is fine. |
| Multi‑user, hosted, shared infra | **Outside sandbox.** Mendral's 3 pillars (durable exec, sandbox lifecycle, filesystem virtualization). |
| Compliance / regulated | Outside sandbox + audit at loop layer. |

**If you can't answer all 5, stop and clarify with the user before coding.** Wrong assumptions at this stage cost weeks later.

📖 *Depth:* `blueprints/06-build-your-own.md`, `architectural-decisions.md`.

---

## The 7 architectural decisions — your harness's coordinates

Once pre‑flight is done, lock these. For each, pick your lean *and* note the reason. You're sitting on a 7‑dimensional design space; here's your worksheet.

```
Designing Your Harness
├── 1. Agent count          — single / multi
├── 2. Reasoning strategy   — ReAct / Plan-and-Execute / R.P.I.
├── 3. Context strategy     — aggressive compaction / rich context
├── 4. Verification         — computational / inferential / both
├── 5. Permissions          — permissive / restrictive / tiered ← almost always tiered
├── 6. Tool scoping         — full toolkit / minimal per step
└── 7. Harness thickness    — thin / thick
```

### Quick‑decide matrix

| If your project is… | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| **Coding agent (local)** | Multi (planner/gen/eval) | R.P.I. | Aggressive | Computational + inferential judge | Tiered | Minimal per step (search) | Thin |
| **Deep research** | Multi (fan‑out) | R.P.I. | Rich (sources need recall) | Inferential w/ rubric + citation check | Tiered (mostly read) | Minimal per step | Medium‑thin |
| **Shopping** | Multi (judge before user) | Plan‑and‑Execute (well‑known flow) | Aggressive | Computational (idempotency, caps) + human gate | Tiered (Tier 3+ on purchase) | Minimal | Medium‑thick |
| **Fashion** | Multi (composer + judge) | Plan‑and‑Execute | Rich (taste needs context) | Inferential + visual + user pick | Tiered | Minimal | Thick (until model catches up) |
| **Multichannel PA** | Multi (channel + specialists) | ReAct (reactive to events) | Aggressive (per‑channel) | Inferential + user confirms send | Tiered + per‑capability consent | Minimal per step | Medium |
| **Novel domain** | Start single, add agents on evidence | R.P.I. | Aggressive | Both | Tiered | Minimal per step | Start thick, audit quarterly |

📖 *Depth:* `architectural-decisions.md`, `conversations/03-seven-decisions.md`.

---

## The 5 build phases

Build in this order. Each phase has a **gate** — you cannot move forward until the gate passes.

```
Phase 0  ─▶  Phase 1  ─▶  Phase 2  ─▶  Phase 3  ─▶  Phase 4  ─▶  Phase 5
Pre‑flight   Skeleton    Reliability   Domain fit   Production   Maintenance
                                                    hardening    (ongoing)
```

### Phase 0 — Pre‑flight (1–2 days)

**Goal:** answer the 5 questions, lock the 7 decisions, pick a blueprint, pick a framework.

**Outputs:**
- `docs/harness-design.md` (5 answers + 7 decisions + reasoning)
- A starting blueprint chosen from `blueprints/`
- A framework chosen (Claude Agent SDK / OpenAI / LangGraph / etc.)

**Gate:** can you state your project in one sentence and defend your top 3 architectural choices?

**Common mistakes:**
- Skipping the writing step ("I'll figure it out as I code")
- Picking a framework before pre‑flight (the framework should fall out of the answers, not the other way)
- Over‑scoping the MVP

📖 *Depth:* `blueprints/`, `framework-comparison.md`, `sdk-current-state.md`.

---

### Phase 1 — Skeleton (1 week)

**Goal:** the minimum viable harness — loop, tools, basic verification stub. End of this phase you have a working agent for *one* task end‑to‑end, with a `pre-stop` hook.

**Outputs (mandatory):**

```
project/
├── AGENTS.md / CLAUDE.md      # 50–80 lines; hard constraints; verification commands
├── PROGRESS.md                # initial state
├── DECISIONS.md               # the 7-decisions doc + first design log entries
├── Makefile / equivalent      # setup, dev, test, lint, check (all must work)
├── docs/harness-design.md     # Phase 0 outputs
├── .git                       # initial commit
└── .claude/ or .codex/        # harness config
    └── hooks/
        └── pre-stop           # runs `make check`, blocks broken termination
```

**Code skeleton (framework‑agnostic):**

```python
def run_harness(user_msg, options):
    history = [system_prompt, user_msg]

    for turn in range(options.max_turns):
        # 1. Assemble what the model sees
        prompt = assemble_prompt(
            system=options.system_prompt,
            tools=tool_registry.schemas(),
            memory=memory.tier1_index(options.user_id),
            history=compact_if_near_limit(history),
        )

        # 2. Call the model
        response = llm_api.call(prompt, options.model)
        cost_meter.record(response.usage)

        # 3. Classify output
        if not response.tool_calls:
            # 4. Verify before terminating — the production differentiator
            if not hooks.run("pre-stop", history, options):
                history.append(error_message(
                    "Verification failed. Run the verification command and fix."
                ))
                continue
            return response.text

        # 5. Execute tools
        for call in response.tool_calls:
            check = permissions.check(call, options.user)
            if not check.allowed:
                history.append(error_message(check.reason))
                continue
            try:
                with timeout(call.timeout_s), sandbox(call.policy):
                    result = tool_registry.execute(call)
                history.append(tool_message(result))
                hooks.run("post-tool-call", call, result, options)
            except ToolError as e:
                history.append(tool_message(f"ERROR: {e}", is_error=True))

    return "max-turns-exceeded"
```

**Gate:** one real task runs end‑to‑end. The `pre-stop` hook actually fires. `make check` exits 0 on success and the agent can't bypass it.

**Common mistakes:**
- Building tools before risk‑tiering them (you'll rewrite permission flow)
- LLM‑generating `AGENTS.md` (ETH study: ~3% perf drop + >20% cost; sources in `core/04-context-and-memory.md`)
- Loading every MCP tool at startup (use search‑based loading where the SDK supports it)
- Skipping the `pre-stop` hook ("we'll add it later") — never gets added, premature‑victory failures slip through

📖 *Depth:* `core/01-foundations.md`, `core/02-twelve-components.md`, `core/03-loop-in-motion.md`.

---

### Phase 2 — Reliability (1–2 weeks)

**Goal:** the harness survives error conditions. State persists across sessions. Permissions are tiered. Hooks enforce non‑negotiables.

**Outputs:**

| Capability | Concretely |
|---|---|
| **Tiered permissions** | Risk tier table + `permission_check()` function; Tier 3+ requires user confirm; Tier 4 typed confirm |
| **Error classification** | Four types (transient / LLM‑recoverable / user‑fixable / unexpected); retry caps; ToolMessage error packaging |
| **State persistence** | `PROGRESS.md` and `DECISIONS.md` updated by clock‑in / clock‑out routines; `features.json` if multi‑feature work |
| **Hooks beyond pre‑stop** | `pre-commit` (blocks debug code); `post-edit` (formatter + linter + type check); `pre-tool-call` (audit + policy) |
| **Compaction strategy** | Opinionated — preserves architectural decisions and open bugs; drops redundant tool outputs |
| **Cost meter** | Per‑session cost tagged by feature/task/model; surface to user during session |

**Code: tier matrix and pre-stop hook**

```python
# Risk tiers — decide once, apply everywhere
RISK_TIERS = {
    "read_file":  0, "grep":     0, "glob":   0, "web_fetch":   0,
    "edit_file":  1, "write_file": 1, "memory_write": 1,
    "bash":       2,
    "git_push":   3, "send_email": 3, "deploy": 3,
    "drop_table": 4, "force_push": 4,
}

# pre-stop hook — the single most important piece of wiring
async def pre_stop_hook(history, options):
    result = subprocess.run(["make", "check"], capture_output=True)
    if result.returncode == 0:
        return True  # allow termination
    history.append(error_message(
        f"ERROR: verification failed.\n"
        f"WHY: `make check` exited {result.returncode}\n"
        f"FIX: Address the failures below and re-run.\n\n"
        f"{result.stderr.decode()}"
    ))
    return False  # block termination, force continuation
```

**Gate:** the harness survives a 4‑hour multi‑feature run with no human intervention beyond tier‑3 confirmations. Session resumes cleanly after a kill -9.

**Common mistakes:**
- Single‑stage permission ("trust = on" at project load) → confirmation fatigue or risky calls slip
- Treating tool errors as crashes → loop dies on a transient blip the model could've worked around
- `PROGRESS.md` only updated at session end → mid‑session crash loses everything
- No timeout on tool calls → one stuck `bash` freezes the agent

📖 *Depth:* `core/07-state-and-persistence.md`, `core/08-verification-and-termination.md`, `core/09-error-handling-and-guardrails.md`.

---

### Phase 3 — Domain fit (1–3 weeks)

**Goal:** the harness fits the *specific* domain — subagents for the natural decomposition, observability for the things that go wrong, memory for the things that matter long‑term.

**Outputs:**

| Capability | Concretely |
|---|---|
| **Subagents wired** | The right topology for your domain (fan‑out / pipeline / planner‑gen‑eval / R.P.I.) |
| **Independent evaluator** | Separate agent (different prompt, ideally different model) with explicit rubric |
| **Memory tiers** | Index (always loaded) / topic (on demand) / raw (search only); memory is *hint*, agent verifies |
| **Domain‑specific tools** | The verbs the agent needs in *your* domain (catalog_search, wardrobe_query, citation_extract, etc.) |
| **Skills (if applicable)** | Multi‑step procedures with referenced scripts, loaded on demand |
| **Observability** | OpenTelemetry trace per session, span per task, sub‑span per verification step |
| **Sprint Contract template** | Pre‑task negotiated scope + verification + exclusions |

**Code: independent evaluator pattern**

```python
def planner_generator_evaluator(user_msg, max_attempts=3):
    plan = planner_agent.run(user_msg)
    # Optional human gate — see R.P.I.
    if needs_review(plan):
        plan = await_human_approval(plan)

    for attempt in range(max_attempts):
        artifact = generator_agent.run(plan)

        # CRITICAL: evaluator is a DIFFERENT agent
        grade = evaluator_agent.run(
            artifact=artifact,
            rubric=load_rubric(plan.task_type),
            # System prompt explicitly says "you are NOT the writer; grade fairly"
        )

        if grade.lowest in ("A", "B"):
            return artifact, grade

        plan = planner_agent.replan(plan, grade.feedback)

    raise EvaluationFailed(f"{max_attempts} attempts, lowest grade still {grade.lowest}")
```

**Gate:** the agent handles the domain's hardest realistic test case successfully, with the evaluator catching at least one bad output before it reaches the user.

**Common mistakes:**
- Self‑evaluation (same agent grades its own work — biases positive)
- Subagent without verification step (three subagents hallucinate in parallel; worse than one)
- Subagent inherits full parent context (defeats the purpose of context isolation)
- Memory treated as ground truth (verify before acting; memory is a hint)
- Skills wrapping single bash calls (pure overhead; only use for multi‑step procedures)

📖 *Depth:* `core/04-context-and-memory.md`, `core/05-tools-and-skills.md`, `core/06-subagents.md`, `core/10-observability.md`.

---

### Phase 4 — Production hardening (1–2 weeks)

**Goal:** the harness is safe to put in front of real users. Money, identity, irreversibility — all gated. Audit trail exists. Cost is bounded.

**Outputs:**

| Concern | Required |
|---|---|
| **Idempotency** | Every Tier 3+ tool has an idempotency key; safe to retry; never double‑side‑effects |
| **Cost caps** | Per‑session / per‑user / per‑day / per‑month; visible to user; alerts at threshold |
| **Spending caps** (if applicable) | Per‑purchase / per‑session / per‑day / per‑month; with typed‑confirm escalation |
| **Sandbox isolation** | Tool execution in container/chroot; outbound network allow‑list; timeouts; resource limits |
| **Credentials live with loop** (if multi‑user) | OAuth tokens, API keys, payment tokens never enter sandbox |
| **Audit log** | Every Tier 2+ tool call logged with timestamp, user, args, result; queryable by user |
| **Right to forget** (if memory) | Per‑user memory deletion that actually wipes; verified by audit |
| **Privacy posture** | Untrusted input from web/messages sanitized; agent never takes "instructions" from fetched data |
| **Failure surface** | When the agent can't proceed, it surfaces a clear `ERROR/WHY/FIX` message, not a crash |

**Code: idempotent execution of irreversible ops**

```python
def execute_irreversible(intent, idempotency_key):
    # 1. Already done?
    existing = ops_log.find(idempotency_key)
    if existing:
        return existing  # safe retry

    # 2. Reserve BEFORE side effects
    ops_log.reserve(idempotency_key, status="pending", intent=intent)

    # 3. Re-validate (drift, caps, freshness)
    if has_drifted(intent):
        ops_log.update(idempotency_key, status="aborted_drift")
        raise DriftError()
    if exceeds_caps(intent):
        ops_log.update(idempotency_key, status="aborted_cap")
        raise CapExceeded()

    # 4. Perform the side effect; downstream also dedupes via idempotency_key
    try:
        result = api_call(intent, idempotency_key=idempotency_key)
        ops_log.update(idempotency_key, status="completed", external_id=result.id)
        return result
    except APIError as e:
        ops_log.update(idempotency_key, status="failed", error=str(e))
        raise
```

**Gate (production readiness checklist):**

```
[ ] AGENTS.md ≤ 80 lines, human-written, every line ratchet-traceable
[ ] All tools have risk tiers + timeouts
[ ] pre-stop hook exists and runs the verification command
[ ] Independent evaluator wired for open-ended outputs
[ ] Per-session OpenTelemetry trace tagged with cost
[ ] PROGRESS.md and DECISIONS.md updated by the agent (verified by hook)
[ ] Permission model is 3-stage (trust / per-call / per-risky-op)
[ ] Memory is hint, not ground truth — agent verifies before acting
[ ] Sprint Contract template exists for non-trivial tasks
[ ] Idempotency keys on every Tier 3+ tool
[ ] Cost caps with alerts
[ ] Sandbox isolation with outbound allow-list
[ ] Credentials live with loop (if multi-user)
[ ] Audit log exists, user-queryable
[ ] Anti-patterns reviewed (../anti-patterns.md)
```

Every unchecked box is a known production failure waiting to happen.

📖 *Depth:* `core/09-error-handling-and-guardrails.md`, `core/10-observability.md`, `anti-patterns.md`, `blueprints/03-shopping-agent.md` (payment patterns).

---

### Phase 5 — Maintenance (ongoing — the ratchet protocol)

**Goal:** the harness gets better, not worse, over time.

The single most important habit:

> **Every failure becomes a permanent harness change. Every line in `AGENTS.md` traces to a specific past failure.**

This is the **ratchet pattern** (Addy Osmani). It's the difference between a harness that compounds your output and one that compounds your mistakes.

#### Session‑scale ratchet (applies during one build session, not just after launch)

The ratchet protocol works at three timescales:

| Timescale | Trigger | Action |
|---|---|---|
| **Session‑scale** (every correction during one work session) | The user corrects you, or you discover a gap mid‑build | Add a `DECISIONS.md` entry *immediately* (don't wait for a "review" milestone) |
| **Weekly** (during active development) | Trace review | Pick top 3 failure modes from last week; fix at the harness layer |
| **Quarterly** (in production) | Re‑audit | Re‑evaluate the 7 decisions; audit `AGENTS.md` line by line |

The session‑scale ratchet is what an LLM operator most often forgets. **If a user says "no, do X instead of Y," that's a `DECISIONS.md` entry, not just a course correction.** Log it as it happens. The decision is more durable than the conversation.

#### The ratchet loop

```
Failure in production
        │
        ▼
   Trace the failure to a harness layer
   (which component? which decision?)
        │
        ▼
   Fix at THAT layer
   (a rule in AGENTS.md? a hook? a tool description? a tier change?)
        │
        ▼
   Add a DECISIONS.md entry:
   - what changed
   - why (the failure)
   - rejected alternatives
        │
        ▼
   Re-test the failing case
        │
        ▼
   Periodic audit:
   - lines in AGENTS.md not referenced in 90 days → review for removal
   - topic docs loaded < 5% of sessions → delete
   - topic docs loaded > 80% of sessions → promote constraints to AGENTS.md
```

#### Weekly maintenance routine

```
Monday morning (or whenever you cut a release):
  1. Review last week's traces — top 3 failure modes
  2. Pick one — fix at the right harness layer
  3. Add to DECISIONS.md
  4. Quality Document: re-score modules A-C
     (verification, agent understandability, test stability, etc.)
  5. Update the Sprint Contract template if patterns are emerging
```

#### Quarterly maintenance

```
Every 3 months:
  1. Re-evaluate the 7 decisions — has anything shifted?
     - Did the model improve enough to thin the harness?
     - Did a new failure class emerge?
  2. Audit AGENTS.md line by line — each line still earning its place?
  3. Audit framework choice — newer SDK shipping what you bolted on?
  4. Update uncertainties-and-futures.md with field changes
```

**Gate:** there's never a "static" version of your harness — only the version after the most recent ratchet entry.

📖 *Depth:* `uncertainties-and-futures.md` (how the field is shifting), `anti-patterns.md` (failure mode catalog).

---

## Domain pattern picker

Recognize your domain → pick a blueprint → modify.

### Pattern 1 — Repo‑centric work, developer‑facing
**You're building:** anything that reads/writes code in a single repo, runs tests, commits.
**Blueprint:** `blueprints/01-coding-agent.md`
**Key bets:** thin, inside sandbox, computational verification, `pre-stop` hook, Claude Agent SDK is the strong default.

### Pattern 2 — Multi‑source synthesis with cited output
**You're building:** research, briefings, market analysis, anything where the answer must cite sources.
**Blueprint:** `blueprints/02-deep-research-agent.md`
**Key bets:** multi‑agent (fan‑out + judge), outside sandbox if multi‑user, citation_extract is the lynchpin tool, rich context until synthesizer step.

### Pattern 3 — Money + irreversibility + catalog browsing
**You're building:** shopping, procurement, payment automation, anything where mistakes cost real money.
**Blueprint:** `blueprints/03-shopping-agent.md`
**Key bets:** outside sandbox (always), tier 3+ permission on every purchase, idempotency keys, separate judge before user, durable execution for order tracking.

### Pattern 4 — Visual judgment + user‑owned inventory + composition
**You're building:** fashion, interior design, content composition (slide decks, video assembly), anything where the *look* matters and the inventory is yours.
**Blueprint:** `blueprints/04-fashion-agent.md`
**Key bets:** thick harness (model not co‑trained), visual feedback is first‑class verification, separate composer/judge, smoothed taste profile.

### Pattern 5 — Multi‑channel inbound + per‑user identity + automations
**You're building:** personal assistant, customer service agent, anything that follows the user across messaging surfaces.
**Blueprint:** `blueprints/05-multichannel-personal-assistant.md`
**Key bets:** medium harness, per‑channel context isolation, identity consolidation across channels, per‑capability consent, in‑channel confirmation UX.

### Pattern 6 — Doesn't match any of the above
**You're building:** something novel. Vertical workflow. Regulated. Compliance‑heavy.
**Blueprint:** `blueprints/06-build-your-own.md` — the recipe + worksheet.
**Key bets:** start thicker than you think; pick the closest blueprint above and modify; re‑evaluate every 3 months.

### Pattern composition

Real systems often combine patterns:

- **Fashion + shopping** — fashion blueprint identifies wardrobe gap, hands off to shopping blueprint for the purchase. Boundaries align with risk boundaries (money lives in shopping).
- **Research + multichannel** — research blueprint produces report, multichannel blueprint delivers via Slack. Each owns its surface.
- **Coding + research** — coding agent that researches APIs before using them. Coding owns implementation; research owns the API knowledge.

**Rule of thumb:** **a handoff is a blueprint boundary.** Don't fold a money operation into a non‑money blueprint.

---

## Component‑by‑component checklist (the 12, phased)

Every harness has 12 components. Build in this order:

| Component | Phase 1 (MVP) | Phase 2 (Reliable) | Phase 3 (Domain fit) | Phase 4 (Production) |
|---|---|---|---|---|
| **1. Loop** | While loop, max_turns cap | Token budget cap, cost cap | Ralph Loop if multi‑window | Durable execution if multi‑user |
| **2. Tools** | 3–5 core tools, schemas defined | Read/mutate concurrency, timeouts | Domain‑specific verbs | Idempotency keys on Tier 3+ |
| **3. Memory** | Conversation history | + index file (always loaded) | + topic files (on demand) | Per‑user memory with right‑to‑forget |
| **4. Context mgmt** | Basic compaction | + opinionated compaction (preserve architecture) | + JIT retrieval | + cache tuning |
| **5. Prompt construction** | System + user + tools | + memory + history | + skill index | + per‑user customization |
| **6. Output parsing** | Native tool calls | + structured outputs (Pydantic) | + handoff protocols | + multi‑agent message routing |
| **7. State management** | History in memory | + PROGRESS.md + DECISIONS.md | + features.json + Quality Doc | + durable resume |
| **8. Error handling** | Try/except, surface to user | + 4‑type classification, retry caps | + LLM‑recoverable packaging | + circuit breakers, alerts |
| **9. Guardrails** | Basic input check | + 3‑stage permissions, tier matrix | + tool‑level guardrails | + audit log, output redaction |
| **10. Verification** | `pre-stop` hook only | + L1 (static) | + L1+L2+L3 + evaluator | + Sprint Contract per task |
| **11. Subagents** | None | None | Fan‑out / pipeline / R.P.I. for domain | Magentic / nested patterns if needed |
| **12. Observability** | Print statements (temp) | + per‑call logs | + OpenTelemetry traces | + cost meter, evaluator rubric grading |

📖 *Depth:* `core/02-twelve-components.md`.

---

## Non‑negotiables (will not ship without)

These aren't trade‑offs. They're the floor.

| # | Non‑negotiable | Why |
|---|---|---|
| 1 | **`pre-stop` hook** that runs the verification command | The single highest‑leverage piece of wiring. Without it, premature‑victory failures slip through. |
| 2 | **Tiered permissions** with Tier 3+ on every irreversible action | Single‑stage permission either over‑prompts (fatigue) or under‑prompts (risk). |
| 3 | **Independent evaluator** for open‑ended outputs | Self‑evaluation bias is real. Anthropic case: $9 unresponsive vs $200 playable, same Opus. |
| 4 | **`AGENTS.md` ≤ 80 lines, human‑written** | ETH study: LLM‑generated AGENTS.md = ~3% perf drop + >20% cost. Human‑written outperforms. |
| 5 | **Memory is a hint** — verify against actual state | Stale memory acted on confidently is a top failure mode. |
| 6 | **Idempotency keys** on every Tier 3+ tool | Without them, retries become double‑charges / duplicate sends. |
| 7 | **Per‑session OpenTelemetry trace** tagged with cost | Without observability, 30–50% of debugging time is wasted on guessing. |
| 8 | **Ratchet log** (`DECISIONS.md`) | Every constraint traces to a failure. Without this, AGENTS.md rots into incoherence. |

📖 *Depth:* `anti-patterns.md`.

---

## Self‑audit scripts (verify each phase gate before proceeding)

Run these from the project root. Each script verifies that the named phase gate has actually passed. **Do not move to the next phase until the current phase's audit prints all `✓` lines.**

### Phase 1 — Skeleton self‑audit

```bash
#!/usr/bin/env bash
# Run from project root. Exits 1 on first failure.
set -e

echo "=== Phase 1 — Skeleton self-audit ==="

# 1. Design doc exists
test -f docs/harness-design.md && echo "✓ docs/harness-design.md exists" || { echo "✗ docs/harness-design.md missing — Phase 0 incomplete"; exit 1; }

# 2. AGENTS.md exists, is ≤80 lines, mentions verification command
test -f AGENTS.md && echo "✓ AGENTS.md exists" || { echo "✗ AGENTS.md missing"; exit 1; }
[ "$(wc -l < AGENTS.md)" -le 80 ] && echo "✓ AGENTS.md ≤80 lines" || echo "⚠ AGENTS.md exceeds 80 lines"
grep -qi "verification\|make check\|test\|verify" AGENTS.md && echo "✓ AGENTS.md mentions verification" || echo "⚠ AGENTS.md missing verification section"

# 3. PROGRESS.md and DECISIONS.md exist
test -f PROGRESS.md && echo "✓ PROGRESS.md exists" || { echo "✗ PROGRESS.md missing"; exit 1; }
test -f DECISIONS.md && echo "✓ DECISIONS.md exists" || { echo "✗ DECISIONS.md missing"; exit 1; }

# 4. Makefile exists with required targets
test -f Makefile && echo "✓ Makefile exists" || { echo "✗ Makefile missing"; exit 1; }
for tgt in setup test lint check dev; do
  grep -q "^${tgt}:" Makefile && echo "✓ Makefile has '$tgt' target" || echo "⚠ Makefile missing '$tgt' target"
done

# 5. pre-stop hook exists and is executable
HOOK=""
for p in .claude/hooks/pre-stop .codex/hooks/pre-stop .agent/hooks/pre-stop; do
  [ -x "$p" ] && HOOK="$p" && break
done
[ -n "$HOOK" ] && echo "✓ pre-stop hook found at $HOOK" || { echo "✗ no executable pre-stop hook"; exit 1; }

# 6. make check exits 0 (the verification command actually works)
if make check >/dev/null 2>&1; then
  echo "✓ make check exits 0"
else
  echo "✗ make check failed — fix before proceeding"; exit 1
fi

# 7. Initial git commit made
test -d .git && [ "$(git rev-list --count HEAD 2>/dev/null)" -ge 1 ] && echo "✓ initial git commit exists" || { echo "✗ no initial commit"; exit 1; }

# 8. The loop runs one task end-to-end (manual verification)
echo ""
echo "MANUAL CHECK: run your agent on one real task end-to-end. Does it succeed and exit cleanly?"
echo "If yes, Phase 1 gate is PASSED. Move to Phase 2."
```

### Phase 2 — Reliability self‑audit

```bash
#!/usr/bin/env bash
set -e
echo "=== Phase 2 — Reliability self-audit ==="

# 1. Risk tier matrix exists
grep -rqi "RISK_TIERS\|risk_tier\|permission_check" . --include="*.py" --include="*.ts" --include="*.js" 2>/dev/null && echo "✓ risk tier code found" || echo "⚠ no risk tier code detected"

# 2. Error classification implemented
grep -rqi "transient\|llm_recoverable\|user_fixable\|tool_error" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ error classification code found" || echo "⚠ no error classification detected"

# 3. PROGRESS.md updated since init
if [ "$(stat -f %m PROGRESS.md 2>/dev/null || stat -c %Y PROGRESS.md)" -gt "$(git log -1 --format=%ct -- PROGRESS.md)" ]; then
  echo "✓ PROGRESS.md updated mid-session"
else
  echo "⚠ PROGRESS.md not updated since last commit"
fi

# 4. features.json exists if multi-feature work
if [ -f features.json ]; then
  echo "✓ features.json exists"
  jq -e '.[] | .verification' features.json >/dev/null 2>&1 && echo "✓ features.json entries have verification commands" || echo "⚠ features missing verification commands"
fi

# 5. Additional hooks beyond pre-stop
HOOK_DIR=""
for d in .claude/hooks .codex/hooks .agent/hooks; do [ -d "$d" ] && HOOK_DIR="$d" && break; done
if [ -n "$HOOK_DIR" ]; then
  HOOK_COUNT=$(find "$HOOK_DIR" -type f -executable | wc -l)
  [ "$HOOK_COUNT" -ge 2 ] && echo "✓ $HOOK_COUNT hooks in $HOOK_DIR" || echo "⚠ only 1 hook (pre-stop); consider pre-commit, post-edit"
fi

# 6. Cost meter in place (search for telemetry)
grep -rqi "cost_meter\|usage_total\|token_count\|inference_cost" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ cost tracking code found" || echo "⚠ no cost tracking detected"

# 7. Compaction strategy implemented
grep -rqi "compact\|summariz\|observation_mask" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ compaction code found" || echo "⚠ no compaction detected"

echo ""
echo "MANUAL CHECK: run a 30+ minute multi-step task. Does it survive a forced restart (kill -9)?"
echo "If yes, Phase 2 gate is PASSED."
```

### Phase 3 — Domain fit self‑audit

```bash
#!/usr/bin/env bash
set -e
echo "=== Phase 3 — Domain fit self-audit ==="

# 1. Subagent topology decided and implemented
grep -rqi "subagent\|agent_definition\|@function_tool\|fan_out\|pipeline\|judge" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ subagent code found" || echo "⚠ no subagents detected (skip if single-agent design)"

# 2. Independent evaluator with rubric
grep -rqi "evaluator\|judge_agent\|rubric" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ evaluator code found" || echo "⚠ no separate evaluator detected"
test -f rubric.md -o -f docs/rubric.md && echo "✓ rubric documented" || echo "⚠ no explicit rubric document"

# 3. Memory tiers populated
[ -d memory ] || [ -d .claude/memory ] || grep -rqi "memory_tier\|memory_index" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ memory infrastructure found" || echo "⚠ no memory tiers detected"

# 4. Domain tools exist (project-specific — manual check)
echo "MANUAL: did you add domain-specific tools beyond the generic loop?"

# 5. OpenTelemetry traces flowing
grep -rqi "opentelemetry\|otel\|trace_id\|span" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ tracing instrumentation found" || echo "⚠ no tracing detected"

# 6. Sprint Contract template
test -f templates/sprint-contract.md -o -f docs/sprint-contract.md && echo "✓ Sprint Contract template exists" || echo "⚠ no Sprint Contract template"

echo ""
echo "MANUAL CHECK: run the domain's hardest realistic test. Did the evaluator catch at least one bad output before it reached the user?"
echo "If yes, Phase 3 gate is PASSED."
```

### Phase 4 — Production hardening self‑audit

```bash
#!/usr/bin/env bash
set -e
echo "=== Phase 4 — Production hardening self-audit ==="

# 1. Idempotency keys on tier 3+
grep -rqi "idempotency_key\|idempotent" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ idempotency code found" || echo "⚠ no idempotency keys (only required if Tier 3+ tools exist)"

# 2. Cost / spend caps
grep -rqi "SPEND_CAPS\|cost_cap\|spend_cap\|per_purchase\|per_session" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ caps code found" || echo "⚠ no caps detected"

# 3. Sandbox isolation
grep -rqi "sandbox\|chroot\|container\|allow_list" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ sandbox code found" || echo "⚠ no sandbox detected"

# 4. Audit log
[ -d logs ] || [ -d audit ] || grep -rqi "audit_log\|audit\.log" . --include="*.py" --include="*.ts" 2>/dev/null && echo "✓ audit logging found" || echo "⚠ no audit logging detected"

# 5. Anti-patterns reviewed (manual)
echo "MANUAL: have you read anti-patterns.md and confirmed none apply to your current build?"

echo ""
echo "When you can answer YES to all the above + the production readiness checklist in FRAMEWORK.md, Phase 4 gate is PASSED. You can launch."
```

**Usage pattern for a Claude Code session:**

```bash
# After completing each phase, run the audit
bash scripts/phase-1-audit.sh   # or paste the script inline
# Read the output. Fix any ✗ lines. Investigate ⚠ lines.
# Only proceed to the next phase when all ✗ are resolved.
```

📖 *Save these as `scripts/phase-N-audit.sh` in your project for repeated use.*

---

## Debugging when stuck — symptom → likely cause

Map common symptoms to the harness layer to investigate.

| Symptom | Likely cause | Doc |
|---|---|---|
| "Agent says done but tests fail" | No `pre-stop` hook (or hook not enforced) | `core/08-verification-and-termination.md` |
| "Agent forgets what we did last week" | Memory tier not loaded; clock‑in routine missing | `core/07-state-and-persistence.md` |
| "Agent loaded the entire 5K‑line file" | Tools encourage full reads; need grep/head/glob primitives | `core/05-tools-and-skills.md` |
| "Agent uses wrong tool" | Tool descriptions vague; too many overlapping tools | `core/05-tools-and-skills.md`, Vercel case |
| "Agent quality drops on long sessions" | Context rot mid‑window; need compaction; positioning at start+end | `core/04-context-and-memory.md` |
| "Agent contradicts past decisions" | DECISIONS.md not in clock‑in routine | `core/07-state-and-persistence.md` |
| "Multi‑agent results look hallucinated" | No independent evaluator; self‑evaluation bias | `core/06-subagents.md`, `core/08-verification-and-termination.md` |
| "Agent over‑prompts confirmations" | Single‑stage permission instead of tiered | `core/09-error-handling-and-guardrails.md` |
| "Agent crashed mid‑task, lost state" | No durable execution; PROGRESS.md not updated during session | `core/07-state-and-persistence.md` |
| "Cost is unexpectedly high" | Tools loaded at startup (use search); compaction missing; no cap | `core/04-context-and-memory.md`, `sdk-current-state.md` |
| "Different output on same input" | Inferential verification without rubric; no separate evaluator | `core/10-observability.md` |
| "Hallucinated tool calls" | Tools loaded but descriptions vague; too many tools | Vercel case in `core/05-tools-and-skills.md` |
| "Demo works, production doesn't" | Half‑loop — harness doesn't own all 7 steps; verification mocked | `core/03-loop-in-motion.md` |

---

## Doc map — when to read what

Use this when you hit a specific question. Each entry: *"when you need X, read Y."*

### Foundations
- *What is a harness?* → `core/01-foundations.md` or `conversations/01-vocabulary.md`
- *What's the loop?* → `core/03-loop-in-motion.md` or `conversations/02-the-loop.md`
- *All 12 components* → `core/02-twelve-components.md`

### Architecture decisions
- *Thin or thick? In or out of sandbox?* → `architectural-decisions.md`
- *Walk through with examples* → `conversations/03-seven-decisions.md`
- *Where sources disagree (and which agree)* → `source-synthesis.md`, `conversations/05-where-sources-disagree.md`

### Component depth
- *Context, memory, AGENTS.md* → `core/04-context-and-memory.md`
- *Tools, skills, MCP* → `core/05-tools-and-skills.md`
- *Subagents, R.P.I., fan‑out, pipeline* → `core/06-subagents.md`
- *State, PROGRESS.md, Ralph Loop* → `core/07-state-and-persistence.md`
- *Verification, pre‑stop, DoD* → `core/08-verification-and-termination.md`
- *Errors, permissions, sandboxes* → `core/09-error-handling-and-guardrails.md`
- *Sprint Contracts, traces, evaluators* → `core/10-observability.md`

### Domain blueprints
- *Pick the closest, modify, don't start from scratch* → `blueprints/`
- *Build something novel* → `blueprints/06-build-your-own.md`

### Tools and frameworks
- *Pick an SDK* → `framework-comparison.md`
- *Current state of each SDK with API examples* → `sdk-current-state.md`

### Failure modes
- *What goes wrong (catalog)* → `anti-patterns.md`

### Honesty
- *What's uncertain or might be wrong* → `uncertainties-and-futures.md`
- *Where each claim comes from* → `sources/source-notes.md`

### Walkthrough track (for learners)
- *Read top to bottom to learn the field* → `conversations/01–05`

---

## The harness builder's checklist

Print this. Keep it next to your editor.

### Before any code (Phase 0)
- [ ] 5 pre‑flight questions answered in writing
- [ ] 7 decisions locked with reasoning
- [ ] Closest blueprint picked
- [ ] Framework chosen
- [ ] One‑sentence value prop written

### Skeleton (Phase 1)
- [ ] AGENTS.md drafted (≤80 lines, human‑written)
- [ ] PROGRESS.md + DECISIONS.md initial
- [ ] Makefile with setup / test / lint / check / dev
- [ ] Loop works for one task end‑to‑end
- [ ] `pre-stop` hook fires and blocks broken terminations
- [ ] Initial git commit

### Reliability (Phase 2)
- [ ] Risk tier matrix defined
- [ ] 4‑type error classification implemented
- [ ] Clock‑in / clock‑out routines documented
- [ ] features.json (if multi‑feature work)
- [ ] Cost meter visible during session
- [ ] Opinionated compaction working

### Domain fit (Phase 3)
- [ ] Subagent topology matches domain
- [ ] Independent evaluator wired (different agent, different prompt)
- [ ] Memory tiers populated
- [ ] Domain tools in place
- [ ] OpenTelemetry traces flowing
- [ ] Sprint Contract template ready

### Production hardening (Phase 4)
- [ ] Idempotency keys on every Tier 3+ tool
- [ ] Spending / cost caps with alerts
- [ ] Sandbox isolation + outbound allow‑list
- [ ] Credentials with loop (if multi‑user)
- [ ] Audit log queryable
- [ ] Right‑to‑forget works (if applicable)
- [ ] Anti‑patterns reviewed and addressed

### Maintenance (Phase 5)
- [ ] Ratchet protocol: every failure → DECISIONS.md entry
- [ ] Weekly trace review
- [ ] Quarterly 7‑decision re‑audit
- [ ] Quality Document scored periodically
- [ ] AGENTS.md lines audited every 90 days

---

## One final principle

The footer of Akshay's seven‑decisions diagram:

> **"No universal right answer. Only trade‑offs."**

Every recommendation in this folder is a **lean, not a law.** Two production‑grade harnesses can sit on opposite sides of every decision because they're solving different problems. Read the docs to understand the territory; pick your coordinates per project.

The single best habit: **every constraint in your harness should trace to a specific failure or external rule.** When you can't remember why a rule exists, it's a candidate for removal. When something fails in a way no rule covers, that's a new ratchet entry waiting.

Now go build.
