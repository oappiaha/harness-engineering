# 07 — State and Persistence

Stateless model + multi‑session work = mandatory persistence layer. This doc covers what to persist, where, and how.

---

## Part 1 — The repo as system of record

> *"Information that doesn't exist in the repo doesn't exist for the agent."* — walkinglabs lecture 3

Knowledge in Confluence, Slack threads, Jira comments, or senior engineers' heads is **invisible to the agent.** Every fresh session starts blind to it.

The implication: the **repo must contain everything the agent needs to ground itself** — architecture, constraints, decisions, current state, conventions.

### Where knowledge should live

| Knowledge | Lives in | Loaded |
|---|---|---|
| Tech stack + first‑run commands | `AGENTS.md` / `CLAUDE.md` | Always |
| Hard rules (≤15) | `AGENTS.md` | Always |
| Module architecture | `src/<module>/ARCHITECTURE.md` | When working in that module |
| Module constraints | `src/<module>/CONSTRAINTS.md` | When working in that module |
| Domain‑wide rules (API, DB, testing) | `docs/api-patterns.md`, `docs/database-rules.md`, etc. | On demand |
| Current session state | `PROGRESS.md` | Session start (clock‑in) |
| Design decisions + alternatives rejected | `DECISIONS.md` | When a design question arises |
| Feature backlog + state | `features.json` or `docs/features.md` | When picking next work |

The crucial pattern: **knowledge lives next to the code it describes.** A 200‑line `ARCHITECTURE.md` inside `src/payments/` is more useful than the same content in `docs/architecture.md` 5 directories away.

---

## Part 2 — `PROGRESS.md` — single‑session state

The continuity primitive. Read at session start, updated before session end.

### Template

```markdown
# Current State

- Latest commit: abc1234 — "feat: add cart pagination"
- Test status: 42/43 passing
- Build status: clean
- Known issues:
  - Pagination edge case at boundary 0
  - Stripe webhook timing flake

## In progress
- Pagination edge case (active feature)
  - Wrote failing test at tests/cart/test_pagination.py:88
  - Suspect off-by-one in `Cart.paginate()` line 142

## Next steps
1. Fix pagination edge case
2. Add ?cursor query parameter
3. Update API docs

## Blocked
- (none)

## Recent context
- User asked to prioritize pagination over Stripe webhook
- Decided NOT to migrate to cursor pagination (see DECISIONS.md #15)
```

### Clock‑in / Clock‑out routines (walkinglabs lecture 5)

Define these in `AGENTS.md`:

```markdown
## Clock-in routine (at session start)
1. Read PROGRESS.md
2. Read DECISIONS.md (skim for recent entries)
3. Run `make check` — verify state matches what PROGRESS claims
4. If state diverges, update PROGRESS.md before continuing

## Clock-out routine (at session end)
1. Run `make check` — verify all green
2. Update PROGRESS.md: latest commit, test status, where you stopped
3. Commit (git is the authoritative snapshot)
```

**Why a clock‑in / clock‑out routine matters:** in walkinglabs's data, no progress record costs 15+ min per session rebuilding state. Across 10 sessions that's 2.5 hours of pure overhead. Worse: completion drops from ~100% (single session) to ~58% (multi‑session) with hidden defects accumulating.

---

## Part 3 — `DECISIONS.md` — Architecture Decision Records

A growing log of design decisions and the alternatives that were considered and rejected. Without this, fresh sessions re‑debate settled questions.

### Entry template

```markdown
## 2026-05-15 — Use SQLAlchemy 2.0 syntax in all new code

**Decision:** All new DB code uses SQLAlchemy 2.0 typed syntax.

**Reason:** Existing 1.4 syntax mixed with 2.0 has caused 3 type errors in past 2 weeks (issues #142, #156, #161). Consistency reduces cognitive load.

**Rejected alternative:** Migrate everything to 2.0 in one PR — too risky; would block other work for ~1 week.

**Constraint added to:** AGENTS.md ("DB queries must use SQLAlchemy 2.0 syntax")

**Expiry:** None — permanent until SQLAlchemy 3.0 lands.
```

The two load‑bearing fields are **Reason** and **Rejected alternative.** Without those, future agents can't judge edge cases.

This is the same structure as the harness's own [feedback memory](../README.md) style — lead with the rule, then *why*, then *how to apply*.

---

## Part 4 — Feature lists as harness primitives

(walkinglabs lecture 8 — and arguably the most important single artifact for multi‑session work.)

> **Feature lists are foundational infrastructure, not memos. They are the single source of truth for "done."**

### State machine

```
not_started → active → blocked → passing
                 │
                 └→ active (if blocked clears)
```

### Triple structure

Each feature is a triple: **(behavior, verification command, current state).**

```json
{
  "id": "F03",
  "behavior": "POST /cart/items with {product_id, quantity} returns 201",
  "verification": "curl -X POST http://localhost:3000/cart/items -d '{\"product_id\":1,\"quantity\":1}' | jq .status == 201",
  "state": "passing",
  "evidence": "commit abc123, test output log line 42"
}
```

### Rules

- **One feature `active` at a time** (WIP=1, see `08-verification-and-termination.md`).
- **Calibrate granularity** to "completable in one session" (not "implement cart"; not "create name field").
- **Pass‑state gating:** verification must execute successfully before `active → passing`.
- **Agents cannot self‑transition state.** The state changes only when the verification command exits 0.

### Why this works

| Problem | Without feature list | With feature list |
|---|---|---|
| New session orientation | 20+ min re‑inferring state | 2 min reading `features.json` |
| "Done" definition | Agent says so | Verification command exits 0 |
| Scope creep | Agent does "a little extra" | One active feature blocks others |
| Cross‑session completion rate | ~58% | 95%+ in walkinglabs data |

---

## Part 5 — Quality Document (long‑lived state)

Beyond per‑feature state, maintain a **per‑module quality scorecard** (walkinglabs lecture 12). Each module scores A–C on:

- Verification passing rate
- Agent understandability (can a fresh agent get oriented?)
- Test stability
- Architecture boundary compliance
- Code convention adherence

Updated periodically (weekly). Identifies modules that need refactoring vs. those safe to extend.

> Without active quality scoring, **build pass rates can drift from 100% → 68% over 12 weeks**, tests from 100% → 61%, and startup time from 5 min → 60+ min (walkinglabs lecture 12 data).

Agents copy existing patterns and propagate suboptimal code (a Codex finding). Quality decay compounds.

---

## Part 6 — The Initialization Phase (walkinglabs lecture 6)

**Init and implementation have conflicting optimization targets.** Mix them and both degrade.

### Init responsibilities (one‑time, before any feature work)

```
project/
├── AGENTS.md                # written
├── Makefile                 # setup, test, lint, check, dev all work
├── pyproject.toml / package.json
├── .python-version / .nvmrc
├── docs/
│   ├── architecture.md      # baseline
│   └── conventions.md       # baseline
├── PROGRESS.md              # initial state
├── DECISIONS.md             # foundational decisions
├── features.json            # initial backlog
└── .git                     # initial commit
```

### Startup Readiness Checklist

Before declaring init done, an agent must verify:

- [ ] `make setup` runs clean from a fresh checkout
- [ ] `make dev` starts the dev environment
- [ ] `make test` runs and exits 0
- [ ] `make check` runs and exits 0
- [ ] `AGENTS.md` references `make` targets that exist
- [ ] `PROGRESS.md` has initial state
- [ ] First git commit captures all of the above

Missing one of these creates **"implicit assumption landmines"** that cost 3–4 sessions to recover from when discovered weeks later.

---

## Part 7 — State management across frameworks

| Framework | Mechanism | Resume semantics | Best for |
|---|---|---|---|
| **Anthropic / Claude Code** | Git commits as checkpoints; progress files as scratchpads | Read git log + PROGRESS.md | Single‑user, repo‑centric work |
| **LangGraph** | Typed dicts flow through nodes; reducers merge updates; checkpoints at super‑step boundaries | Replay from checkpoint; time‑travel debug | Long workflows; auditable transitions |
| **OpenAI Agents SDK** | 4 strategies: application memory / SDK sessions / Conversations API / `previous_response_id` | Depends on chosen strategy | Pick per use case |
| **AutoGen** | Message history | Replay messages | Conversation‑centric agents |

**Mendral pattern (durable execution):** built on Inngest, **each loop turn becomes a checkpointed step.** Surviving deployments, instance failures, and idle periods becomes a framework property, not application code. Critical for **multi‑user hosted agents** where the agent loop might span hours.

---

## Part 8 — The single‑user vs multi‑user inflection point

When the agent has **multiple concurrent users**, filesystem‑as‑state stops working.

Mendral's solution (path‑based dispatch):

```
            tool: filesystem_read(path)
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
   path starts with /workspace/   path starts with /skills/ or /memory/
            │                     │
            ▼                     ▼
   ┌─────────────────┐   ┌─────────────────┐
   │   Sandbox RPC   │   │   Postgres      │
   │  (per‑user/job) │   │  (per‑user row) │
   └─────────────────┘   └─────────────────┘
```

**One tool surface, two backends, invisible to the agent.**

This preserves the model's trained API (it still thinks it's reading a file) while giving operations the multi‑tenant guarantees they need. See `../architectural-decisions.md` for the full inside‑vs‑outside‑sandbox debate.

---

## Part 9 — Anti‑patterns

| Anti‑pattern | Why it fails |
|---|---|
| No persistence between sessions | 15+ min rebuild per session; completion drops 58% |
| Relying on automatic compaction for continuity | Loses the *why* of past decisions |
| `PROGRESS.md` updated only at session end | If session crashes mid‑way, state is lost |
| `DECISIONS.md` without rejected alternatives | Re‑debate the same questions every quarter |
| Feature list where agents self‑transition state | "Done" becomes meaningless |
| Knowledge in shared docs (Confluence / Slack) | Invisible to agent; might as well not exist |
| Centralized `ARCHITECTURE.md` 10 levels deep | Never loaded; module‑local files beat it |
| Empty‑directory project starts (no init phase) | Implicit assumption landmines |
| Build‑pass treated as project health | Build can pass while tests degrade — track both |

---

## Part 10 — A 5‑file minimum

If you can only afford five state files in your repo, take these:

1. **`AGENTS.md`** — entry instructions (50–80 lines)
2. **`PROGRESS.md`** — current state
3. **`DECISIONS.md`** — design log
4. **`features.json`** — backlog with state machine
5. **`Makefile`** — `setup` / `test` / `lint` / `check` / `dev`

You can add `ARCHITECTURE.md`, `CONSTRAINTS.md`, module‑local docs, etc. as needed — but these five carry most of the weight.

---

## Cross‑references

- The system that loads these files: `04-context-and-memory.md`
- Verification commands that drive feature state: `08-verification-and-termination.md`
- Why the repo (not Notion) is the state: `../source-synthesis.md`
- Observability over time: `10-observability.md`
