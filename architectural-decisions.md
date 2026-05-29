# Architectural Decisions

Every harness architect faces a handful of fundamental choices. Each is a *bet*, not a "best practice." Akshay closes his framework with the seven below — and the diagram's footer is the spirit of the whole doc:

> *"No universal right answer. Only trade‑offs."*

This doc enumerates the bets, lays out the tradeoffs, and tells you which way to lean given a scenario.

---

## The seven decisions (Akshay / *Anatomy of an Agent Harness*)

```
                ┌──────────────────────────────┐
                │   Designing Your Harness     │
                └──────────────┬───────────────┘
       ┌────────────┬──────────┴──────────┬──────────────┐
       ▼            ▼                     ▼              ▼
  1. Agent     2. Reasoning         3. Context      4. Verification
     count        strategy             strategy
       │            │                     │              │
   single /    ReAct /             aggressive       computational /
   multi       Plan‑and‑Execute    compaction /     inferential
                                   rich context
       ▼            ▼                     ▼              ▼
  5. Permissions   6. Tool scoping   7. Harness thickness
       │                │                  │
   permissive /     full toolkit /    thin / thick
   restrictive      minimal per step
```

These seven form the design space. Production agents differ by where they sit on each axis, not by which axes they consider.

---

## Decision 1 — Agent Count: Single vs Multi‑Agent

How many agents drive your system?

| Position | Tradeoff |
|---|---|
| **Single** | Simpler, fewer LLM calls, one loop / one history / one cost line |
| **Multi** | Isolation (one agent's context doesn't pollute another's), specialization (planner ≠ evaluator), parallelism (fan‑out finishes faster than sequential) |

```python
# Single — one agent does everything
result = run_harness(user_msg)

# Multi — orchestrator coordinates specialists
plan = planner_agent.run(user_msg)
review_with_human(plan)
artifact = generator_agent.run(plan)
grade = evaluator_agent.run(artifact, rubric)
if grade in ("C", "D"):
    artifact = generator_agent.run(plan, feedback=grade.feedback)
```

**Hard data:** Anthropic's playable‑vs‑unresponsive‑game case (same Opus 4.5):
- Single agent → 20 min, $9, unresponsive game.
- Three agents (planner / generator / evaluator) → 6 h, **$200**, playable.

22× the cost. The dividing line between demo and ship.

**When to choose:**
- Single = short tasks, well‑scoped, intermediate context matters to main reasoning.
- Multi = long tasks with distinct phases (R.P.I.), independent investigation (fan‑out), evaluation that needs a different opinion (self‑evaluation bias is real).

---

## Decision 2 — Reasoning Strategy: ReAct vs Plan‑and‑Execute

How does the agent decide what to do next?

| Position | Tradeoff |
|---|---|
| **ReAct** | Think‑Act‑Observe every turn. Flexible — can pivot mid‑task. Pays a "deliberation" cost every turn. |
| **Plan‑and‑Execute** | Decompose into a plan once, then run the steps. **3.6× faster** (no per‑step deliberation), less adaptive (plan errors discovered late). |

```python
# ReAct — decision per turn
while not done:
    thought = llm.think(history)
    action = llm.choose_action(thought)
    observation = execute(action)
    history.append(thought, action, observation)

# Plan-and-Execute — decompose once, execute many
plan = llm.plan(user_msg)
review(plan)                              # optional human gate
for step in plan.steps:
    result = execute(step)
    if result.failed:
        plan = llm.replan(plan, result)   # re-plan only on failure
```

**Honest middle ground:** **R.P.I.** (Alex Ker) is Plan‑and‑Execute with a human gate — ReAct‑style **research**, explicit **plan** (human reviews), then **execute** the plan. Speed on execution, adaptivity on discovery.

**When to choose:**
- ReAct = novel tasks, exploratory work, environments where you can't predict the path.
- Plan‑and‑Execute = repeatable workflows, well‑understood domains, cost‑sensitive deployments.

---

## Decision 3 — Context Strategy: Aggressive Compaction vs Rich Context

How much history flows through every turn?

| Position | Tradeoff |
|---|---|
| **Aggressive compaction** | Summarize early. Saves tokens. Model thinks faster on smaller windows. Loses nuance. |
| **Rich context** | Keep everything you have room for. Optimizes for recall. Costs more. Prone to context rot. |

```python
# Aggressive — summarize early
if context.size(history) > 10_000:
    history = compactor.summarize(
        history,
        keep_full=["architectural_decisions", "unresolved_bugs"],
        drop=["redundant_tool_outputs"],
    )

# Rich — only compact when forced
if context.size(history) > MODEL_LIMIT * 0.9:
    history = compactor.summarize(history)
```

**Non‑obvious:** rich context isn't always better. Stanford's "Lost in the Middle" + Chroma's 30%+ degradation studies show more context can hurt quality if signal density drops. Anthropic's goal: *the smallest set of high‑signal tokens that maximizes likelihood of the desired outcome.*

**When to choose:**
- Aggressive = cost‑sensitive, long sessions, signal density > detail.
- Rich = short bursts, nuance‑critical (legal, medical), budget headroom.

---

## Decision 4 — Verification: Computational vs Inferential

How does the agent know it's done?

| Position | Tradeoff |
|---|---|
| **Computational** | Tests, linters, type checkers. **Deterministic.** Same input → same verdict. Only works for tasks with executable specs. |
| **Inferential** | LLM‑as‑judge. **Semantic.** Covers open‑ended outputs (writing, design, taste). Noisier; biased if not careful. |

```python
def verify_computational(artifact):
    return subprocess.run(["make", "check"]).returncode == 0

def verify_inferential(artifact, rubric):
    return judge_agent.run(
        prompt=f"Grade against rubric:\n{rubric}\nArtifact:\n{artifact}"
    )
```

**The rule:**
- Use computational *whenever possible.* Free of bias, repeatable, auditable.
- Use inferential *only when you have to* (open‑ended outputs). **Always with a rubric and a separate evaluator agent.**

Most production agents do both. Computational catches "is it broken?" Inferential catches "is it good?" `pre-stop` hook runs computational; evaluator subagent runs inferential.

---

## Decision 5 — Permissions: Permissive vs Restrictive

How tightly does the harness gate what the agent can do?

| Position | Tradeoff |
|---|---|
| **Permissive** | Fast, low friction, risky |
| **Restrictive** | Safe, high friction, slow |

Neither pole is the right answer in practice. **Production harnesses converge on a three‑stage gate with risk tiers:**

```python
RISK_TIERS = {
    "grep":             0,  # read-only       → auto
    "read_file":        0,  # read-only       → auto
    "edit_file":        1,  # local mutate    → allow w/ notice
    "bash":             2,  # local execute   → policy / trusted dir
    "git_push":         3,  # external effect → user confirm
    "deploy_prod":      3,  # external effect → user confirm + cooldown
    "drop_database":    4,  # irreversible    → typed confirm
}

def permission_check(call):
    tier = RISK_TIERS[call.name]
    if tier == 0: return ALLOW
    if tier == 1: return ALLOW_WITH_NOTICE
    if tier == 2: return ALLOW_IF_TRUSTED_PROJECT
    if tier == 3: return REQUIRE_USER_CONFIRM
    if tier == 4: return REQUIRE_TYPED_CONFIRM
```

This is "permissive on the cheap, restrictive on the expensive." Confirmation fatigue is real — gate on `grep` and users reflexively click "yes." Tiered gating reserves friction for actions that deserve it.

**When to choose:**
- Permissive = trusted environments, local dev, single user.
- Restrictive = production deploys, payments, shared infra, multi‑user.
- **Tiered = everything in between (i.e., almost everything real).**

---

## Decision 6 — Tool Scoping: Full Toolkit vs Minimal Per Step

How many tools does the model see at once?

| Position | Tradeoff |
|---|---|
| **Full toolkit always** | Maximum flexibility. Every tool's schema burns tokens *every turn*. |
| **Minimal per step** | Progressive disclosure (skills, MCP search). Better performance — model isn't disambiguating among 50 vaguely‑similar tools. |

```python
# Full toolkit
def assemble_tools_full():
    return tool_registry.all()  # 50 tool schemas every turn

# Minimal per step
def assemble_tools_scoped(task_signature):
    return tool_registry.search(task_signature, k=5)
```

**Hard data:**
- **Vercel cut 80% of their tools** — performance went **up**.
- Anthropic reports **~85% context reduction** from MCP search‑based loading.
- Addy Osmani's rule: *"10 focused tools outperform 50 overlapping ones."*

**Why** — every tool name + description is in the prompt; attention dilutes; the model picks wrong or hallucinates a tool that doesn't exist.

**When to choose:**
- Full toolkit = small set of tools (≤10), tightly scoped agent.
- Minimal per step = growing tool inventories, MCP integrations, skills systems.

---

## Decision 7 — Harness Thickness: Thin vs Thick

How much logic lives in code vs in the model?

| Position | Tradeoff |
|---|---|
| **Thin** | "Trust the model." Dumb loop; model decides. Co‑evolves with model improvement; scaffolding *comes down* over time. |
| **Thick** | "Encode control in code." Explicit graph nodes, conditional routing, retry rules. Auditable. Compensates for model gaps. Becomes legacy as the model catches up. |

```python
# Thin — model decides everything
for turn in loop:
    response = llm(history)
    if response.tool_calls:
        for call in response.tool_calls:
            history.append(execute(call))
    else:
        return response

# Thick — explicit state machine, harness routes
graph = StateGraph(State)
graph.add_node("plan", plan_node)
graph.add_node("execute", execute_node)
graph.add_node("verify", verify_node)
graph.add_node("replan", replan_node)
graph.add_conditional_edges("verify", lambda s: "done" if s.passed else "replan")
```

```
       Bet on model improvement            Bet on explicit control
   THIN ◀───────────────────────────────────────────────────▶ THICK
        │                │                │              │
   Claude            OpenAI           CrewAI         LangGraph
   Agent SDK         Agents SDK       Flows
```

**Future‑proofing test (Akshay):**

> *"If performance scales up with more powerful models *without adding harness complexity*, the design is sound."*

If a stronger model means rewriting half your graph, your harness is on the wrong side of the spectrum for that problem. **As models improve, the bar shifts left.**

**When to choose:**
- Thin = the model is co‑trained on your domain (coding is canonical).
- Thick = your domain is novel, regulated, or requires audit trails. **Re‑evaluate every model release.**

**Refinement — thickness can be *deferred*, not just chosen** *(field‑verified, Pi / earendil‑works, 2026‑05‑29)*. A thin core need not mean a thin *system*. Pi keeps a fixed 4‑tool loop but exposes one `ExtensionAPI` (`packages/coding-agent/src/core/extensions/types.ts:1086`) that lets arbitrary TypeScript mutate the model surface (`registerTool` / `setActiveTools`), the loop (~28 veto/mutate lifecycle hooks — `context`, `before_provider_request`, `tool_call`, `tool_result`…), the human harness (commands / shortcuts / flags / UI widgets), **and the provider backend itself** (`registerProvider`, hot‑reloadable). This is *harness‑as‑platform*: the thin↔thick choice moves from a build‑time architecture decision to a per‑extension, runtime one. It is also the documented mechanism by which Pi relocates the **non‑negotiables** (verification, permission gates) from core to userland — `docs/extensions.md` lists permission gates as example extensions. **The trade‑off:** deferring thickness to userland means the floor ships only if the adopter writes it — Pi has neither a `pre-stop` hook nor tiered permissions built in (verified absent). A pluggable thin core is only as safe as the extensions you actually install.

---

## The footer matters

> *"No universal right answer. Only trade‑offs."*

Every recommendation here is a **lean, not a law.** The seven decisions form a 7‑dimensional design space and your project's coordinate depends on:

- Who the user is
- How risky the worst action is
- Whether the model is co‑trained on your domain
- Whether you're single‑ or multi‑user
- How long tasks run
- How much money you have

Two agents can both be "well‑designed" and sit on opposite sides of every decision because they're solving different problems. Claude Code and Mendral are both production‑grade. They just answered the seven differently.

---

## Major architectural debates beyond the seven

The seven cover the *design space* — but three additional debates determine the *deployment model.*

### Beyond‑seven debate A — Inside vs Outside the Sandbox

(Andrea Luzzardi / Mendral — *The Agent Harness Belongs Outside the Sandbox*)

```
   INSIDE THE SANDBOX                   OUTSIDE THE SANDBOX
   ──────────────────                   ───────────────────
   Loop lives with target code          Loop lives on backend infra
   in the same container.               Tool execution dispatched via API
   Tool exec local. State on            to sandbox. Sandbox returns results.
   filesystem. Skills/memory in files.  Loop never enters sandbox.
                                        Credentials stay with loop.
   Example: Claude Code on laptop       Example: Mendral, hosted agent SaaS
```

| Strength | Inside | Outside |
|---|---|---|
| Simple model | ✓ | |
| Off‑the‑shelf harness reuse | ✓ | (incompatible) |
| Credential isolation | (LLM keys live next to user code) | ✓ |
| Sandbox suspends during LLM idle | | ✓ (25ms resume — Blaxel) |
| Multi‑user state | (distributed FS nightmare) | ✓ (DB problem) |
| Durable execution | (optional) | (mandatory) |

**Three pillars of "outside" (Mendral):**
1. **Durable execution** (Inngest) — each loop turn is a checkpointed step.
2. **Sandbox lifecycle** (Blaxel) — 25ms resume from standby; sandbox active only during exec.
3. **Filesystem virtualization** — path‑based dispatch: `/workspace/*` → sandbox RPC; `/skills/*` and `/memory/*` → Postgres. *"One tool surface, two backends, invisible to the agent."*

**When to choose:**
- Single user, local tool → **inside.**
- Single user, hosted but per‑user dedicated infra → **inside is fine.**
- Multi‑user SaaS, shared infra → **outside.**
- Compliance / SOC2 / regulated with hosted agents → **outside**, audit at loop layer.

---

### Beyond‑seven debate B — Single vs Multi‑User

Closely tied to inside/outside.

| Single user | Multi‑user |
|---|---|
| Filesystem is per‑user by default | Filesystem is a multi‑tenant problem |
| Credentials live with the process | Credentials must stay with the loop, not sandbox |
| State persistence = git + files | State persistence = DB + durable execution |
| Memory = local files | Memory = DB rows, namespaced |

The Mendral path‑based virtualization is the clean solution for multi‑user without rewriting the harness's tool API surface.

---

### Beyond‑seven debate C — One config vs many configs

Surface contradiction: Alex Ker (lean ~60‑line `AGENTS.md`) vs walkinglabs (many `.md` files — `PROGRESS`, `DECISIONS`, `ARCHITECTURE` per module, etc.).

**Resolved by scope:**

| Loaded when | File | Limits |
|---|---|---|
| **Always** | `AGENTS.md` / `CLAUDE.md` | 50–80 lines, every line ratchet‑traced |
| **At session start** | `PROGRESS.md`, `DECISIONS.md` | Trimmed periodically |
| **On demand** | `docs/api-patterns.md`, module `ARCHITECTURE.md`, etc. | 50–150 lines each |
| **Per skill use** | `skills/<name>/SKILL.md` | Loads only when matched |

Lean ≠ few. **Lean** means the *always‑loaded* file is small. The *progressively disclosed* surface can be many. Both rules are correct in their scope.

Heuristic: if a topic doc loads on >80% of sessions, promote its key constraints to `AGENTS.md`. If <5%, delete it.

---

## Side debates worth being aware of

### Subagents now or later?

- **Now:** task has clear phases (R.P.I.) or independent investigations (fan‑out).
- **Later:** verification loops aren't reliable yet — multiple agents amplify hallucination if not independently verified.

A failed deployment of subagents (no judges, shared context, no rubric) is *worse* than no subagents.

### Skills vs plain tool descriptions

- **Plain tools** for: single‑step ops, ops the model knows from training, things with no procedure.
- **Skills** for: multi‑step procedures, ops with referenced scripts/files, procedures the model wouldn't know.

Don't wrap a single bash call as a skill — that's pure overhead.

### Self‑evaluation

There isn't really a debate. All sources agree: same agent grading its own work biases positive. Use a separate evaluator agent (or different model) with an explicit rubric. The Anthropic $9 vs $200 case is the cost evidence.

---

## Decision tree (quick reference)

```
1. Single user or multi‑user?
   ├── Single → Inside sandbox (Claude Code pattern)
   └── Multi  → Outside; durable exec + sandbox lifecycle + path dispatch (Mendral)

2. Is the model co‑trained with a harness for your domain?
   ├── Yes (coding) → Thin harness (Claude SDK / OpenAI SDK)
   └── No (novel)   → Thicker harness (LangGraph / CrewAI) — re‑evaluate per model release

3. How long is a typical task?
   ├── Minutes, single window → Standard loop
   ├── Hours, single window   → Standard loop + verification
   └── Days, multi‑window     → Ralph Loop (init agent + worker agent) + filesystem continuity

4. Reasoning strategy?
   ├── Exploratory / novel → ReAct
   ├── Well‑understood    → Plan‑and‑Execute (3.6× faster)
   └── Hybrid             → R.P.I. (research → plan w/ human gate → execute)

5. Cross‑session continuity required?
   ├── No  → conversation history only
   └── Yes → PROGRESS.md + DECISIONS.md + features.json + clock‑in/out routines

6. Agent count?
   ├── No  → single agent, lean
   ├── Investigation breadth → Fan‑out + summary
   ├── Multi‑perspective depth → Pipeline (UX → architect → devil's advocate)
   └── Plan‑Generate‑Verify   → Planner / Generator / Evaluator (independent)

7. Tool scoping?
   ├── ≤10 tools, stable    → Full toolkit always
   └── Growing inventory    → Minimal per step (progressive disclosure)

8. Risk profile of tools?
   ├── Read‑only mostly   → Risk tier 0–1, auto‑allow
   ├── Mutating + local   → Risk tier 2, policy
   └── External effects   → Risk tier 3+, always confirm

9. Verification approach?
   ├── Executable spec     → Computational (`make check`)
   ├── Open‑ended output   → Inferential (judge + rubric, independent agent)
   └── Both                → Both (pre‑stop runs computational; subagent runs inferential)

10. Context strategy?
    ├── Cost‑sensitive       → Aggressive compaction
    ├── Nuance‑critical       → Rich context
    └── Default               → Aggressive past 70% window, preserve decisions + open bugs
```

---

## Cross‑references

- Sources making the case for each: `source-synthesis.md`
- Frameworks taking each position: `framework-comparison.md`
- Anti‑patterns of mis‑choosing: `anti-patterns.md`
- Domain‑specific recommendations: `blueprints/`
