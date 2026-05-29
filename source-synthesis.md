# Source Synthesis

This doc maps the five primary sources against each other: where they agree, where they disagree, what each contributes uniquely, and what to actually trust.

For full per‑source notes, see `sources/source-notes.md`.

---

## The five sources

| # | Title | Author | Date | Core contribution |
|---|---|---|---|---|
| 1 | *The Anatomy of an Agent Harness* (PDF) | Akshay Pachaar | ~2026 Q1 | 12‑component taxonomy; framework comparison matrix; thin‑vs‑thick spectrum |
| 2 | *Harnesses Are Everything: How to Optimize Yours* (PDF) | Alex Ker | ~2026 Q1 | Lean .md files; R.P.I. framework; fan‑out vs pipeline patterns |
| 3 | *The Agent Harness Belongs Outside the Sandbox* | Andrea Luzzardi (Mendral) | 2026‑04‑10 | Inside vs outside sandbox; filesystem virtualization; durable execution |
| 4 | *Agent Harness Engineering* | Addy Osmani | 2026 | "Skill issue" reframe; ratchet pattern; hooks as deterministic backbone; HaaS |
| 5 | *Learn Harness Engineering* (12 lectures + projects) | walkinglabs | 2026 | Repo‑as‑system‑of‑record; feature lists; e2e validation; observability inside harness |

---

## Where they all agree (the "five truths")

These are the rare claims that show up in every source.

### 1. The harness, not the model, is the bottleneck

| Source | Form |
|---|---|
| Akshay | LangChain went from outside top 30 to rank 5 on Terminal Bench 2.0 by changing only the harness; another project hit 76.4% via LLM‑optimized infrastructure |
| Alex Ker | "If the model is the source of intelligence, the harness is what makes that intelligence useful." |
| Mendral | The whole article is premised on this |
| Addy Osmani | "A decent model with a great harness beats a great model with a bad harness." HumanLayer: "It's not a model problem. It's a configuration problem." |
| walkinglabs | Lecture 1 makes this its thesis: the same model in different harnesses produces radically different output |

### 2. Reliability compounds (and verification 2–3×s quality)

| Source | Form |
|---|---|
| Akshay | 10‑step process at 99% per‑step = 90.4% e2e; Boris Cherny quote on 2–3× quality |
| Alex Ker | R.P.I. framework's whole point — break problems, plan, verify |
| Addy Osmani | Sprint contracts; planner / generator / evaluator splits; hooks for non‑negotiables |
| walkinglabs | Lecture 9 — Anthropic case: single agent $9 unresponsive game vs. 3‑agent $200 playable game |
| Mendral | Implicit — durable execution survives failures, retries become possible |

### 3. Context rot is real; lean is the strategy

| Source | Form |
|---|---|
| Akshay | Cites Chroma and "Lost in the Middle"; lists 4 production strategies (compaction, masking, JIT, sub‑agent) |
| Alex Ker | Instruction budget ("dumb zone"); progressive disclosure across CLIs / skills / MCP; lean .md files |
| Addy Osmani | Compaction, tool‑call offloading, skills with progressive disclosure, full context resets |
| walkinglabs | Lecture 4 — "Why one giant instruction file fails"; topic docs in `docs/` |
| Mendral | Implicit in path‑based dispatch (only relevant data flows through) |

### 4. Memory + state is a *hint*, ground truth lives elsewhere

| Source | Form |
|---|---|
| Akshay | "Critical design principle: the agent treats its own memory as a 'hint' and verifies against actual state before acting." |
| Alex Ker | (Implicit — R.P.I. starts with Research, verifying current state) |
| Mendral | Memory in Postgres for multi‑user; verified per query |
| Addy Osmani | Ratchet pattern — failures inform memory, but memory doesn't dictate without verification |
| walkinglabs | Lecture 3 — repo as system of record; clock‑in routine verifies state matches PROGRESS.md before continuing |

### 5. Co‑evolution: models are trained with harnesses; scaffolding should come down

| Source | Form |
|---|---|
| Akshay | "Models are now post‑trained with specific harnesses in the loop. Claude Code's model learned to use the specific harness it was trained with." Future‑proofing test |
| Alex Ker | Acknowledges convergence on Claude Code / Codex / OpenCode patterns |
| Addy Osmani | Co‑training loop explicit; "models look more like each other than their underlying models do"; Manus rebuild 5× pattern |
| Mendral | The whole reason to preserve trained tool API surfaces via path dispatch |
| walkinglabs | (Implicit — recommends standard formats like `AGENTS.md` that work with all models) |

---

## Where they disagree

### Disagreement A — One config vs many configs

| Position | Source | Argument |
|---|---|---|
| **Lean (~60 lines)** | Alex Ker, Addy Osmani | Instruction budget. Every token fights for place. HumanLayer: 60 lines max |
| **Many** | walkinglabs | `AGENTS.md` + `PROGRESS.md` + `DECISIONS.md` + `ARCHITECTURE.md` (per module) + `CONSTRAINTS.md` + multiple `docs/*.md` |

**Resolution:** these are about *different scopes*. Lean applies to **always‑loaded** files. Many applies to **progressively disclosed** files. Reconciled:
- `AGENTS.md` / `CLAUDE.md` (always loaded): ≤80 lines
- Topic / progress / decisions / module docs: on‑demand, can be many
- Skills: name + description only loaded; bodies on demand

Both sides are right when read with scope in mind.

---

### Disagreement B — Inside vs outside the sandbox

| Position | Source | Argument |
|---|---|---|
| **Inside** | Implicit in Claude Code (Anthropic), Addy Osmani's references | Simple execution; off‑the‑shelf harnesses work; filesystem is one place |
| **Outside** | Mendral (Andrea Luzzardi) | Credentials stay out of sandbox; suspension during idle; multi‑user becomes DB problem; replaceable sandboxes |

**Resolution:** scenario‑dependent.
- Single‑user local tool → inside.
- Multi‑user SaaS / regulated hosted agent → outside.
- The choice is **architectural, not philosophical** — it depends on tenancy model.

Mendral's pattern is the right answer for hosted multi‑user. Inside is the right answer for laptops. The disagreement is illusory once you specify your tenancy.

---

### Disagreement C — Thin vs thick harness

| Position | Source | Argument |
|---|---|---|
| **Thin** | Akshay (describes Claude SDK as thin), Addy Osmani | Bet on model improvement; scaffolding comes down; Manus removed complexity in each of 5 rewrites |
| **Thick** | LangGraph design (Akshay cites); walkinglabs (lectures encode much logic) | Explicit control; auditable; works for domains the model isn't co‑trained on |

**Resolution:** also scenario‑dependent.
- Coding agent + co‑trained model → thin.
- Novel domain (fashion, regulated, vertical) → thicker until model catches up.
- Long‑running auditable workflow → thicker for the audit trail alone.

The future‑proofing test (Akshay): if performance scales up without harness changes, you're thin enough.

---

### Disagreement D — Automatic vs explicit subagent delegation

| Position | Source | Argument |
|---|---|---|
| **Automatic** | Claude Code, OpenCode | Convenience; agent decides when to delegate |
| **Explicit** | Codex CLI, Alex Ker (R.P.I.) | Predictability; human reviews plan before subagents spawn |

**Resolution:** depends on task class.
- Investigation / exploration → automatic is fine; cost ceiling caps abuse.
- High‑stakes plan + implement → explicit (R.P.I.); humans gate before subagents run.

---

### Disagreement E — Self‑evaluation vs separate judge

| Position | Source | Argument |
|---|---|---|
| **Implicit OK to self‑eval** | (No source endorses this — but new builders default to it) | Saves cost |
| **Separate judge mandatory** | walkinglabs, Addy Osmani, Akshay (Anthropic 3‑approach) | Self‑eval biases positive; "agents bias positive when grading their own work" |

**Resolution:** there is no real disagreement. All sources agree separate judge / rubric is needed. The cost analysis (22× for Anthropic's playable‑game case) is in favor of separate judge anyway. **Default: separate judge.**

---

## What each source contributes uniquely

### Akshay's PDF — *Anatomy of an Agent Harness*
- The **12‑component taxonomy** (most complete inventory in any source).
- The **Von Neumann analogy** (cites Beren Millidge 2023).
- The **scaffolding metaphor** — temporary infrastructure that comes down.
- The **framework comparison matrix** (Claude / OpenAI / LangGraph / CrewAI / AutoGen).
- The **future‑proofing test.**
- The **Ralph Loop** description (long‑running multi‑window tasks).

### Alex Ker's PDF — *Harnesses Are Everything*
- The **R.P.I. framework** (Research → Plan → Implement, one phase per context window).
- The **instruction budget / "dumb zone"** concept (HumanLayer / Kyle).
- **Progressive disclosure across three surfaces** (CLIs, Skills, MCP tools) — table comparison Claude Code / Codex CLI / OpenCode.
- **Fan‑out vs Pipeline** subagent patterns (explicit diagrams).
- **Lean .md files** — ETH research on LLM‑generated prompts (20% inference overhead).
- The decision rule for subagents ("use when a summary is sufficient").

### Mendral / Luzzardi — *Outside the Sandbox*
- The **inside vs outside sandbox architecture** debate (only source to frame it explicitly).
- **Filesystem virtualization via path‑based dispatch** (one tool surface, multiple backends).
- **Three pillars of outside‑loop**: durable execution (Inngest), sandbox lifecycle (Blaxel 25ms resume), filesystem virtualization (Postgres + RPC).
- The **multi‑user tenancy** lens — why filesystem stops working at scale.
- **Bash leakage** as a known weakness of path dispatch, mitigated via prompt + tree‑sitter.

### Addy Osmani — *Agent Harness Engineering*
- The **ratchet pattern** — every rule traces to a specific failure.
- **"Skill issue" reframe** — agent failures are configuration problems.
- **Hooks as deterministic backbone** — non‑negotiables enforced by harness, not trusted to model.
- **Harness‑as‑a‑Service (HaaS)** — the industry shift from LLM APIs to harness APIs.
- The **planner / generator / evaluator** pattern (with bias analysis).
- The **convergence observation** — leading coding agents look like each other.
- The Manus 5× rebuild as evidence for the scaffolding metaphor.

### walkinglabs — *Learn Harness Engineering* (12 lectures)
- The **repo as system of record** (Lecture 3) — knowledge that isn't in the repo doesn't exist for the agent.
- **Feature lists as primitives** (Lecture 8) — triple of (behavior, verification command, state); state machine `not_started → active → blocked → passing`.
- The **clock‑in / clock‑out** routine (Lecture 5).
- The **initialization phase** as its own discipline (Lecture 6) — Startup Readiness Checklist.
- **WIP = 1** (Lecture 7) — one feature active at a time; empirical 87.5% vs 37.5% completion.
- The **three‑layer termination validation** (Lecture 9) — L1 static / L2 runtime / L3 e2e.
- **E2E is non‑negotiable** (Lecture 10) — Electron case: 5 defects all passed unit tests, all failed e2e.
- **Observability inside the harness** (Lecture 11) — Sprint Contract, Evaluator Rubric, OpenTelemetry, Task Trace.
- **Clean‑state exit + dual‑mode cleanup** (Lecture 12) — Session Exit Checklist; Quality Document scored A–C.

---

## Cross‑source matrix on key topics

|  | Akshay | Alex Ker | Mendral | Addy O. | walkinglabs |
|---|---|---|---|---|---|
| **Component taxonomy** | 12 components (canonical) | — | — | Lists key components | 5 subsystems |
| **Loop semantics** | TAO / ReAct; 7 steps | While loop intro | — | — | — |
| **Context management** | 4 strategies (compaction, masking, JIT, subagent) | Lean .md + 3 progressive‑disclosure surfaces | — | Compaction, offloading, skills | Topic docs + progressive disclosure |
| **Memory** | 3‑tier (Claude Code) | — | Postgres for multi‑user | Filesystem‑based standards | PROGRESS.md + DECISIONS.md |
| **Subagents** | Fork / Teammate / Worktree | Fan‑out + Pipeline | — | Planner/Generator/Evaluator | (Implicit via 3‑agent case) |
| **Verification** | 3 approaches (rules / visual / judge) | R.P.I. (plan reviewed) | — | Self‑verify, e2e | L1/L2/L3 + e2e mandatory |
| **State** | Git + files | — | Durable exec (Inngest) | Filesystem + git | PROGRESS.md, DECISIONS.md, features.json |
| **Guardrails** | Permission separation (3 stages) | — | Credentials with loop | Hooks as deterministic backbone | Hard constraints in AGENTS.md |
| **Observability** | (Implicit) | — | — | Logs / traces / cost meter | Sprint Contract + Evaluator Rubric + OTel |
| **Long‑running tasks** | Ralph Loop | R.P.I. with subagents per step | Durable exec | Ralph Loop description | Multi‑session continuity files |
| **Anti‑patterns** | Implicit | LLM‑generated prompts | Bash leakage | Self‑evaluation | Entire catalog across 12 lectures |

---

## Confidence assessment

A practitioner's read on what to **trust** vs what to **verify yourself**:

### High confidence (verified across multiple sources + production data)
- Context rot ("Lost in the Middle") — multiple research citations, all sources agree.
- 99% per‑step → 90.4% e2e math — pure arithmetic, multiple sources.
- Separate evaluator beats self‑evaluator — Anthropic case + walkinglabs case + Addy Osmani argument.
- Lean always‑loaded config files — Alex Ker + Addy Osmani + ETH research.
- E2E tests catch what unit tests miss — walkinglabs Electron case is concrete.

### Medium confidence (one strong source, but plausible)
- 22× cost differential ($9 vs $200) for single‑agent vs three‑agent — one Anthropic experiment; cost ratio may vary.
- 87.5% vs 37.5% completion rate for WIP=1 vs parallel — walkinglabs data, dataset size unclear.
- Build pass 100% → 68% over 12 weeks — walkinglabs data, dataset unclear.
- ~85% MCP context reduction via search — Anthropic claim, internal benchmark.
- 25ms Blaxel resume — vendor claim.
- 20% inference overhead from LLM‑generated prompts — ETH study, single methodology.

### Low confidence (one source, dependent on context)
- Specific line limits (60 vs 80 vs 200) — depends on project, model, task.
- Specific retry caps (Stripe's 2) — production heuristic, not universal.
- Specific tool counts ("10 focused tools") — directional, not literal.

When applying any of these in your own harness, **measure your own numbers.** The values in the sources are useful starting points but should ratchet to your context.

---

## What the sources missed

Worth noting for completeness — gaps the sources don't address well:

1. **Cost economics in production at scale.** Anthropic's $9 vs $200 case is one data point. Real production cost models (per‑user, per‑session, with caching) aren't deeply covered.
2. **Privacy / data residency constraints.** Mendral touches on credentials but not GDPR / SOC2 / HIPAA harness requirements.
3. **Concurrency at the org level.** Mendral notes "last‑writer‑wins for concurrent multi‑session org‑level memory updates" — admits this is unresolved.
4. **Model‑provider lock‑in.** Co‑evolution implies lock‑in but no source proposes mitigation strategies.
5. **Evaluation of evaluators.** Sources recommend LLM‑as‑judge but don't deeply discuss how to *evaluate the evaluator's* reliability.
6. **Cold‑start UX** for a brand‑new project that has no `AGENTS.md` yet. The init lecture (walkinglabs lecture 6) is the closest, but the practical "first 30 minutes with a fresh repo" workflow isn't fully prescriptive.
7. **Multi‑model harnesses.** Alex Ker mentions "spinning up one thread of MiniMax M2.5 and one thread of GLM‑5" — but the architecture of multi‑provider routing inside one harness is underdeveloped.

The blueprints in `blueprints/` try to address some of these gaps for specific domains.

---

## Cross‑references

- The bets these disagreements imply: `architectural-decisions.md`
- How frameworks embody each position: `framework-comparison.md`
- Full per‑source notes: `sources/source-notes.md`
- Anti‑patterns derived from the failures all sources mention: `anti-patterns.md`
