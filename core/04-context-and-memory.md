# 04 — Context and Memory

The two failure modes most agents hit before anything else:
1. **Context rot:** important content drifts mid‑window and the model stops attending to it.
2. **Stale memory:** the agent acts on a remembered fact that is no longer true.

This doc covers both, plus the techniques to manage them.

---

## Part 1 — The context problem

### Context rot is empirical

| Source | Finding |
|---|---|
| [Chroma "Context Rot" study](https://www.morphllm.com/context-rot) | 18 frontier models (GPT‑4.1, Claude Opus 4, Gemini 2.5, etc.) tested; all degrade as input length grows. Three mechanisms: "lost‑in‑the‑middle," attention dilution, distractor interference |
| Stanford (Liu et al., ["Lost in the Middle"](https://arxiv.org/abs/2307.03172)) | U‑shaped attention curve; ~30% accuracy drop when key content is in middle |
| HumanLayer (Kyle) | Frontier models follow only a few hundred instructions before entering the "dumb zone" |
| [ETH Zurich study](https://www.marktechpost.com/2026/02/25/new-eth-zurich-study-proves-your-ai-coding-agents-are-failing-because-your-agents-md-files-are-too-detailed/) | LLM‑generated AGENTS.md files: **~3% performance drop** (small), **>20% cost increase** (large), **2–4 extra reasoning steps**. Tested on Sonnet‑4.5, GPT‑5.2, Qwen3‑30B across AGENTBENCH |

> **Even million‑token windows suffer instruction‑following degradation as context grows.** Bigger windows are not a substitute for context engineering.

### The instruction budget

Every token in your system prompt, tool definitions, and memory files is **injected on every turn.** Multiply by turn count, multiply by sessions per user — context economics are real.

Alex Ker's rule: **every token in `AGENTS.md` should fight for its place.**

Practical limits:
- `AGENTS.md` / `CLAUDE.md`: keep ≤ 60–200 lines. **Note on the 60‑line claim:** HumanLayer's [writing‑a‑good‑claude.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) cites this as *their internal practice*, not a published hard standard — their own framing: *"general consensus is that < 300 lines is best, and shorter is even better. At HumanLayer, our root CLAUDE.md file is less than sixty lines."* Treat 60 as a directional target. walkinglabs gives 50–200 as a more typical range.
- Topic docs in `docs/`: 50–150 lines each.
- OpenAI Codex hard cap on cascading `AGENTS.md`: **32 KiB**.

---

## Part 2 — Five strategies for context management

### A. Compaction

Summarize conversation history when approaching the context limit. **Claude Code preserves architectural decisions and unresolved bugs while discarding redundant tool outputs.**

Good compaction is opinionated — it knows what's load‑bearing.

### B. Observation masking (JetBrains Junie)

Hide old tool *outputs* while keeping tool *calls* visible. This preserves the audit trail of *what was done* without bloating context with stale payloads.

### C. Just‑in‑time retrieval

Maintain **lightweight identifiers** (paths, IDs, queries). Load data dynamically.

Claude Code's pattern: use `grep`, `glob`, `head`, `tail` rather than reading full files. Only resolve to full content when the model needs it.

### D. Sub‑agent delegation

Each subagent explores extensively but returns **only 1,000–2,000 token condensed summaries**. The main agent never sees the raw exploration.

(Two patterns — fan‑out and pipeline — covered in `06-subagents.md`.)

### E. Progressive disclosure

The dominant industry convergence in 2026. Three variants:

| Surface | Mechanism |
|---|---|
| **CLIs** | Agent runs `mycli --help`, then `mycli deploy --help`, drilling in only as needed — like a human would. |
| **Skills** | At startup, only `name` + `description` of each skill loaded. Full `SKILL.md` body loaded only when the model decides the skill is relevant. (Claude Code, Codex, OpenCode all converged here.) |
| **MCP tools** | Claude Code: lightweight index at startup, full schemas loaded on demand → **~85% context reduction** (~77K → ~8.7K tokens) plus accuracy gains (Opus 4 49→74%, Opus 4.5 79.5→88.1%). Source: [Anthropic — Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use). Codex / OpenCode currently load all tool definitions at startup; OpenCode docs warn users to limit which servers they enable. |

The hard rule: **write tool / skill descriptions that are specific and keyword‑rich** so search‑based discovery actually works.

Deep dive on skills → `05-tools-and-skills.md`.

---

## Part 3 — The Anthropic goal statement

> *Find the smallest possible set of high‑signal tokens that maximize likelihood of the desired outcome.* — Anthropic context engineering guide

This is the **objective function** of context engineering. Memorize it. Every context decision should reference it.

---

## Part 4 — Memory: multiple timescales

### Short‑term vs long‑term

| Type | Timescale | Storage |
|---|---|---|
| **Short‑term** | Within a single session | Conversation history |
| **Long‑term** | Across sessions | Files / DB / Vector store |

### Implementations across frameworks

| Framework | Long‑term memory |
|---|---|
| **Anthropic (Claude Code)** | `CLAUDE.md` (manual) + `MEMORY.md` (auto‑generated) project files |
| **LangGraph** | Namespace‑organized JSON Stores |
| **OpenAI** | Sessions backed by SQLite or Redis |

### Claude Code's three‑tier hierarchy

```
   Tier 1: Lightweight index            ← always loaded
      • ~150 chars per entry
      • Names + descriptions
   ┌─────────────────────────────┐
   ▼
   Tier 2: Detailed topic files         ← pulled on demand
      • Full SKILL.md, full memory file
      • Loaded when model decides relevant
   ┌─────────────────────────────┐
   ▼
   Tier 3: Raw transcripts              ← search only
      • Never loaded as bulk
      • Accessed via grep / search
```

**Critical design principle:**

> **The agent treats its own memory as a *hint* and verifies against actual state before acting.**

A memory entry that says "the deploy script lives at `scripts/deploy.sh`" is *not authoritative*. It's a hint. The agent verifies via `ls scripts/` before relying on it. Memory entries from weeks ago may be wrong.

---

## Part 5 — What to write into long‑term memory

Categories that survive the test of time:

| Category | Example | Why it lasts |
|---|---|---|
| **User profile** | "Senior Go engineer, new to React" | Stable trait that shapes future explanations |
| **Feedback / corrections** | "Don't mock the database — got burned last quarter" | Learned constraint, includes *why* |
| **Project facts** | "Merge freeze begins 2026‑03‑05 for mobile release" | Dated; check expiry before applying |
| **External references** | "Pipeline bugs tracked in Linear project INGEST" | Pointer to ground truth, not the truth itself |

**What NOT to memorize:**
- Code patterns / file paths / structure — derive from current state.
- Git history / who‑changed‑what — `git log` is authoritative.
- Debugging recipes — the commit message has the context.
- Ephemeral task state — that's what plans and tasks are for.

These exclusions apply *even when the user explicitly asks you to save them.* If asked to save a PR list, ask what was *surprising or non‑obvious* — that's the keepable part.

---

## Part 6 — The lean‑.md philosophy vs many‑.md reality

A surface contradiction in the sources:

- **Alex Ker:** keep `AGENTS.md` lean (~60 lines).
- **walkinglabs:** maintain `AGENTS.md` + `PROGRESS.md` + `DECISIONS.md` + `ARCHITECTURE.md` + `CONSTRAINTS.md` + `docs/api-patterns.md` + ...

These are **not contradictory.** The reconciliation:

| File | Loaded when |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | **Always** — at session start |
| `PROGRESS.md` | At clock‑in (session start); explicit pull |
| `DECISIONS.md` | At clock‑in or when a design question arises |
| `docs/api-patterns.md` | When adding endpoints (referenced from `AGENTS.md`) |
| `docs/database-rules.md` | When touching DB code |
| `docs/testing-standards.md` | When writing / debugging tests |

**Lean ≠ few.** Lean means the *always‑loaded* file is small. The other files exist but load only when relevant — that's progressive disclosure.

`AGENTS.md` should be a **landing page** that lists what other files exist, with names descriptive enough that the agent can match them to its current task without reading their bodies first.

---

## Part 7 — `AGENTS.md` skeleton (synthesized from all sources)

```markdown
# Project name (one line)

One‑to‑two sentence description of what this project is and who uses it.

## First run
- Install: `make setup`
- Dev: `make dev`
- Test: `make test`
- Full check: `make check`

## Hard constraints
- All APIs must use OAuth 2.0
- DB queries must use SQLAlchemy 2.0 syntax
- PRs must pass `pytest && mypy --strict && ruff check`
- (≤ 15 lines max — each rule traces to a specific past failure)

## Verification commands
- Unit: `pytest tests/unit -x`
- Integration: `pytest tests/integration`
- E2E: `make e2e`

## Topic docs (pull when relevant)
- API patterns: `docs/api-patterns.md` — when adding endpoints
- DB rules: `docs/database-rules.md` — when touching the DB
- Test standards: `docs/testing-standards.md` — when writing tests
- Architecture: `docs/architecture.md` — when designing across modules

## Session protocol
- Clock‑in: read `PROGRESS.md` + `DECISIONS.md`, run `make check`
- Clock‑out: update `PROGRESS.md`, run `make check`, commit
```

Target: 50–80 lines. Every line traceable to a past failure or a hard external constraint.

---

## Part 8 — Anti‑patterns

| Anti‑pattern | Why it fails |
|---|---|
| Front‑load everything the model might need | Burns context; reasoning window shrinks |
| Pre‑emptive `if/else` rules in the system prompt | Rule explosion; rules conflict; model can't attend to all |
| Stale memory acted upon without verification | "We fixed bug X" memorized; bug returns; agent claims it's fixed |
| LLM‑generated `AGENTS.md` | Degrades performance, +20% inference cost (ETH) |
| Dumping all rules in one file | Critical rules end up mid‑file → "Lost in the Middle" |
| Treating compaction as automatic | Default compaction is generic; production needs *opinionated* compaction (preserve architectural decisions) |
| Loading raw files into context | Use `grep` / `glob` / `head` / `tail` and load by reference |

---

## Part 9 — Field heuristics

- If your `AGENTS.md` is > 200 lines, you have either too many rules or wrong rules.
- If you're loading a file via `cat` to pass to the model, you're probably wasting tokens — `grep` or `head` first.
- If a topic doc is loaded on > 80% of sessions, promote its key constraints to `AGENTS.md`.
- If a topic doc is loaded < 5% of the time, consider deleting it.
- Track context tokens spent per session. Anomaly = "agent loaded 40K tokens to fix a typo."

---

## Reading on from here

| If you want… | Read |
|---|---|
| Tool / skill mechanics (the other half of context) | `05-tools-and-skills.md` |
| Long‑running task continuity | `07-state-and-persistence.md` |
| The full loop these decisions sit inside | `03-loop-in-motion.md` |
| What goes wrong when you ignore this | `../anti-patterns.md` |
