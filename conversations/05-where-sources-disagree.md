# 05 — Where Sources Disagree

Builds on `01–04`. The framing note that changed how I read all five sources:

> **Most "disagreements" between harness sources are actually scope mismatches in disguise.**

Two authors saying contradictory-sounding things often turn out to agree once you specify *which kind of project you're building.* Real disagreements are rare. There are three big ones, two of which are scope mismatches and one of which is a genuine, ongoing argument.

---

## Debate 1 — Thin vs Thick (the real one)

This is the closest thing to an actual disagreement in the field.

**Thin camp** — Claude Agent SDK, Addy Osmani, Manus's rebuild history. *"Trust the model. The harness is scaffolding; scaffolding comes down."*

**Thick camp** — LangGraph design, parts of walkinglabs's prescriptive approach. *"Encode the logic in code. Auditable, deterministic, doesn't drift with model releases."*

Each camp has receipts:

| Thin's evidence | Thick's evidence |
|---|---|
| Manus rebuilt 5× in 6 months, **each rewrite removed scaffolding** | LangGraph powers production workflows where audit trails are mandatory; "the model decided" isn't acceptable to a regulator |
| Claude Opus performs **better in Claude Code** than in custom thick harnesses (co-training advantage) | Domains the model wasn't trained on (fashion judgment, regulated workflows) need encoded logic until model coverage catches up |
| Akshay's future-proofing test: *"performance scales with model improvement without harness changes"* — thin passes, thick often fails | A graph with explicit transitions catches bugs the model would happily silently introduce |

```python
# Thin — Claude SDK style
async for event in query(prompt="Fix the bug", options=options):
    pass  # the SDK handles loop, tools, state — you just hand it a goal

# Thick — LangGraph style
graph = StateGraph(State)
graph.add_node("triage", classify_bug_type)
graph.add_node("repro", reproduce_bug)
graph.add_node("fix", attempt_fix)
graph.add_node("verify", run_tests)
graph.add_node("escalate", file_issue_for_human)
graph.add_conditional_edges(
    "verify",
    lambda s: "done" if s.passes else
              "escalate" if s.attempts >= 3 else
              "fix"
)
```

**Why this is a real disagreement (not a scope mismatch):** even for the *same* domain (say, coding), the two camps would build genuinely different harnesses.

**What I believe:**
- **For coding agents, the thin camp is right** as of mid-2026 — co-training advantage is decisive; the bar has moved left every release.
- **For novel domains (fashion, regulated), the thick camp is right** until a frontier model has been trained on enough domain primitives to make the scaffolding redundant.
- **The future-proofing test is the operational tiebreaker.** If you can articulate "a stronger model would make this harness logic redundant in N months," start removing that logic now.

This is the one debate where you should **pick a side per project and defend it consciously.**

---

## Debate 2 — Inside vs Outside the Sandbox (scope mismatch)

This *looks* like a disagreement (Mendral wrote a whole article arguing one side; Claude Code does the opposite). It's actually **a scope mismatch about tenancy.**

```
   Claude Code (inside)           Mendral (outside)
   ───────────────                ─────────────────
   Single user                    Multi-user SaaS
   Local laptop                   Hosted infra
   Per-user dedicated container   Shared sandbox pool
   Filesystem is one place        Filesystem is a tenancy problem
   LLM key in your env            LLM keys can't go to user code
```

Each is correct for its tenancy:

- **Single-user local CLI** → inside-sandbox is *obviously right.* Mendral's three pillars would be massive overengineering.
- **Multi-user hosted SaaS** → outside-sandbox is *equally obviously right.* Sandboxes idle during LLM thinking is wasted compute; credentials must not live in shared sandboxes; FS state across thousands of users is a DB problem.

The "disagreement" disappears when you ask: *who runs the agent?*

```python
# Inside-sandbox (Claude Code pattern)
def main():
    history = load_local_history()
    while True:
        user_msg = input()
        response = run_harness(user_msg, history)
        # everything happens in this process; filesystem is local

# Outside-sandbox (Mendral pattern)
def handle_user_request(user_id, msg):
    job = jobs.create(user_id=user_id, msg=msg)
    inngest.send("agent.run", job_id=job.id)  # durable execution
    return job.id

@inngest.function
def agent_run(event):
    # this can survive deploys, instance crashes, hour-long waits
    sandbox = sandbox_pool.acquire(event.user_id)
    try:
        response = run_harness(
            event.msg,
            tools=tools_with_path_dispatch(sandbox, user_db),
        )
    finally:
        sandbox.release()  # back to standby — 25ms resume next time
```

**What I believe:** pick by tenancy.
- Local CLI → inside.
- Per-user dedicated infra → inside is fine.
- Shared multi-tenant hosted agent → outside, with Mendral's three pillars.

There's a hybrid: **outside-sandbox topology with per-user dedicated workers.** Useful for compliance-heavy single-user contexts (legal, healthcare) where credentials need to stay isolated even though tenancy is one-per-user.

---

## Debate 3 — Lean vs Many configs (scope mismatch about loading)

Alex Ker says *"keep `AGENTS.md` to ~60 lines, every token must fight for its place."* walkinglabs gives you `AGENTS.md` + `PROGRESS.md` + `DECISIONS.md` + `ARCHITECTURE.md` + `CONSTRAINTS.md` + multiple `docs/*.md` + module-local docs.

Surface contradiction. **Actually a scope mismatch about loading.**

```
   "AGENTS.md ≤ 60 lines"          AGENTS.md ≤ 60 lines
              and                            and
   "many .md files"               many other .md files
                                  loaded on demand
                                         ┃
                                         ▼
                         These are about different things.
```

Reconciliation:

| File | Loaded when | Size constraint |
|---|---|---|
| `AGENTS.md` / `CLAUDE.md` | **Always** — every turn, every session | Lean (50–80 lines) |
| `PROGRESS.md`, `DECISIONS.md` | Session start (clock-in) | Trimmed periodically |
| `docs/api-patterns.md` | Only when working on APIs | Up to ~150 lines |
| `skills/<name>/SKILL.md` | Only when the skill is invoked | Whatever's useful |
| Module-local `ARCHITECTURE.md` | Only when working in that module | Module-sized |

**Lean ≠ few.** Lean means the *always-loaded surface* is small. Progressive disclosure means the *available* surface can be huge. They're orthogonal.

```python
# What "AGENTS.md ≤ 60 lines" actually constrains
def assemble_prompt(system, tools, memory, history, user_msg):
    always_loaded = read("AGENTS.md")         # ← this is what gets the budget
    skills_index = skill_registry.names_and_descriptions()  # ~50 lines
    return [system, always_loaded, skills_index, tools, history, user_msg]

# When the model invokes a skill at runtime
def load_skill(name):
    full_body = read(f"skills/{name}/SKILL.md")  # could be 500 lines
    referenced = [read(p) for p in extract_refs(full_body)]
    return full_body, referenced
```

The heuristics I'd ratchet to:

- If a topic doc loads on >80% of sessions, promote its key constraints to `AGENTS.md`.
- If a topic doc loads <5% of the time, delete it.
- `AGENTS.md` lines that haven't been referenced in 90 days are candidates for removal.

> **Note on HumanLayer's "60 lines"** — this is *their internal practice*, not a published standard. From their own blog: *"general consensus is that < 300 lines is best, and shorter is even better. At HumanLayer, our root CLAUDE.md file is less than sixty lines."* Useful directional target, not a hard rule.

---

## Three smaller disagreements worth noting

### Automatic vs explicit subagent delegation

| Position | Who |
|---|---|
| **Automatic** — the agent decides when to spawn subagents | Claude Code, OpenCode |
| **Explicit** — only when explicitly invoked | Codex CLI |

**Resolution by task class:**
- Investigation / exploration → automatic is fine; cost cap caps abuse.
- Plan-and-implement at scale → explicit (R.P.I.); a human gate before subagents run is high-leverage insurance.

Not a real disagreement; both have their place.

### Self-evaluation

**Not a debate.** Every source either explicitly says "use a separate evaluator" or implicitly assumes it. The 22× cost ratio in Anthropic's playable-game case is the data point. **Self-evaluation bias is the closest thing to a settled question in this whole field.**

I flag it here because *new builders* often default to self-evaluation (it's cheaper, simpler, looks reasonable). They shouldn't.

### What's actually in "the seven decisions"

Akshay's seven aren't the only canonical seven. walkinglabs's 12 lectures could be read as twelve decisions. Addy Osmani lists components without numbering them. **This is fine.** Akshay's seven are useful because they're a *design space* — orthogonal axes you can sit on independently.

---

## What to actually believe

Putting cards on the table:

1. **Thin vs thick is the only debate where I have a strong directional view.** Thin for coding (high confidence). Thick for novel domains (high confidence). Re-evaluate every 6 months (high confidence).
2. **Inside vs outside is decided by tenancy.** No real opinion needed — there's a right answer per scenario.
3. **Lean vs many is a scope confusion.** Both rules are correct in their scope. Ratchet by usage data.
4. **Self-evaluation is settled.** Use a separate evaluator. Don't argue this one.
5. **Specific data points** (22×, 87.5%, 3.6×, 80%, 85%, 25ms) — all have primary sources I've verified, but the *magnitudes* may vary in your context. Use them as directional, not exact.

---

## What's next

This is the end of the walkthrough track. For what's still uncertain and where this folder might age badly, see `../uncertainties-and-futures.md`. For deep reference, see `../core/`. For domain applications, see `../blueprints/`.
