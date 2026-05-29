# Anti‑Patterns

A consolidated catalog of failure modes documented across all five sources. Use this as a checklist when reviewing a harness or debugging an agent that "demos but doesn't ship."

Each anti‑pattern lists: **what it looks like → why it fails → fix**.

---

## Context anti‑patterns

### A1. Monolithic `AGENTS.md`

**Looks like:** One 500‑line file with all rules, deployment guides, conventions, and history.
**Fails because:** Critical rules drift mid‑file → "Lost in the Middle." Models miss line‑300 security rules. Burns context on irrelevant content.
**Fix:** ≤80 lines for `AGENTS.md`. Move topic content to `docs/<topic>.md`, reference by name with progressive disclosure.

### A2. LLM‑generated `AGENTS.md`

**Looks like:** A file written by Claude / Codex itself.
**Fails because:** ETH research — degrades performance AND costs ~20% more in inference.
**Fix:** Human‑written. Each line traces to a specific incident or hard constraint.

### A3. Front‑loading rules pre‑emptively

**Looks like:** Adding "the model might forget to X" rules without an incident proving it does.
**Fails because:** Rule explosion. Rules conflict. Instruction budget ("dumb zone") triggers.
**Fix:** Ratchet pattern — only add a rule when a specific failure proves it's needed.

### A4. Stale memory acted on without verification

**Looks like:** Agent reads "the deploy script is at `scripts/deploy.sh`" from memory and runs it without checking.
**Fails because:** File moved months ago; agent fails confidently. Or worse: file *exists* but is now wrong.
**Fix:** Memory is a hint. Verify against actual state before acting. `ls scripts/` first.

### A5. Loading raw files into context

**Looks like:** `cat large_log.txt` as a tool call to give the model "everything."
**Fails because:** Burns context; rest of the loop's reasoning window shrinks; if relevant chunk is mid‑content, attention drops.
**Fix:** `grep`, `glob`, `head`, `tail`. Load by reference, resolve only what's needed.

### A6. Loading all MCP servers globally

**Looks like:** Configure every available MCP at every project.
**Fails because:** Context fills with tool definitions; cost rises; trust risk grows.
**Fix:** Per‑project MCP selection. Disconnect unused. Use search‑based loading if the harness supports it.

---

## Loop anti‑patterns

### B1. The half‑loop

**Looks like:** Harness that only owns steps 1–3 (assemble / call / classify). Tool execution and packaging happen ad hoc.
**Fails because:** Inconsistent error packaging, forgotten context updates, missed permission checks.
**Fix:** A real harness owns all 7 steps. If your "harness" doesn't, it's a prompt wrapper.

### B2. No max‑turn cap

**Looks like:** `while True:` with no break condition.
**Fails because:** Cost / context explosion when the model gets stuck.
**Fix:** Hard cap (50–200 turns), token budget cap, cost cap.

### B3. Mixing read and mutate concurrency

**Looks like:** Parallel `edit_file` calls.
**Fails because:** Race conditions; later edits silently win or corrupt state.
**Fix:** Read tools parallel, mutate tools serial. Most SDKs surface this as a flag.

### B4. Treating tool errors as crashes

**Looks like:** Tool throws → loop dies.
**Fails because:** Loses entire session over a transient blip the model could've worked around.
**Fix:** Tool errors are LLM‑recoverable — return as `ToolMessage(error)` so the model adapts.

---

## State / persistence anti‑patterns

### C1. No persistence between sessions

**Looks like:** Every session starts blind to past work.
**Fails because:** 15+ minute rebuild cost per session. Completion drops ~58% on multi‑session tasks (walkinglabs data).
**Fix:** `PROGRESS.md` + `DECISIONS.md` + `features.json` + clock‑in/out routines.

### C2. `PROGRESS.md` updated only at session end

**Looks like:** Agent writes progress as the last action.
**Fails because:** Mid‑session crash → state lost. Re‑run replays already‑done work.
**Fix:** Progress updates *during* the session (after each feature transition), not only at end.

### C3. `DECISIONS.md` without rejected alternatives

**Looks like:** "We chose SQLAlchemy 2.0." End of entry.
**Fails because:** Next session re‑debates the decision. Junior engineer asks "why not 1.4?" Nobody remembers.
**Fix:** Always log the rejected alternative + the reason. Without the *why*, the rule is unmaintainable.

### C4. Agents self‑transition feature state

**Looks like:** Agent flips a feature from `active` to `passing` without running the verification command.
**Fails because:** "Done" becomes meaningless. Multi‑session completion rate collapses.
**Fix:** State changes are gated on verification command exit 0. Agent cannot self‑transition.

### C5. Knowledge in Confluence / Slack / Notion / heads

**Looks like:** "Just ask Sarah, she knows the deployment quirks."
**Fails because:** Invisible to the agent. New sessions can't recover the context.
**Fix:** Repo as system of record. Migrate critical knowledge into `docs/` or module‑local `ARCHITECTURE.md`.

### C6. Empty‑directory project start

**Looks like:** "Just have the agent set up the project."
**Fails because:** Implicit assumption landmines — missing test config, no Makefile, deployment never tested. Recovery cost is 3–4 sessions later.
**Fix:** Initialization phase with Startup Readiness Checklist (walkinglabs lecture 6).

---

## Tool / skill anti‑patterns

### D1. Fifty overlapping tools

**Looks like:** `git_status`, `git_diff`, `git_log`, `git_branch`, ... 30+ tools.
**Fails because:** Model attention dilutes. Disambiguation fails. Manus removed exactly these in its 5 rewrites.
**Fix:** Bash + a small set of tools that bash *can't* do safely (mutations that need gating, payments, etc.).

### D2. Vague tool descriptions

**Looks like:** "Does various things with files."
**Fails because:** Search‑based discovery breaks. Model can't decide when to use it.
**Fix:** Specific, keyword‑rich descriptions. Mention triggering verbs ("deploy", "ship", "rollback").

### D3. Skills wrapping single bash calls

**Looks like:** A SKILL.md whose only action is `ls -la`.
**Fails because:** Pure overhead. The skill loading machinery costs more than the tool call.
**Fix:** Skills are for multi‑step procedures with referenced scripts / files. Single calls stay as tools.

### D4. LLM‑generated tool descriptions

**Looks like:** Same problem as A2 — the model wrote its own tool docs.
**Fails because:** Same ~20% inference overhead and performance degradation.
**Fix:** Human‑written, specific, keyword‑rich.

---

## Subagent anti‑patterns

### E1. Subagent without verification

**Looks like:** Spawn subagent, take its output at face value.
**Fails because:** Three subagents hallucinate in parallel. Worse than one.
**Fix:** Independent evaluator subagent + rubric, or verification command on the returned artifact.

### E2. Fan‑out without synthesis

**Looks like:** 3 subagent summaries dumped into context, no consolidator.
**Fails because:** Three answers, no decision. Main agent has to reason over conflicting summaries with no judge.
**Fix:** Synthesis step (often: a frontier‑model judge that consolidates).

### E3. Pipeline with all same agent type

**Looks like:** UX subagent, Architect subagent, Devil's Advocate subagent — all running the same generic prompt.
**Fails because:** Doesn't add perspective; just delays.
**Fix:** Each stage has a distinct role / prompt that genuinely changes the analysis lens.

### E4. Subagent inherits full parent context

**Looks like:** Fork pattern used for *everything*, including independent investigations.
**Fails because:** Defeats the purpose — context isolation was the value of using a subagent.
**Fix:** Use Worktree or Teammate for isolated work. Fork only when shared context genuinely helps.

### E5. Recursive subagent spawning with no depth limit

**Looks like:** Subagent spawns subagent spawns subagent.
**Fails because:** Cost explosion. Debugging becomes near‑impossible.
**Fix:** Cap recursion depth (typically 2). Surface the cap to the model so it plans within it.

---

## Verification anti‑patterns

### F1. Mock‑only verification

**Looks like:** Unit tests with mocked DB/network/auth pass; agent declares done.
**Fails because:** Boundaries are where defects live (walkinglabs Electron case — 5 defects all passed unit tests, all failed e2e).
**Fix:** L1 + L2 + **L3 e2e** mandatory on cross‑component changes.

### F2. Self‑evaluation

**Looks like:** Agent grades its own output ("looks good to me").
**Fails because:** Bias positive on own work. Same model can't independently grade — it has the same blind spots.
**Fix:** Separate evaluator agent OR a different model OR human review against a rubric.

### F3. No `pre-stop` hook

**Looks like:** Loop ends whenever the model claims it's done.
**Fails because:** Premature victory. Failing tests / broken builds slip through.
**Fix:** `pre-stop` hook runs `make check` (or equivalent) and rejects termination on failure.

### F4. Refactoring before core verification

**Looks like:** Agent finishes feature, then refactors adjacent code, then declares done.
**Fails because:** Refactor breaks the verification surface. "Mostly working" gets shipped.
**Fix:** Sequence rule — green the feature first, refactor as a separate feature.

### F5. Single‑level termination

**Looks like:** Build passes → done.
**Fails because:** Tests can degrade independently of build (walkinglabs: build 100% → 68% over 12 weeks with tests dropping 100% → 61%).
**Fix:** Build pass + test pass + e2e pass — all separately tracked.

---

## Quality / cleanup anti‑patterns

### G1. "Clean up later"

**Looks like:** TODOs, dead code, console.logs, debug branches left at session end.
**Fails because:** Compounds — Codex finding: agents copy existing patterns and propagate suboptimal code.
**Fix:** Session Exit Checklist; `pre-commit` hook blocks debug code.

### G2. One‑time quality assessment

**Looks like:** Assessed quality at project start, never since.
**Fails because:** Drift is invisible. Build pass rates can degrade silently.
**Fix:** Periodic (weekly) Quality Document — score each module A–C on multiple dimensions.

### G3. Treating build pass as health

**Looks like:** "CI green = healthy project."
**Fails because:** Tests can rot independently. Startup time can rot. Type coverage can rot. (walkinglabs: 5 min → 60 min startup over 12 weeks.)
**Fix:** Track at least: build pass rate, test pass rate, startup time, lint warnings, type coverage. Periodically.

---

## Permission / safety anti‑patterns

### H1. Single‑stage permission

**Looks like:** One trust‑all decision at project start.
**Fails because:** Over‑prompts (fatigue) → users approve everything OR under‑prompts → risky calls slip through.
**Fix:** Three‑stage gate: trust establishment + per‑call permission + per‑risky‑op confirmation. Risk tiers.

### H2. No timeout on tool execution

**Looks like:** Bash call hangs indefinitely.
**Fails because:** One stuck tool freezes the loop.
**Fix:** Default timeout per tool + per‑category override.

### H3. Sandbox without network policy

**Looks like:** Agent can call any URL from inside the sandbox.
**Fails because:** Exfiltration risk via prompt injection.
**Fix:** Outbound network allow‑list. Egress filtering at sandbox boundary.

### H4. Credentials in the sandbox

**Looks like:** LLM API key / user OAuth tokens stored in the agent's working directory.
**Fails because:** Sandbox compromise = credential leak.
**Fix:** Mendral pattern — loop outside sandbox; credentials live with the loop. Sandbox has only narrow RPC interface.

---

## Observability anti‑patterns

### I1. Agent‑printed debug logs

**Looks like:** Tool output cluttered with print statements the agent added.
**Fails because:** Pollutes context. Format inconsistent across calls. No aggregation possible.
**Fix:** Harness emits structured spans (OpenTelemetry). Agent stays out of logging.

### I2. Evaluator without rubric

**Looks like:** "I asked another agent if the output was good. It said yes."
**Fails because:** Biased. Not actionable. Can't aggregate.
**Fix:** Explicit A/B/C/D rubric across dimensions. Lowest grade wins.

### I3. No Sprint Contract for "small tasks"

**Looks like:** "Just fix this typo" → ends up with 10 unrelated changes.
**Fails because:** Scope creep. "Done" undefined.
**Fix:** Even small tasks get a 3‑line contract. Scope + verification + exclusions.

### I4. No cost meter

**Looks like:** Monthly invoice surprises.
**Fails because:** Optimization is blind. Cost regressions caught only via billing.
**Fix:** Per‑session cost tracking, tagged by feature/task/model. Surface to user during session.

---

## Architectural anti‑patterns

### J1. Inside‑sandbox loop for multi‑user SaaS

**Looks like:** Claude‑Code‑style architecture but exposed as a hosted service to many users.
**Fails because:** Distributed filesystem consistency nightmare; credential blast radius too large.
**Fix:** Outside‑sandbox loop with Mendral pattern (durable exec + lifecycle + path dispatch).

### J2. Outside‑sandbox loop for single‑user local tool

**Looks like:** Building Claude Code clone with a separate backend service.
**Fails because:** Massive overengineering. Latency hit. Operational cost.
**Fix:** Inside‑sandbox is fine for single‑user local.

### J3. Thick harness for a domain the model is co‑trained on

**Looks like:** Encoding "how to write Python" logic in a graph for a coding agent.
**Fails because:** Scaffolding doesn't come down. Each new model release degrades your harness.
**Fix:** Thin harness for coding — trust the model.

### J4. Thin harness for novel domain with no model co‑training

**Looks like:** "Just trust Claude" for fashion outfit composition.
**Fails because:** Model wasn't trained on your domain primitives. Quality varies wildly.
**Fix:** Thicker harness with explicit logic until model coverage catches up. Re‑evaluate per release.

---

## How to use this catalog

1. When a harness underperforms, scan this list for the failure pattern.
2. When designing a new harness, run through these as a pre‑mortem.
3. When code‑reviewing a harness change, check the change isn't introducing one.

Every anti‑pattern here is **traceable to a specific source** (Akshay PDF, Alex Ker PDF, Mendral, Addy Osmani, walkinglabs). See `source-synthesis.md` for the cross‑reference.
