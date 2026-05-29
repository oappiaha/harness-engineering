# 03 — The Seven Decisions

Builds on `01-vocabulary.md` and `02-the-loop.md`. Akshay's *Anatomy of an Agent Harness* closes with a diagram of seven design choices — the canonical taxonomy of the harness design space.

The diagram's footer reads: **"No universal right answer. Only trade-offs."** That's the whole spirit.

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
   multi       Plan-and-Execute    compaction /     inferential
                                   rich context
       ▼            ▼                     ▼              ▼
  5. Permissions   6. Tool scoping   7. Harness thickness
       │                │                  │
   permissive /     full toolkit /    thin / thick
   restrictive      minimal per step
```

---

## Decision 1 — Agent Count: Single vs Multi-Agent

How many agents drive your system?

- **Single** — one loop, one history, one cost line. Simpler to reason about. Cheaper.
- **Multi** — multiple agents. Isolation (one agent's context doesn't pollute another's), specialization (planner ≠ evaluator), parallelism (fan-out finishes faster than sequential).

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

**Hard data:** Anthropic's playable-vs-unresponsive game case (same Opus 4.5):
- Single agent → 20 min, $9, unresponsive game.
- Three agents (planner/generator/evaluator) → 6 h, **$200**, playable.

**22× the cost.** Dividing line between demo and ship.

**Choose by:** task length, distinct phases, evaluation needs.

---

## Decision 2 — Reasoning Strategy: ReAct vs Plan-and-Execute

How does the agent decide what to do next?

- **ReAct** — Think-Act-Observe every turn. Flexible — can pivot mid-task. Pays a "deliberation" cost every turn.
- **Plan-and-Execute** — Decompose into a plan once, then run the steps. **3.6× faster** (per LLMCompiler paper benchmarks) — but less adaptive (plan errors discovered late).

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

**Honest middle ground:** **R.P.I.** (Alex Ker) = Plan-and-Execute with a human gate. ReAct-style **research**, explicit **plan** (human reviews), then **execute** the plan. Speed on execution, adaptivity on discovery.

**Choose by:** novelty of task, cost sensitivity, whether the path is predictable.

---

## Decision 3 — Context Strategy: Aggressive Compaction vs Rich Context

How much history flows through every turn?

- **Aggressive compaction** — summarize early. Saves tokens. Model thinks faster on smaller windows. Loses nuance.
- **Rich context** — keep everything you have room for. Optimizes for recall. Costs more. Prone to context rot.

```python
# Aggressive
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

**Non-obvious:** rich context isn't always better. Stanford's "Lost in the Middle" + Chroma's "Context Rot" studies show all 18 tested frontier models (GPT-4.1, Claude Opus 4, Gemini 2.5, etc.) degrade as input length grows. Anthropic's goal: *the smallest set of high-signal tokens that maximizes likelihood of the desired outcome.*

**Choose by:** cost sensitivity, how much nuance matters, session length.

---

## Decision 4 — Verification: Computational vs Inferential

How does the agent know it's done?

- **Computational** — Tests, linters, type checkers. **Deterministic.** Same input → same verdict. Only works for tasks with executable specs.
- **Inferential** — LLM-as-judge. **Semantic.** Covers open-ended outputs (writing, design, taste). Noisier; biased if not careful.

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
- Use inferential *only when you have to.* **Always with a rubric and a separate evaluator agent** (self-evaluation bias is real).

Most production agents do both. Computational catches "is it broken?" Inferential catches "is it good?"

---

## Decision 5 — Permissions: Permissive vs Restrictive

Neither pole is the right answer in practice. **Production harnesses converge on a three-stage gate with risk tiers:**

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

**"Permissive on the cheap, restrictive on the expensive."** Confirmation fatigue is real — gate on `grep` and users reflexively click "yes." Tiered gating reserves friction for actions that deserve it.

---

## Decision 6 — Tool Scoping: Full Toolkit vs Minimal Per Step

How many tools does the model see at once?

- **Full toolkit always** — Maximum flexibility. Every tool's schema burns tokens *every turn*.
- **Minimal per step** — Progressive disclosure (skills, MCP search). Better performance — model isn't disambiguating among 50 vaguely-similar tools.

**Hard data:**
- **Vercel removed 80% of their agent's tools** — success **80% → 100%**, **3.5× faster** (274.8s → 77.4s), **37% fewer tokens** (~102k → ~61k), **42% fewer steps** (~12 → ~7). 16 tools → effectively 1 (bash). ([Vercel blog](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools))
- **Anthropic Tool Search:** ~85% context reduction (~77K → ~8.7K tokens) + accuracy gains (Opus 4 49→74%, Opus 4.5 79.5→88.1%). ([Anthropic engineering](https://www.anthropic.com/engineering/advanced-tool-use))

**Why** — every tool name + description is in the prompt; attention dilutes; the model picks wrong or hallucinates a tool that doesn't exist.

---

## Decision 7 — Harness Thickness: Thin vs Thick

How much logic lives in code vs in the model?

- **Thin** — "Trust the model." Dumb loop; model decides. Co-evolves with model improvement; scaffolding *comes down* over time.
- **Thick** — "Encode control in code." Explicit graph nodes, conditional routing, retry rules. Auditable. Compensates for model gaps. Becomes legacy as the model catches up.

```python
# Thin — model decides everything
async for event in query(prompt="Fix the bug", options=options):
    pass  # Claude SDK handles loop, tools, state — you just hand it a goal

# Thick — explicit state machine, harness routes
graph = StateGraph(State)
graph.add_node("plan", plan_node)
graph.add_node("execute", execute_node)
graph.add_node("verify", verify_node)
graph.add_node("replan", replan_node)
graph.add_conditional_edges("verify", lambda s: "done" if s.passed else "replan")
```

**Future-proofing test (Akshay):**

> *"If performance scales up with more powerful models *without adding harness complexity*, the design is sound."*

If a stronger model means rewriting half your graph, your harness is on the wrong side of the spectrum.

**Choose by:** is the model co-trained on your domain? Re-evaluate every model release.

---

## The footer matters

> *"No universal right answer. Only trade-offs."*

Every recommendation in this folder is a **lean, not a law.** The seven decisions form a 7-dimensional design space and your project's coordinate depends on:

- Who the user is
- How risky the worst action is
- Whether the model is co-trained on your domain
- Whether you're single- or multi-user
- How long tasks run
- How much money you have

Two agents can both be "well-designed" and sit on opposite sides of every decision because they're solving different problems. **Claude Code and Mendral are both production-grade. They just answered the seven differently.**

---

## What's next

`04-shopping-deep-dive.md` walks one specific blueprint end-to-end — a worked example that shows how every one of these seven decisions changes when the domain changes.
