# 06 — Subagents

A subagent is a delegated, isolated unit of work. Use one **when a summary of the work is sufficient** for the main agent. If the main agent needs the intermediate steps to reason later, keep the work inline.

---

## Part 1 — The core heuristic

> **Use a subagent when the intermediate context is noise; keep the work inline when the intermediate context will be referenced later.**

The simplest decision rule (Alex Ker):

| Question | Subagent? |
|---|---|
| Will the main agent later ask "how does this connect to what I looked at earlier"? | No — keep inline |
| Is this a series of tool executions where only the end result matters? | Yes — delegate |
| Would the main agent reading the intermediate steps pollute its window? | Yes — delegate |
| Is the intermediate state a design decision the main agent owns? | No — keep inline |

Subagents keep the main conversation clean while keeping the subagent **in the "smart zone"** — its window is shorter, its context is purer.

---

## Part 2 — Three execution models (Claude Code)

| Model | Mechanic | Use when |
|---|---|---|
| **Fork** | Byte‑identical copy of the parent context | Subagent needs to inherit everything; quick spawn |
| **Teammate** | Separate terminal pane with file‑based mailbox communication | Subagent does long work and needs its own session |
| **Worktree** | Own git worktree, isolated branch per agent | Subagent edits code that could conflict with parent's |

OpenAI's SDK supports two patterns:
- **Agents‑as‑tools** — specialist handles a bounded subtask, returns to parent.
- **Handoffs** — specialist takes full control of the conversation.

LangGraph implements subagents as **nested state graphs**.

---

## Part 3 — Two universal orchestration patterns

### Fan‑out — parallel investigation, breadth

```
        ┌─────────────────────────┐
        │       Main agent        │
        │  (research, then spawn) │
        └────────────┬────────────┘
   ┌─────────────────┼─────────────────┐
   ▼                 ▼                 ▼
┌───────┐         ┌───────┐         ┌───────┐
│ Sub A │         │ Sub B │         │ Sub C │
│theory │         │theory │         │theory │
│  1    │         │  2    │         │  3    │
└───┬───┘         └───┬───┘         └───┬───┘
    └─────────────────┼─────────────────┘
                      ▼
              Summaries only
              (1–2K tokens each)
                      │
                      ▼
        ┌─────────────────────────┐
        │ Main agent synthesizes  │
        └─────────────────────────┘
```

**Best for:** investigation, research, root‑cause analysis, multi‑model concurrent generation.

Example (Alex Ker / Baseten): when `gpt-oss-120b` launched, they fanned out three subagent threads to investigate independently and synthesized a conclusion. The same pattern applies for concurrent outputs from different models (one thread of MiniMax M2.5, one thread of GLM‑5).

The value: **speed and context isolation.** Three parallel searches finish faster than three sequential ones, and the noise stays contained.

### Pipeline — sequential depth

```
   ┌─────────────────────────┐
   │      UX designer        │ ← evaluates user experience
   └────────────┬────────────┘
                ▼
   ┌─────────────────────────┐
   │       Architect         │ ← assesses technical feasibility
   └────────────┬────────────┘
                ▼
   ┌─────────────────────────┐
   │    Devil's advocate     │ ← stress‑tests assumptions
   └────────────┬────────────┘
                ▼
        Layered output
   (multi‑perspective synthesis,
   without all 3 lenses in main context)
```

**Best for:** evaluation through multiple lenses, design review, anything where the same artifact should be re‑examined from progressively deeper angles.

Each stage receives the previous stage's output and adds analysis. The main agent gets a layered, multi‑perspective evaluation without holding all three lenses in context at once.

For higher confidence on non‑deterministic outputs, **add a frontier model as a judge** to consolidate responses.

---

## Part 4 — The Planner / Generator / Evaluator split

The most important multi‑agent pattern for production. The same model role‑playing three parts often performs worse than three separate roles.

```
   ┌─────────────────────────┐
   │       Planner           │ ← decomposes goal into plan
   │  (no actions taken)     │
   └────────────┬────────────┘
                ▼
   ┌─────────────────────────┐
   │      Generator          │ ← executes plan, produces output
   │  (writes code / artifact)│
   └────────────┬────────────┘
                ▼
   ┌─────────────────────────┐
   │       Evaluator         │ ← independent review, scores against rubric
   │ (separate instance,     │
   │  no shared chain‑of‑    │
   │  thought)               │
   └────────────┬────────────┘
                ▼
        Loop if failing,
        deliver if passing
```

**Why split:** agents bias positive when grading their own work. An independent evaluator with a rubric (see `10-observability.md`) gives an unbiased signal.

**Cost evidence (walkinglabs lecture 9):**

| Setup | Duration | Cost | Result |
|---|---|---|---|
| Single agent, Opus 4.5 | 20 min | $9 | Unresponsive game |
| Planner + Generator + Evaluator, Opus 4.5 | 6 hours | $200 | Playable game |

22× the cost. The dividing line between "demo" and "ship."

---

## Part 5 — R.P.I. Framework (HumanLayer / Alex Ker)

Every prompt the user gives the harness should be **exactly one of three things**:

| Phase | What happens | Who reviews |
|---|---|---|
| **Research** | Agent explores the codebase, problem statement, prior art. **No action taken.** | (optional) — user reads if curious |
| **Plan** | Agent writes a step‑by‑step execution plan. | **Human proactively reviews — domain knowledge enters here** |
| **Implement** | Approved plan executes in a **new context window** (the main window). | Verification loop |

```
   ┌───────────────┐
   │   RESEARCH    │  ← no action; agent reads the code
   └───────┬───────┘
           ▼
   ┌───────────────┐
   │     PLAN      │  ← agent writes plan; human reviews
   └───────┬───────┘
           ▼
   ┌───────────────┐
   │  IMPLEMENT    │  ← fresh context window; execute the plan
   │   (subagents  │
   │    per step   │
   │    if long)   │
   └───────────────┘
       One phase
   per context window
```

Why each phase needs its own window:
- **Research** generates exploration noise — discard before planning.
- **Plan** is a clean, reviewable artifact — capture and inspect it.
- **Implement** runs the plan without re‑deriving it.

If the plan is long and intimidating, **decompose into per‑step subagents** so iterative intermediate state doesn't pollute the main window.

> *"Operating a harness is leading it to behave in a way the best staff engineers approach problem‑solving: break problems into subproblems, plan before implementing, get a second set of eyes on the plan."* — Alex Ker

The abstraction shifts from line‑by‑line code to prompts. The underlying discipline doesn't change.

---

## Part 6 — Subagents in different SDKs

| SDK | Pattern | Mechanism |
|---|---|---|
| **Claude Agent SDK** | Built‑in: Explore (Haiku), Plan, General‑purpose | Automatic — delegates based on task signature |
| **Codex CLI** | Explorer, Worker, Default | Explicit — only when asked |
| **OpenCode** | Configurable via JSON or markdown | Automatic — delegates based on task signature |
| **OpenAI Agents SDK** | Agents‑as‑tools / Handoffs | Code‑first declaration |
| **LangGraph** | Nested state graphs | Graph composition |
| **CrewAI** | Agent + Task + Crew | Role / goal / backstory / tools |
| **AutoGen** | 5 orchestration patterns (sequential, fan‑out/in, group chat, handoff, magentic) | Conversation‑driven |

**Magentic** (AutoGen / Microsoft Agent Framework) deserves a callout: a manager agent maintains a **dynamic task ledger** coordinating specialists. This is closer to how a human team lead operates — the ledger is the shared artifact, agents check it in.

---

## Part 7 — Anti‑patterns

| Anti‑pattern | Why it fails |
|---|---|
| Delegating work whose intermediate state the main agent will later need | Loses the very context that mattered |
| Subagent without a verification step | "Three agents all hallucinated together" — independent judge needed |
| Fan‑out without a synthesis step | You get three answers, no decision |
| Pipeline where each stage is the same agent type | Doesn't add perspective; just delays |
| Spawning subagents from inside a subagent without depth limit | Cost explosion, debugging nightmare |
| Subagents that share the parent's full context | Defeats the purpose — context isolation is the value |
| Treating handoff as fan‑out | Handoff = transfer control; fan‑out = parallel + aggregate |

---

## Part 8 — When NOT to use subagents

- The task is short (under ~5 tool calls).
- The intermediate state is part of the user‑facing reasoning.
- You need cross‑subagent communication mid‑flight (fan‑out is fire‑and‑forget + collect).
- Your harness doesn't have a clean summarization protocol (subagent outputs that aren't summarized just dump back into main context).

A common new‑builder mistake: spawning subagents for everything because "agents are good." Each subagent has setup cost, summary cost, and coordination risk. **Use them when the alternative is worse — context pollution, sequential time loss, lack of independent review.**

---

## Part 9 — Subagent design checklist

When you design a subagent, fill these in:

```
Name: <short verb_noun>
Trigger: <what task signature invokes me>
Input contract: <what main agent passes>
Output contract: <what main agent gets back — usually a 1–2K token summary>
Tools available: <subset; smaller is better>
Verification: <how does the subagent verify its own work before returning>
Failure mode: <what does the main agent do if I fail / time out>
Max turns: <safety cap>
```

If you can't fill these in, the subagent isn't ready.

---

## Cross‑references

- The tools subagents call: `05-tools-and-skills.md`
- Verifying subagent output independently: `08-verification-and-termination.md`
- Memory across subagent boundaries: `04-context-and-memory.md`
- Errors propagating across subagent boundaries: `09-error-handling-and-guardrails.md`
