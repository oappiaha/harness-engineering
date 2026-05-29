# Worked Example — Coding Agent

> A complete Phase 0 → Phase 3 build of a coding agent ("FlakyFixer") for a Python team. Every artifact shown is the actual file as it would look on disk.

---

## The project in one sentence

> *FlakyFixer helps backend engineers at our company fix flaky tests in our auth service without leaving the terminal.*

---

## Phase 0 — `docs/harness-design.md` (filled in)

```markdown
# Harness Design — FlakyFixer

## Project

One-sentence value: FlakyFixer helps backend engineers at our company fix flaky tests
in our auth service without leaving the terminal.

## Pre-flight

### Q1 — Who/what valuable?
Backend engineer at our company. Smallest valuable unit: fix one specific failing test
in tests/auth/ without leaving the terminal (no jumping to Jira, Slack, or the CI UI).
Alternative today: 15-min context-switch to read CI logs, repro locally, fix, push.

### Q2 — Timescale?
Hours / single window. A typical flaky test session is 20-90 minutes. Always within
one context window.

### Q3 — Model co-trained?
Yes — coding is the strongest co-training case. Thin harness.

### Q4 — Worst risk tier?
Tier 2 (bash + edit_file). No deploys, no external effects. Could add tier 3 later if
we wire `git push`.

### Q5 — Single or multi-user?
Single user, local CLI on each engineer's laptop.

## Derived decisions (Akshay's 7)

1. Agent count:        Single agent (no multi-agent overhead needed for Phase 1; add
                       independent evaluator in Phase 3 if quality drops).
2. Reasoning strategy: R.P.I. for unfamiliar tests; ReAct for known patterns.
3. Context strategy:   Aggressive compaction — sessions are short, tokens matter.
4. Verification:       Computational — `make check` exits 0 = done.
5. Permissions:        Tiered. Tier 0-2 mostly. `git push` reserved for human.
6. Tool scoping:       Minimal per step. Use Claude Code's Tool Search default.
7. Harness thickness:  Thin. Trust Claude's coding capability.

## Framework choice

Claude Agent SDK (Python). Reason: strongest coding co-training; Tool Search by
default; named matcher hooks for pre-stop; in-process MCP for custom tools.

## Blueprint chosen

01-coding-agent — direct match. No deviations.

## Open questions

- Should we add an independent evaluator subagent? Defer until we see false-positive
  "done" claims in production.
- Should `git push` be a tool or human-only? Default human-only for v1.

## Sign-off

[x] All 5 pre-flight questions answered
[x] All 7 decisions locked
[x] Framework chosen
[x] Blueprint chosen
[x] User approved
```

---

## Phase 1 — `AGENTS.md` (human‑written, 64 lines)

```markdown
# FlakyFixer — Agent instructions

The auth service handles user login, session management, and OAuth flows.
FlakyFixer is a Claude Code session loaded with this AGENTS.md, used to fix
flaky tests in this codebase without leaving the terminal.

## First run

make setup     # uv venv && uv pip install -e ".[dev]"
make dev       # docker-compose up (postgres, redis)
make test      # pytest tests/ -x
make check     # ruff + mypy --strict + pytest tests/auth/

## Hard constraints

- All DB queries must use SQLAlchemy 2.0 typed syntax (mixing 1.4 caused 3 type
  errors in past 2 weeks, see DECISIONS.md #2).
- Don't mock the database in integration tests — use the testcontainer in
  conftest.py (mocked tests passed but missed the JSON column migration bug,
  DECISIONS.md #3).
- mypy --strict must pass on every edit (CI rejects PRs that fail).
- Don't `git push` — humans push after review.
- Don't touch tests/auth/test_oauth_integration.py — it's quarantined; see Issue #412.

## Verification commands

- Unit:        pytest tests/unit -x
- Integration: pytest tests/integration --testcontainer
- Type check:  mypy --strict src/
- Lint:        ruff check src/ tests/
- Full:        make check

## Topic docs (load on demand)

- docs/sqlalchemy-2-patterns.md — when writing or refactoring DB queries
- docs/oauth-flows.md — when touching OAuth code
- docs/testing-with-testcontainers.md — when writing integration tests

## Session protocol

Clock-in:
1. Read PROGRESS.md and DECISIONS.md
2. Run `make check`
3. If state diverges from PROGRESS, update PROGRESS first

Clock-out:
1. Run `make check` (pre-stop hook enforces this — see .claude/hooks/pre-stop)
2. Update PROGRESS.md
3. Commit

## Tools and skills

Tools: Read, Edit, Bash, Grep, Glob (Claude Code built-ins).
Skills (loaded on demand from skills/):
- skills/repro-flaky-test/ — multi-step procedure for reproducing flakes
- skills/bisect-test-history/ — git bisect a flaky test through main

## Memory

Memory is a hint, not ground truth. Before acting on a remembered file path or
test name, verify with `ls` or `grep` first.
```

---

## Phase 1 — `Makefile`

```makefile
.PHONY: setup dev test test-unit test-integration lint typecheck e2e check clean

setup:
	uv venv && uv pip install -e ".[dev]"
	docker-compose pull

dev:
	docker-compose up -d
	@echo "Dev environment ready. Use 'make dev-stop' to tear down."

dev-stop:
	docker-compose down

test-unit:
	uv run pytest tests/unit -x

test-integration:
	uv run pytest tests/integration --testcontainer

e2e:
	uv run pytest tests/e2e

test: test-unit test-integration

lint:
	uv run ruff check src/ tests/

typecheck:
	uv run mypy --strict src/

# The verification command. pre-stop hook runs this. Cheap checks first.
check: lint typecheck test
	@echo "✓ make check passed"

clean:
	rm -rf .pytest_cache .mypy_cache .ruff_cache __pycache__
	docker-compose down -v
```

---

## Phase 1 — `.claude/hooks/pre-stop` (executable)

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

if make check >"$LOG" 2>&1; then
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"Stop","decision":"allow"}}
EOF
    exit 0
fi

LOG_TAIL="$(tail -c 4000 "$LOG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
cat <<EOF
{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"ERROR: \`make check\` failed. WHY: verification did not pass. FIX: address output below.\n\n${LOG_TAIL}"}}
EOF
exit 0
```

---

## Phase 1 — Initial `PROGRESS.md`

```markdown
# Progress

## Current state
- Latest commit: a1b2c3d — "phase 1: initial harness skeleton"
- Test status: 142/142 passing (after harness setup)
- Build status: make check passes
- Phase: Phase 1 — Skeleton COMPLETE; entering Phase 2

## In progress
- (nothing — Phase 1 complete; awaiting first real flaky test)

## Next steps
1. Pilot on one real flaky test from current sprint
2. If pilot succeeds: add features.json with backlog of known flakes
3. Add skills/ directory with first procedure: repro-flaky-test

## Blocked
- (none)

## Recent context
- Team's known flaky tests are tracked in Issue #500 (epic).
- We're piloting on tests/auth/test_login_rate_limit.py first.
```

---

## Phase 1 — `DECISIONS.md` (initial entries)

```markdown
# Decisions

## 2026-05-26 — Phase 0 pre-flight completed

**Decision:** FlakyFixer = single-agent thin harness for fixing flaky auth tests.
Claude Agent SDK, Blueprint 01 (coding agent), no deviations.

**Reason:** Coding is the strongest co-training case; team works locally on laptops;
no external-effect tools needed in v1.

**Rejected alternative:** Multi-agent planner/generator/evaluator. Deferred until
we see false-positive "done" claims in production. Single agent + pre-stop hook
should suffice for v1.

**Constraint added to:** docs/harness-design.md and AGENTS.md.

**Expiry:** Re-evaluate at Phase 3 (or 100 sessions, whichever first).


## 2026-05-26 — Don't mock the database in integration tests

**Decision:** Integration tests must use the testcontainer in conftest.py, not mocks.

**Reason:** In Q1 we shipped a JSON-column migration that broke prod. Mocked tests
passed; the migration step itself wasn't covered. A 30-minute Slack incident.

**Rejected alternative:** Mock at the SQLAlchemy session boundary. Faster but
hides exactly the bugs the testcontainer catches.

**Constraint added to:** AGENTS.md hard constraint #2.

**Expiry:** Permanent until we have a separate migration-test step in CI.


## 2026-05-26 — SQLAlchemy 2.0 typed syntax for all new code

**Decision:** Every new DB query must use SQLAlchemy 2.0 typed syntax. Mixing 1.4
patterns is rejected at code review.

**Reason:** 3 type errors in past 2 weeks (issues #142, #156, #161) all caused by
1.4 vs 2.0 pattern confusion. Consistency reduces cognitive load.

**Rejected alternative:** Migrate everything to 2.0 in one big PR. Too risky;
would block other work ~1 week.

**Constraint added to:** AGENTS.md hard constraint #1 + docs/sqlalchemy-2-patterns.md.

**Expiry:** None — permanent until SQLAlchemy 3.0 lands.
```

---

## Phase 2 — `features.json` (after first week)

```json
[
  {
    "id": "FX01",
    "behavior": "test_login_rate_limit.py::test_429_after_5_attempts no longer flakes (was failing ~1 in 20 runs)",
    "verification": "pytest tests/auth/test_login_rate_limit.py::test_429_after_5_attempts --count=50",
    "state": "passing",
    "evidence": "commit b4d2f1e — 50 consecutive runs green",
    "notes": "Root cause: race in rate-limit counter reset, fixed by using Redis SETNX with TTL"
  },
  {
    "id": "FX02",
    "behavior": "test_session_expiry.py no longer flakes on macOS CI (was failing ~5%)",
    "verification": "pytest tests/auth/test_session_expiry.py --count=20",
    "state": "active",
    "evidence": null,
    "notes": "Suspect: freezegun vs system clock interaction on macOS"
  },
  {
    "id": "FX03",
    "behavior": "test_oauth_redirect.py timeout flakes resolved",
    "verification": "pytest tests/auth/test_oauth_redirect.py --count=30 --timeout=10",
    "state": "blocked",
    "evidence": null,
    "notes": "Blocked: requires OAuth sandbox env access; awaiting infra team"
  }
]
```

---

## Phase 2 — `permission_check.py` (excerpt — tier‑specific to this project)

```python
RISK_TIERS = {
    "read_file":          0,
    "grep":               0,
    "glob":               0,
    "edit_file":          1,
    "write_file":         1,  # used for new test files
    "bash":               2,  # gated to project root only
    "run_tests":          2,
    "docker_compose":     2,
    "git_commit":         2,
    "git_push":           3,  # explicitly HUMAN-only for v1; tool is registered but always denies
}

def permission_check(call, user):
    if call.name == "git_push":
        return Decision.DENY, "git push is human-only per AGENTS.md v1"
    if call.name == "bash":
        cmd = call.args.get("command", "")
        if "rm -rf /" in cmd:
            return Decision.DENY, "destructive command pattern blocked"
        if cmd.startswith("sudo "):
            return Decision.DENY, "sudo blocked in agent context"
    # ... standard tier check
```

---

## Phase 3 — Adding an independent evaluator (week 3+)

After 30 sessions, two false-positive "done" claims slipped through. Added evaluator:

```python
# In src/flakyfixer/orchestrator.py
async def fix_flaky_test(test_id):
    plan = await planner_agent.run(test_id)
    if plan.complexity == "high":
        plan = await await_human_approval(plan)

    for attempt in range(3):
        fix = await generator_agent.run(plan)
        # NOTE: evaluator is a DIFFERENT agent with explicit rubric
        grade = await evaluator_agent.run(
            artifact=fix,
            rubric=load_rubric("flaky-fix"),
        )
        if grade.lowest in ("A", "B"):
            return fix, grade
        plan = await planner_agent.replan(plan, grade.feedback)

    raise EvaluationFailed(f"3 attempts, lowest grade still {grade.lowest}")
```

`docs/rubric.md`:

```markdown
| Dimension          | A                  | B                | C            | D            |
|--------------------|--------------------|------------------|--------------|--------------|
| Root cause         | Identified + cited | Plausible + cited| Guessed      | Not addressed |
| Fix tested         | --count=50 green   | --count=20 green | Single run   | Untested     |
| Type safety        | mypy --strict 0    | 1-2 ignores      | 3+ ignores   | Errors       |
| Regression risk    | Tests added        | Existing tests   | Untouched    | Reduced      |
```

`DECISIONS.md` entry for this change:

```markdown
## 2026-06-08 — Add evaluator subagent

**Decision:** Three-agent architecture: planner / generator / evaluator. Evaluator
is a different Claude SDK ClaudeSDKClient with different system prompt + rubric.

**Reason:** 2 false-positive "done" claims in past 30 sessions. Single agent
graded its own work positively despite test_429 still flaking 1 in 30 runs.

**Rejected alternative:** Tighten the pre-stop hook to require --count=50 by
default. Considered but would slow every session; rubric-based eval lets us scale
the standard by risk.

**Constraint added to:** orchestrator.py + docs/rubric.md.

**Expiry:** Re-evaluate at Phase 4 launch (production rollout).
```

---

## What this teaches

1. **The artifacts compound.** AGENTS.md → harness-design.md → features.json → DECISIONS.md form a coherent record of *why* this project is the way it is. Six months later, a new engineer reading just these files knows the *why* without asking anyone.

2. **Constraints in AGENTS.md are surgical.** Five constraints, each traces to a specific incident (DECISIONS.md #2 / #3 / Issue #412). No "be careful with the database" generic advice.

3. **DECISIONS.md captures rejected alternatives.** A future engineer asking "why not mock the DB?" finds the answer in 30 seconds.

4. **The pre-stop hook is the linchpin.** Without it, the agent could claim "fixed" while flakes still happen. With it, "fixed" requires `make check` to exit 0 — including the integration tests that use the real DB.

5. **Phase 3 evaluator was added in response to specific failures, not preemptively.** The ratchet pattern in action.

---

## What you'd do differently for your project

- Replace project name, value prop, tech stack.
- Tier YOUR tools per your domain's risk profile.
- Author YOUR hard constraints from past incidents, not by copying these.
- The structure transfers; the contents don't.

The pattern is reusable. The specifics are project‑specific. **Always.**
