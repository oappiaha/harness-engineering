# 08 — Verification and Termination

The single biggest dividing line between **demo agents** and **production agents.** Boris Cherny (creator of Claude Code): *"giving the model a way to verify its work improves quality by 2 to 3×."*

This doc covers: how to define "done," how to validate it, and how to terminate cleanly.

---

## Part 1 — The math

A 10‑step process with 99% per‑step success has only **~90.4% end‑to‑end success.**

| Per‑step | End‑to‑end (10 steps) | End‑to‑end (50 steps) |
|---|---|---|
| 99% | 90.4% | 60.5% |
| 95% | 59.9% | 7.7% |
| 90% | 34.9% | 0.5% |

Without verification loops, you compound the error. With verification loops, you catch and correct — restoring per‑step success to near‑100%.

---

## Part 2 — Definition of Done

The first artifact. Without an explicit, verifiable DoD, "done" means "the agent stopped."

### DoD template (in `AGENTS.md` or per‑feature)

```markdown
## Definition of Done — F03 (Cart pagination)
- New endpoint: GET /api/cart?cursor=<token>&limit=20
- Default page size: 20 items
- Highlighted snippets included in response
- All new code passes pytest tests/cart/
- mypy --strict passes
- E2E test passes: `make e2e CART`
- Updated docs/api.md
```

Each item is **executable or observable** — not "the API is fast enough" (vague) but "p95 latency < 300ms under `make load-test`" (verifiable).

---

## Part 3 — Three‑layer termination validation

> **Replace agent subjective judgment with externalized, execution‑based termination validation.**

The agent must pass three layers, **in order**, before declaring done:

```
   ┌──────────────────────────────────────┐
   │  Layer 1 — SYNTAX / STATIC ANALYSIS  │
   │  • type checks                       │
   │  • linters                           │
   │  • compile / parse                   │
   └──────────────────┬───────────────────┘
                      ▼  (must pass before L2)
   ┌──────────────────────────────────────┐
   │  Layer 2 — RUNTIME BEHAVIOR          │
   │  • unit tests                        │
   │  • integration tests                 │
   │  • module‑level execution            │
   └──────────────────┬───────────────────┘
                      ▼  (must pass before L3)
   ┌──────────────────────────────────────┐
   │  Layer 3 — SYSTEM‑LEVEL END‑TO‑END   │
   │  • full stack execution              │
   │  • UI interaction (Playwright/etc.)  │
   │  • cross‑service flows               │
   └──────────────────────────────────────┘
```

**Skipping a required level = Not Complete.** No exceptions.

---

## Part 4 — Why end‑to‑end testing changes results

Unit tests create **blind spots** agents exploit. Five real defects (walkinglabs lecture 10 — Electron file‑export case) all **passed unit tests** and all **failed e2e**:

1. Interface mismatch between renderer and main process
2. State propagation lag across IPC boundary
3. Resource leak in file handle cleanup
4. Permission gap on first export
5. Error propagation broken across process boundary

The pattern: unit tests mock the boundary. Boundaries are where defects live.

> **Only full system execution catches interaction defects.**

For UI work, this means: actually open the page in a real browser (Playwright, Puppeteer, real device), take screenshots, validate the interaction. Don't trust unit tests to certify a UI works.

---

## Part 5 — Three verification approaches (Anthropic)

| Approach | Mechanic | Best for |
|---|---|---|
| **Rules‑based feedback** | Tests, linters, type checkers, e2e suites — fast, deterministic | Coding tasks, anything with an executable spec |
| **Visual feedback** | Screenshots via Playwright; image diff | UI tasks, design verification |
| **LLM‑as‑judge** | A separate subagent scores the output against a rubric | Open‑ended outputs (writing, design, summarization) |

**Use all three when applicable.** They cover different failure modes:
- Rules‑based catches *broken*.
- Visual catches *wrong‑looking*.
- LLM judge catches *not‑what‑was‑asked‑for*.

---

## Part 6 — Actionable error feedback

Errors that just say "Test failed" leave the agent guessing. Errors must say what's wrong + why + what to do.

### Bad error feedback

```
ERROR: Test failed.
```

### Good error feedback

```
ERROR: POST /api/reset-password returned 500
WHY:   Email service config is missing in env vars (SMTP_HOST, SMTP_USER)
FIX:   Add to .env.local. Template at templates/reset-email.html.
       Reproduce: `pytest tests/api/test_reset_password.py::test_happy_path`
```

The format every error message should follow:

```
ERROR: [what went wrong, observable]
WHY:   [root cause, your best inference]
FIX:   [concrete, agent‑executable next step]
```

Wire this into tools, hooks, and test runners.

> *"Success is silent, failures are verbose."* — Addy Osmani

---

## Part 7 — Hooks for enforced termination

The harness — not the model — should enforce termination conditions. Common hook points:

| Hook | What it enforces |
|---|---|
| `pre-stop` | Block agent from terminating if tests fail / build broken / debug code present |
| `pre-commit` | Block commits containing `console.log`, `debugger`, `TODO/FIXME`, debug flags |
| `post-edit` | Run formatter + type check; if failing, surface as actionable error |
| `pre-tool-call` (destructive) | Require explicit user confirmation |

A `pre-stop` hook that runs `make check` and rejects termination on failure is the **single most valuable hook for production agents.** It removes the "agent declares done while broken" failure entirely.

---

## Part 8 — Ralph Loops — for tasks longer than one context window

When a task is too large for a single context window, the loop must survive resets. Anthropic's **Ralph Loop**:

```
Phase 1 — Initializer Agent (one time):
  ├─ set up environment (init script)
  ├─ create progress file (PROGRESS.md)
  ├─ create feature list (features.json)
  └─ initial git commit

Phase 2 — Coding Agent (every subsequent session):
  ├─ read git log
  ├─ read PROGRESS.md + DECISIONS.md
  ├─ pick highest‑priority incomplete feature
  ├─ work the regular loop
  ├─ verify (the three layers above)
  ├─ commit
  └─ update PROGRESS.md
       │
       └─ optional: hook intercepts the agent's "done" claim
                    and forces continuation if more features remain
```

> *"Hooks intercept completion attempts, re‑inject original prompts in fresh windows, forcing continuation against completion goals while maintaining state through filesystem."* — Addy Osmani

**The filesystem provides continuity across context windows.** A Ralph Loop turns multi‑week work into a sequence of independently completable sessions.

---

## Part 9 — WIP = 1 (one feature active at a time)

(walkinglabs lecture 7)

When agents "also refactor feature B while implementing feature A," verified completion craters. Strict WIP=1:

```markdown
## Work Rules (in CLAUDE.md / AGENTS.md)
- Work on one feature at a time
- Only start the next feature after the current one passes end‑to‑end verification
- Don't "also refactor" anything while implementing
- If an unrelated issue is discovered, file it in features.json (state: not_started) and move on
```

### Data (walkinglabs)

| Setup | Code | Files touched | E2E pass rate |
|---|---|---|---|
| 5 parallel features | 800 lines | 12 | 20% |
| WIP=1 | 200 lines | 4 | 100% |

87.5% verified completion vs. 37.5%. The numbers compound across weeks.

The exception: **subagents** are not WIP violations. A subagent doing parallel investigation returns a summary that the main agent uses on its single active feature.

---

## Part 10 — Premature victory anti‑patterns

| Anti‑pattern | Counter |
|---|---|
| Agent says "this should work" without running it | `pre-stop` hook runs the verification command |
| Refactoring before core verification | Sequence rule: ship the feature green, refactor as a separate active feature |
| Treating unit‑test pass (with mocks) as completion | L3 e2e is mandatory if cross‑component change |
| Agent self‑evaluation | Independent evaluator subagent + rubric |
| Mocking the database in integration tests | Use a real DB (or testcontainer); mocks hide migration breaks |
| "I'll clean up later" | Session exit checklist enforces clean state |

---

## Part 11 — Clean‑state session exit (walkinglabs lecture 12)

Completion = task verification **AND** clean state. Entropy compounds without cleanup.

### Session Exit Checklist (in `AGENTS.md`)

```markdown
## Session exit checklist
- [ ] Build passes (`make check` or `npm run build`)
- [ ] All tests pass (`make test`)
- [ ] Feature list updated (state transitions reflect reality)
- [ ] No debug code remaining (console.log, debugger, TODO that wasn't there before)
- [ ] Standard startup path available (`make dev` works)
- [ ] PROGRESS.md updated with new state
- [ ] Committed
```

### Idempotent cleanup ops

```bash
rm -f /tmp/debug-*.log
git checkout -- .env.local       # restore env if accidentally edited
npm run test
```

### Dual‑mode cleanup

- **Per session** (immediate): the exit checklist above.
- **Periodic** (weekly): a full scan + benchmark — track build pass rate, test pass rate, startup time, lint warnings. This is the **Quality Document** (see `07-state-and-persistence.md`).

Why both? Per‑session prevents new debt. Periodic catches drift that single sessions miss.

> Without cleanup discipline (walkinglabs data): build pass 100% → 68%, tests 100% → 61%, startup 5 min → 60+ min over 12 weeks.

---

## Part 12 — Termination conditions (recap)

The seven layered exit conditions:

| # | Condition | Source |
|---|---|---|
| 1 | Model produced response with no tool calls | Natural end |
| 2 | Max turn limit exceeded | Safety net |
| 3 | Token budget exhausted | Cost guardrail |
| 4 | Guardrail tripwire fires | Safety system |
| 5 | User interrupts | Streaming cancel |
| 6 | Safety refusal returned | Model declined |
| 7 | `pre-stop` hook blocks ("not actually done") | Production rigor |

Conditions 1, 2, 5, 6 are mechanical. Conditions 3, 4 are policy. Condition 7 is **the production differentiator.**

---

## Part 13 — Verification‑aware harness skeleton

```python
def harness_loop(user_prompt):
    history = [system_prompt, user_prompt]
    for turn in range(MAX_TURNS):
        response = llm(assemble(history))
        if not response.tool_calls:
            # Model wants to terminate. Run pre-stop hook.
            if not run_hook("pre-stop", history):
                history.append(hook_error_as_tool_message())
                continue              # force model to continue
            return response.text       # truly done

        for call in response.tool_calls:
            result = execute_tool(call)
            history.append(result)
            if run_hook("post-tool-call", call, result) == "halt":
                return "halted"        # tripwire fired
    return "max-turns-exceeded"
```

The `pre-stop` hook is what enforces actual completion vs. declared completion. Without it, the loop ends whenever the model says it's done — which is exactly how premature‑victory failures slip through.

---

## Cross‑references

- The loop these checks run inside: `03-loop-in-motion.md`
- Hooks that enforce these checks: `05-tools-and-skills.md` (Part 8)
- State updated by the exit checklist: `07-state-and-persistence.md`
- Subagents for independent evaluation: `06-subagents.md`
- Observability that proves these checks ran: `10-observability.md`
