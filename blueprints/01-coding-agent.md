# Blueprint 01 — Coding Agent

> **Target user:** an engineer working in a single repo who wants an agent that reads, edits, runs, and verifies code.

This is the most mature blueprint — coding agents have the deepest co‑training and the most production telemetry. Use it as the reference for what "harness done well" looks like.

---

## 1. Description and target user

A coding agent works inside a developer's repository. It reads code, edits files, runs tests, and commits. The user is a software engineer; the workspace is a git repo.

Reference implementations: **Claude Code, Codex CLI, Cursor, Aider, Cline, OpenCode.**

---

## 2. Why this domain needs a custom harness

A raw LLM with a code dump produces plausible‑looking code that often fails. The harness provides:

- A loop that lets the agent iterate (write → test → fix → test).
- Tools to read selectively (grep, glob, head) — not load full repos.
- Verification that turns "compiled successfully" into "tests pass + types check + e2e green."
- State persistence so multi‑hour tasks survive context resets.
- Permission gating for destructive ops (rm, force push, deploy).

Without these, you have an autocomplete. With them, you have an engineer.

---

## 3. Architecture

```
                    ┌─────────────────────────┐
   User CLI ───────▶│   Terminal REPL / TUI   │
                    └────────────┬────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │   Conversation loop     │  ← 7‑step TAO cycle
                    │  (stream + dispatch)    │
                    └────────────┬────────────┘
                                 │
   ┌─────────────────────────────┼─────────────────────────────┐
   ▼                             ▼                             ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│ Bash │  │Files │  │Search│  │ Web  │  │ Skill│  │ MCP  │  │ Sub‑ │
│ exec │  │R/W/  │  │grep/ │  │fetch │  │ load │  │tools │  │agent │
│      │  │Edit  │  │ AST  │  │      │  │      │  │      │  │spawn │
└──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘
   │         │         │         │         │         │         │
   └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │  Hooks layer    │  ← pre‑tool, post‑tool, pre‑commit, pre‑stop
                       └────────┬────────┘
                                ▼
                  Commits to repo, updates state files,
                  emits OTel spans, surfaces cost
```

---

## 4. Core decisions

| Decision | Choice | Reasoning |
|---|---|---|
| **Thin vs thick** | **Thin** | Co‑training with frontier models is strongest for coding. Trust the model. |
| **Inside vs outside sandbox** | **Inside** (single user) | Single‑user laptop tool. Per‑user dedicated infra in hosted variants. |
| **Single vs multi‑user** | Single per workspace | Multi‑user hosted coding agents (e.g., Mendral) layer the outside‑sandbox pattern on top |
| **Memory** | 3‑tier (index → topic → raw); `CLAUDE.md` + `MEMORY.md` | Standard Claude Code pattern |
| **State** | Git + `PROGRESS.md` + `DECISIONS.md` + `features.json` | Repo is the system of record |
| **Subagents** | Fork for child sessions, Worktree for parallel features, Explore (Haiku) for fast research | Default Claude Code mix |
| **Verification** | L1 static + L2 unit/integration + L3 e2e; pre‑stop hook | Mandatory |
| **Framework fit** | Claude Agent SDK (best); OpenAI Agents SDK (works); LangGraph (over‑engineered for this) |

---

## 5. Tool inventory

The Claude Code six‑category set as the canonical list:

| Category | Tools | Risk tier |
|---|---|---|
| **File ops** | read, write, edit, multi_edit, glob | 1 |
| **Search** | grep / ripgrep, semantic search, AST/LSP | 0 |
| **Execution** | bash (sandboxed) | 2 |
| **Web access** | fetch, search | 0 |
| **Code intelligence** | LSP, tree‑sitter, type info | 0 |
| **Subagent spawning** | task, fork, worktree | 1 |

Plus per‑project MCP tools (linear, github, etc.). Selective per project. Use search‑based loading if available.

---

## 6. State files

```
project/
├── AGENTS.md / CLAUDE.md          # always loaded — landing page + hard constraints
├── PROGRESS.md                    # latest state (clock‑in / clock‑out)
├── DECISIONS.md                   # design log + rejected alternatives
├── features.json                  # backlog with state machine
├── Makefile                       # setup, test, lint, check, dev
├── docs/
│   ├── api-patterns.md            # on‑demand
│   ├── database-rules.md          # on‑demand
│   └── testing-standards.md       # on‑demand
├── src/<module>/ARCHITECTURE.md   # module‑local knowledge
├── skills/
│   ├── deploy-staging/SKILL.md
│   └── rollback/SKILL.md
└── .claude/  or  .codex/          # harness config + hooks
    ├── settings.json
    └── hooks/
        ├── pre-commit
        ├── pre-stop               # ← runs `make check`, blocks broken terminations
        └── post-edit              # ← format + lint + type check
```

---

## 7. Subagent topology

| Pattern | When |
|---|---|
| **Explore (Haiku)** | Fast file‑system / repo exploration before main planning |
| **Plan subagent** | Build the plan before implementation (R.P.I.) |
| **Fan‑out** | "Investigate 3 candidate root causes" |
| **Pipeline** | UX → architect → devil's advocate on a design |
| **Evaluator** | Independent grading after generator finishes |
| **Worktree** | Parallel feature work that must not collide |

**Avoid:** fork for every tool call (defeats context isolation), or no subagents at all (main context drowns in exploration noise).

---

## 8. Verification strategy

```
L1 (static):    mypy --strict + ruff check + tsc --noEmit + biome lint
L2 (runtime):   pytest tests/unit + pytest tests/integration
L3 (e2e):       playwright test + curl probe + smoke deploy

Triggers via hooks:
  - post‑edit  → L1
  - pre‑stop   → L1 + L2 (always); L3 if cross‑component change
  - pre‑commit → L1 + L2 + no console.log / debugger / debug TODO
```

`pre-stop` hook **runs `make check` and rejects termination on failure.** This is the single highest‑leverage piece of wiring in this entire blueprint.

---

## 9. Build steps

10‑step recipe to bootstrap a coding agent:

1. **Init phase.** Write `Makefile` with `setup`, `dev`, `test`, `lint`, `check`. Verify all targets run clean.
2. **Write `AGENTS.md`** — 50–80 lines. Hard constraints (≤15). Verification commands. Topic doc references.
3. **Add `PROGRESS.md` and `DECISIONS.md`** with initial state. Commit.
4. **Choose framework.** Default: Claude Agent SDK. Configure CLI and any MCP servers (selectively).
5. **Wire hooks.** Minimum: `pre-stop` (runs `make check`), `pre-commit` (blocks debug code), `post-edit` (formatter + linter).
6. **Define risk tiers** for tools. Default: read=0, mutate=1, exec=2, external=3, irreversible=4.
7. **Write 1–3 skills** for procedures the model wouldn't know (your internal CLI, deploy steps, internal repo conventions).
8. **Add `features.json`** with state machine. Seed with current backlog.
9. **Configure observability.** OTel exporter (Honeycomb / Tempo / Jaeger). Cost meter visible per session.
10. **Pilot on one feature.** Run R.P.I. flow (Research → Plan → human review → Implement). Iterate.

---

## 10. Failure modes specific to coding agents

| Failure | Counter |
|---|---|
| Agent writes plausible‑but‑broken code, says "should work" | `pre-stop` hook + L3 e2e mandatory |
| Agent refactors unrelated code while implementing feature | WIP=1 rule in `AGENTS.md` |
| Agent loads entire 5000‑line file via `read` | Constrain to `grep` / `glob` / `head`; reject `read` on files > N lines |
| Agent mocks the DB and tests pass; migration breaks in prod | Integration tests must hit real DB (testcontainer) |
| Agent commits debug code | `pre-commit` hook blocks |
| Multi‑hour task loses state on context reset | Ralph Loop pattern: init agent + coding agent + filesystem continuity |
| Agent declares feature done while linter complains | `pre-stop` reads exit code, not agent's claim |
| Tool sprawl from MCP servers fills context | Per‑project MCP selection; search‑based loading; disconnect unused |
| Cost explosion from runaway loop | Max‑turn cap + token budget cap + cost meter alerts |
| Agent claims tests pass by editing test file | Hook check: tests file diff in commit means tests must still cover the production code (mutation testing optional) |

---

## Reference reads

- 12 components: `../core/02-twelve-components.md`
- Loop walkthrough: `../core/03-loop-in-motion.md`
- Verification deep dive: `../core/08-verification-and-termination.md`
- State / Ralph Loop: `../core/07-state-and-persistence.md`
- Frameworks: `../framework-comparison.md`
