# Blueprint 06 — Build Your Own

A 10‑step recipe + worksheet for any agentic project that doesn't match one of the canonical blueprints (`01–05`).

This is the **most important blueprint** if your domain is novel — the others let you copy patterns, this one teaches you to derive them.

---

## Before you start — the 5 questions

Answer these in writing before any code. Each blocks a downstream decision.

| # | Question | Why it matters | Decision it blocks |
|---|---|---|---|
| 1 | **Who is the user**, and what is the smallest thing the agent does for them that's valuable? | Forces narrow MVP scope | Tool inventory, success metric |
| 2 | **Is the work single‑session or multi‑session?** Hours? Days? Weeks? | Determines if you need durable execution | State files, Ralph Loop |
| 3 | **Is the model co‑trained on this domain?** (Coding = yes; fashion = mostly no) | Determines thin vs thick | Framework choice |
| 4 | **What's the risk tier of the most impactful action?** Read‑only? Mutates user state? Spends money? Affects the physical world? | Determines the permission model and verification rigor | Tier table, hooks, confirmation UX |
| 5 | **Single user (local) or multi‑user (hosted)?** | Determines inside vs outside sandbox | Whole architecture |

If you can't answer all five, stop and clarify with the user before coding.

---

## The 10‑step recipe

### Step 1 — Define the value proposition in one sentence

> "<Agent name> helps <user persona> do <task class> by <core capability>."

Keep it narrow. Better to nail a small thing than to flail on a big one.

### Step 2 — Make the architectural bets

Use `../architectural-decisions.md` as a checklist. Resolve each:

```
Thin vs thick                  → ___________
Inside vs outside sandbox      → ___________
Single vs multi-user           → ___________
Memory tier strategy           → ___________
State strategy                 → ___________
Subagent topology              → ___________
Permission model + risk tiers  → ___________
Verification strategy          → ___________
Framework choice               → ___________
```

If any answer is "we'll figure it out later," the answer is wrong. Pick now; revise once you have data.

### Step 3 — Write the tool inventory

Use the table format:

```
| Tool name          | Risk tier | Purpose                                 |
|--------------------|-----------|-----------------------------------------|
| <verb_noun>        | 0–4       | <one-line description, model-readable>  |
```

Rules:
- 10 focused tools beat 50 overlapping ones (Addy Osmani).
- For every tool, write its **description as the model will see it** — that's what populates the prompt.
- Bash as the long‑tail catch‑all; only build a tool when bash wouldn't work or needs gating.
- Tag risk tier *now*. Don't postpone — it drives permission UX.

### Step 4 — Write `AGENTS.md` (≤80 lines)

Use the skeleton in `../core/04-context-and-memory.md` Part 7. Required sections:

```
- Project description (1–2 sentences)
- First run commands (Makefile targets)
- Hard constraints (≤15, each traceable to a failure or external rule)
- Verification commands (L1 / L2 / L3)
- Topic docs (list with descriptions, lazy‑loaded)
- Session protocol (clock‑in / clock‑out routine)
```

Human‑written. Never LLM‑generated.

### Step 5 — Write the state model

Decide the 5‑file minimum (or domain equivalent):

```
AGENTS.md           - always loaded
PROGRESS.md         - per session
DECISIONS.md        - design log
features.json       - backlog with state machine
Makefile / equivalent
```

For domain‑specific state (wardrobe, calendar, cart, etc.), define the schema in code. Don't store user‑state in markdown — use a real DB.

### Step 6 — Wire the loop

The 7 steps (`../core/03-loop-in-motion.md`):

1. Prompt assembly
2. LLM inference
3. Classify output
4. Tool execution (with permission checks)
5. Result packaging
6. Context update (with compaction)
7. Loop until terminate

Choose the framework (Step 2 decision). Most frameworks ship this loop — focus your work on what the framework doesn't provide:
- Per‑project hooks (especially `pre-stop`).
- Custom tools (Step 3 inventory).
- Memory tiers (if non‑standard).

### Step 7 — Wire verification

Mandatory for production:

- **L1 / L2 / L3 verification** (Source: walkinglabs lecture 9).
- **`pre-stop` hook** that runs the verification command and blocks termination on failure.
- **Independent evaluator** (separate subagent or different model) on open‑ended outputs.

If verification can't be expressed as `command_returns_zero`, you have an evaluator + rubric problem (Source: walkinglabs lecture 11).

### Step 8 — Wire observability

Minimum viable:
- OpenTelemetry spans per session / task / tool call.
- Tag spans with feature ID, model, cost.
- Cost meter visible to user.

Sprint Contract template that every non‑trivial task references.

### Step 9 — Wire long‑horizon resumption (if applicable)

If tasks span > 1 context window:

- Durable execution (Mendral pattern: each turn is a checkpoint).
- Filesystem continuity (PROGRESS.md updated mid‑task).
- Ralph Loop (init agent + worker agent + filesystem hand‑off).

Skip this if all tasks complete in one window.

### Step 10 — Pilot, observe, ratchet

- Run on one real task (R.P.I. flow: Research → Plan → human review → Implement).
- Track failures.
- Each failure → trace it → identify the harness layer responsible → fix at that layer → add a ratchet entry to `AGENTS.md` (if it's a constraint) or `DECISIONS.md` (if it's a design choice).

**The ratchet pattern:** every constraint in `AGENTS.md` should trace to a specific failure. Don't pre‑emptively constrain.

---

## The worksheet

Fill this in before coding. Save it in your repo (e.g., `docs/harness-design.md`).

```markdown
# <Project name> — Harness Design

## 1. Value proposition (one sentence)


## 2. Architectural bets
- Thin vs thick:
- Inside vs outside sandbox:
- Single vs multi-user:
- Memory strategy:
- State strategy:
- Subagent topology:
- Permission model:
- Verification strategy:
- Framework:

## 3. Tool inventory
| Tool | Risk tier | Purpose |
|------|-----------|---------|

## 4. AGENTS.md outline (≤80 lines)


## 5. State model
- Files / DB tables:
- Schemas:

## 6. Loop wiring
- Hooks: pre-tool, post-tool, pre-commit, pre-stop, ...

## 7. Verification
- L1 (static):
- L2 (runtime):
- L3 (e2e):
- Evaluator + rubric (for open-ended outputs):

## 8. Observability
- Trace exporter:
- Span tagging:
- Cost meter:
- Sprint Contract template:

## 9. Long-horizon (if applicable)
- Durable execution: yes / no
- Ralph Loop: yes / no
- State persistence beyond session: yes / no

## 10. Initial backlog
- Pilot task:
- Success criteria:
- Failure modes to watch for:
```

---

## Common pitfalls when designing a new harness

| Pitfall | Counter |
|---|---|
| Trying to support every framework at once | Pick one. Switch later only if you've outgrown it |
| Building tools before deciding risk tiers | Risk tiers drive permission UX which drives tool surface — decide tiers first |
| Skipping the init phase ("we'll set up later") | Init landmines compound; walkinglabs lecture 6 is non‑optional |
| Writing AGENTS.md with the model | ETH research: 20% inference overhead + performance loss; human‑write it |
| Thick harness for a co‑trained domain | Scaffolding doesn't come down; you'll rebuild like Manus did 5× |
| Thin harness for a non‑co‑trained domain | Quality varies wildly; explicit logic is the right move |
| No `pre-stop` hook | Premature victory; demo vs ship line is unguarded |
| Building observability "later" | The traces you need to debug are happening right now |
| Single‑stage permission ("trust = on") | Confirmation fatigue or risky calls slip through |
| Subagents before reliable verification | Three agents hallucinate together — worse than one |
| Self‑evaluation | Bias positive; separate evaluator is a 22× quality gap (Anthropic case) |

---

## When to copy from an existing blueprint

If your domain shares characteristics with an existing blueprint, **borrow aggressively.**

| If your domain has... | Borrow from |
|---|---|
| Repo‑centric work, dev‑facing | Blueprint 01 (Coding) |
| Many sources synthesized → cited output | Blueprint 02 (Deep Research) |
| Money + irreversible actions + catalog browsing | Blueprint 03 (Shopping) |
| Visual judgment + user‑owned inventory + composition | Blueprint 04 (Fashion) |
| Multi‑channel inbound + per‑user identity + automations | Blueprint 05 (Multichannel) |

You'll often combine: a fashion agent that *also* shops uses Blueprint 04 + handoff to Blueprint 03. A research agent that *also* delivers reports via Slack uses Blueprint 02 + a thin layer of Blueprint 05.

---

## Final checklist before launch

```
[ ] AGENTS.md is ≤80 lines, human‑written, ratchet‑traced
[ ] All tools have risk tiers and timeouts
[ ] pre-stop hook exists and runs the verification command
[ ] Independent evaluator wired for open-ended outputs
[ ] Per-session OpenTelemetry trace tagged with cost
[ ] PROGRESS.md and DECISIONS.md exist and are updated by the agent
[ ] Permission model is 3-stage (trust / per-call / per-risky-op)
[ ] Memory is hint, not ground truth — agent verifies before acting
[ ] Sprint Contract template exists for non-trivial tasks
[ ] Anti-patterns checklist reviewed (../anti-patterns.md)
```

Each unchecked box is a known production failure waiting to happen.

---

## Reference reads

- Foundations: `../core/01-foundations.md`
- All 12 components: `../core/02-twelve-components.md`
- Architectural decisions: `../architectural-decisions.md`
- Anti-patterns: `../anti-patterns.md`
- Source synthesis: `../source-synthesis.md`
