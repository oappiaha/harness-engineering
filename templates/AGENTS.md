# `<PROJECT NAME>` — Agent instructions

> ≤80 lines. Human‑written. Every line traces to a specific failure or hard external constraint. Loaded on every session.
>
> **Operator instructions:** do NOT generate this file yourself. Help the user fill it in line by line. Each TODO below is for the human author.

## What this project is

> TODO (1–2 sentences): what does this codebase / project do and who uses it?

Example: *"The auth service handles user login, session management, and OAuth flows for our SaaS. Backend engineers at our company are the primary maintainers."*

## First run

```bash
# TODO: replace with actual commands
make setup     # install dependencies
make dev       # start dev environment
make test      # run all tests
make check     # full verification (lint + types + tests + e2e)
```

## Hard constraints

> ≤15 rules. Each must trace to a specific past failure or external rule. Delete generic "be careful" statements.

- TODO: <constraint 1 — e.g., "All APIs must use OAuth 2.0">
- TODO: <constraint 2 — e.g., "DB queries must use SQLAlchemy 2.0 syntax">
- TODO: <constraint 3 — e.g., "PRs must pass `pytest && mypy --strict && ruff check`">

## Verification commands

These are the literal commands the `pre-stop` hook runs.

```bash
# TODO: customize
Unit:        pytest tests/unit -x
Integration: pytest tests/integration
E2E:         make e2e
Full:        make check
```

## Topic docs (load on demand)

- `docs/api-patterns.md` — when adding endpoints
- `docs/database-rules.md` — when touching the DB
- `docs/testing-standards.md` — when writing tests
- TODO: add or remove as needed

## Session protocol

**Clock‑in (start of session):**
1. Read `PROGRESS.md` + `DECISIONS.md`
2. Run `make check` — verify state matches PROGRESS
3. If state diverges, update `PROGRESS.md` before continuing

**Clock‑out (end of session):**
1. Run `make check` — must exit 0
2. Update `PROGRESS.md` with new state
3. Commit
4. Mark feature state transitions in `features.json` (if applicable)

## Tools and skills

- Tools (always available): `read`, `edit`, `bash`, `grep`, `glob`
- Skills (loaded on demand from `skills/`): TODO
- MCP servers (per project): TODO

## Memory

- This file (`AGENTS.md`) — always loaded.
- `PROGRESS.md` — read at clock‑in.
- `DECISIONS.md` — read at clock‑in.
- `memory/index.md` — lightweight index, always loaded.
- `memory/<topic>.md` — loaded on demand when the topic matches.

**Memory is a hint, not ground truth.** Before acting on a remembered fact, verify against actual state.

## What goes wrong

When the agent fails, check:
1. Did `make check` actually pass?
2. Is the agent acting on stale memory? (Verify against current state.)
3. Did a tool error get swallowed instead of returned as a message?
4. Is there a `DECISIONS.md` entry that should have prevented this?

If you discover a new failure mode, add a `DECISIONS.md` entry + (if it's a recurring rule) a constraint above.
