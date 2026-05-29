# 10 — Observability

The newest core component, and the most underrated. Without observability inside the harness, **30–50% of session time is wasted on redundant diagnosis** (walkinglabs lecture 11). Retries become blind guesses.

---

## Part 1 — Why observability belongs *inside* the harness

The mistake: treating agent logs as "just print statements." Symptoms:
- Ad‑hoc agent‑written debug prints scattered through tool output
- Inconsistent log formats across tool calls
- No way to answer "which step caused this divergence?"
- Evaluation without a rubric ("looks good to me")
- Retries that re‑try blindly because nothing was learned the first time

Observability becomes a **harness primitive** — built into the loop, not bolted on by the agent.

---

## Part 2 — Four core observability artifacts

| Artifact | What it captures | Lifetime |
|---|---|---|
| **Sprint Contract** | Pre‑coding negotiated scope + verification + exclusions | Per‑task |
| **Evaluator Rubric** | A/B/C/D scoring across dimensions | Per‑task type |
| **OpenTelemetry trace** | One trace per session, one span per task, sub‑spans per verification | Per‑session |
| **Task Trace** | Full decision‑path record (like distributed request tracing) | Per‑task, archived |

Together they answer the four production questions:
1. *What did we agree to do?* (Sprint Contract)
2. *How well did we do it?* (Evaluator Rubric)
3. *What happened in detail?* (OpenTelemetry trace)
4. *Why did the agent decide what it did?* (Task Trace)

---

## Part 3 — Sprint Contract

A **negotiated pre‑coding agreement.** The agent and user (or planner subagent and generator subagent) agree on what's in scope, what's verified, and what's explicitly excluded — before code is written.

### Template

```markdown
# Sprint Contract: Dark Mode Support

## Scope
- Modify the theme toggle component
- Update global CSS variables
- Add dark‑mode tests

## Verification Standards
- Visual regression tests pass
- Main flow e2e passes
- No FOUC (flash of unstyled content)

## Exclusions
- Not handling print styles
- Not handling third‑party iframes / dark mode they ship
- Not handling user OS‑level dark preference detection (future task)

## Acceptance evidence to capture
- screenshots/light-mode-current.png
- screenshots/dark-mode-current.png
- test output: tests/visual/dark-mode.spec.ts
```

Why this matters: without explicit scope + exclusions, the agent expands work (overreach) or under‑delivers (under‑finish). The contract makes "done" objectively gradable.

---

## Part 4 — Evaluator Rubric

A scoring table with dimensions and A/B/C/D thresholds, used by a separate evaluator agent or by a human reviewer.

### Example

```
| Dimension          | A                | B                | C              | D            |
|--------------------|------------------|------------------|----------------|--------------|
| Code correctness   | All tests pass   | Main flow passes | Partial pass   | Build fails  |
| Performance        | < 100ms p95      | < 300ms p95      | < 1s p95       | > 1s         |
| Code conventions   | Matches style    | Minor deviation  | Several issues | Inconsistent |
| Test coverage      | > 80%, e2e + unit| > 60%            | > 30%          | < 30%        |
| Documentation      | Updated + clear  | Updated          | Stale          | Missing      |
```

Rules:
- **Independent evaluator** (separate agent or human; not the generator).
- **Explicit grade per dimension**, not a single "looks good."
- **Lowest grade is the overall grade.** No averaging.
- **C or D triggers a re‑work cycle** with a new sprint contract; rubric grade is the trigger.

---

## Part 5 — OpenTelemetry as the harness's nervous system

Standard semantic conventions, one trace per session:

```
session-2026-05-25-abc123
├── task-F03-cart-pagination
│   ├── span: research (12s)
│   ├── span: plan (8s, peer‑reviewed)
│   ├── span: implement (4m12s)
│   │   ├── tool: read_file × 8
│   │   ├── tool: edit_file × 3
│   │   ├── tool: run_test × 2
│   │   └── tool: commit × 1
│   ├── span: verify
│   │   ├── L1 static (passed)
│   │   ├── L2 unit (passed)
│   │   └── L3 e2e (passed)
│   └── span: clock-out (15s)
└── task-F04-cart-cursor
    └── ...
```

What this enables:
- **Replay a session** to understand a decision path.
- **Diff two sessions** doing similar tasks to identify regressions.
- **Aggregate** to find systematic issues (e.g., "edit_file fails 12% of the time on tsx files").
- **Cost / latency analysis** per task / per tool.

Tag spans with: task ID, feature ID, model, model version, prompt tokens, completion tokens, tool name, exit status, cost.

---

## Part 6 — Task Trace

A **decision‑path record** richer than just timing. For each major agent decision, capture:

```
{
  "task_id": "F03",
  "timestamp": "2026-05-25T14:32:11Z",
  "decision_point": "tool_choice",
  "options_considered": ["grep", "ast_query", "open_file"],
  "chosen": "grep",
  "reason_inferred": "speed + filename pattern",
  "downstream_outcome": "found in 1 call",
  "alternative_outcome_estimate": "ast_query would have needed 2 calls"
}
```

You typically capture these via:
- **Hooks** at decision points (tool dispatch, subagent spawn, terminate).
- **The model's own reasoning trace** (if available — Claude / Opus extended thinking).
- **Diff against prior decisions** on similar tasks.

This is the basis for **harness improvement loops** — analyze traces, find decisions that consistently lead to bad outcomes, fix the harness.

---

## Part 7 — Cost meter

Every harness in production should track cost per session and per task. Categories:

| Cost | Source |
|---|---|
| **Input tokens** | Prompt assembly (system + tools + memory + history + user) |
| **Output tokens** | Model responses + tool calls |
| **Cache hits** | Anthropic prompt caching — major savings if used |
| **Tool execution** | External APIs (search, image gen), compute |
| **Storage** | Memory DB, trace storage |

A common production discovery: **memory + tools dominate input tokens**, not the user message. Tracking by category surfaces this — and gives you a clear path to optimize (e.g., turn on prompt caching, prune unused MCP servers).

---

## Part 8 — The agent‑observability feedback loop

Long‑term, the most valuable use of observability is **agent‑driven harness improvement.**

```
   Trace archive
         │
         ▼
   ┌─────────────────────┐
   │ Trace analysis      │  ← can be an agent ("analyze last 30 days
   │  agent              │     of failures, identify top 3 systemic issues")
   └─────────┬───────────┘
             ▼
   ┌─────────────────────┐
   │ Proposed harness    │  ← changes to AGENTS.md, hook scripts,
   │ change PR           │     tool descriptions, etc.
   └─────────┬───────────┘
             ▼
   ┌─────────────────────┐
   │ Human review        │  ← R.P.I. plan‑review applies here too
   └─────────┬───────────┘
             ▼
   ┌─────────────────────┐
   │ Harness change      │
   │ deployed            │
   └─────────────────────┘
```

This is what Addy Osmani points to as the near future: *"agents analyzing traces to identify and fix harness‑level failures."*

The dominant pattern today: humans do the trace analysis manually. The dominant pattern in a year: traces feed back into the harness.

---

## Part 9 — Where observability lives in the loop

```
1. Prompt Assembly         → log: tokens by category, model, mode
2. LLM Inference           → log: latency, tokens out, cost
3. Classify Output         → log: tool calls count, type
4. Tool Execution          → log: per‑call latency, exit status, sandbox info
5. Result Packaging        → log: result size, error class
6. Context Update          → log: window % full, compaction triggered?
7. Loop                    → log: turn count, cumulative cost

Plus:
- Session start / clock‑in → snapshot of PROGRESS.md, DECISIONS.md state
- Session end / clock‑out  → diff vs start; quality scorecard
- Verification spans       → L1/L2/L3 pass/fail with timings
- Hook executions          → which hooks fired, what they enforced
```

Every step of the 7‑step loop emits a span. Costs that aren't measured can't be optimized.

---

## Part 10 — Anti‑patterns

| Anti‑pattern | Why it fails |
|---|---|
| Agent‑printed debug logs in tool output | Pollutes context; format inconsistent across calls |
| Evaluator without a rubric | "Looks good to me" — biased; not actionable |
| Skipping the Sprint Contract for "small tasks" | Scope creep; "done" is undefined |
| Tracing without tagging by feature / task / model | Aggregations don't work; can't diagnose patterns |
| Storing traces in the application DB | Mixed access patterns hurt; use a trace store (Honeycomb, Tempo, Jaeger) |
| Logging individual tool calls only | Misses the *session‑level* story |
| No cost meter | You can't optimize what you don't measure; cost explosions catch you blind |
| Treating observability as "for later, after MVP" | The hardest things to add later — every decision worth observing is happening now |

---

## Part 11 — Minimum viable observability

If you can ship only three things in v1:

1. **Per‑session OpenTelemetry trace** with tags for task, model, cost.
2. **Sprint Contract** template that every non‑trivial task references.
3. **`pre-stop` hook** that prevents termination with a failing verification command (this is itself an observability primitive — it surfaces the "agent claimed done while broken" event).

Add Evaluator Rubric and Task Trace once you have at least a week of trace data to inform what to capture.

---

## Cross‑references

- The verifications that observability covers: `08-verification-and-termination.md`
- The state files the trace references: `07-state-and-persistence.md`
- Hooks as the wiring mechanism: `05-tools-and-skills.md` (Part 8)
- Where observability falls in framework comparisons: `../framework-comparison.md`
