# Source Notes

Detailed notes on each of the five primary sources, plus the cross‑source matrix. For higher‑level synthesis (where they agree / disagree) see `../source-synthesis.md`.

---

## Source 1 — *The Anatomy of an Agent Harness* (PDF)

- **Author:** Akshay Pachaar (@akshay_pachaar)
- **Platform:** Twitter/X thread, archived as PDF (`thread-2041146899319971922.pdf`)
- **Pages:** 9
- **Position:** Most comprehensive single source — the canonical taxonomy

### Core thesis

> The harness — not the model — determines whether an LLM behaves like an agent. The harness is the OS that makes a raw LLM (a CPU with no I/O) useful.

### Key contributions

| Concept | Detail |
|---|---|
| **Definition** | "The complete software infrastructure wrapping an LLM: orchestration loop, tools, memory, context management, state persistence, error handling, guardrails." |
| **Canonical formula** | Vivek Trivedy (LangChain): *"If you're not the model, you're the harness."* |
| **Von Neumann analogy** | Beren Millidge, *Scaffolded LLMs as Natural Language Computers* (2023). Raw LLM = CPU; context window = RAM; vector DB = disk; tools = device drivers; harness = OS. |
| **Three levels** | Prompt engineering ⊂ context engineering ⊂ harness engineering |
| **12 components** | (1) Orchestration loop, (2) Tools, (3) Memory, (4) Context management, (5) Prompt construction, (6) Output parsing, (7) State management, (8) Error handling, (9) Guardrails, (10) Verification, (11) Subagent orchestration, (12) (implicit) Observability |
| **The loop in 7 steps** | Prompt assembly → LLM inference → classify output → tool execution → result packaging → context update → loop |
| **Termination conditions (layered)** | No tool calls, max turns, token budget, tripwire, user interrupt, safety refusal |
| **Ralph Loop** | Two‑phase pattern for tasks spanning multiple context windows. Initializer Agent (one‑time setup) + Coding Agent (every subsequent session reads git logs + progress file). |
| **Framework comparison matrix** | Claude Agent SDK / OpenAI Agents SDK / LangGraph / CrewAI / AutoGen across Loop, State, Multi‑Agent, Philosophy |
| **Scaffolding metaphor** | Construction scaffolding enables work that wouldn't otherwise be possible; comes down when building is complete. Manus rebuilt 5× in 6 months, each rewrite removing complexity. |
| **Co‑evolution principle** | "Models are now post‑trained with specific harnesses in the loop." Claude Code's model learned its specific harness. |
| **Future‑proofing test** | If performance scales up with more powerful models *without* adding harness complexity, design is sound. |
| **Thin vs thick spectrum** | Claude SDK (thin, "trust the model") to LangGraph (thick, "harness encodes the logic"). |
| **Anthropic context goal** | *"Find the smallest possible set of high‑signal tokens that maximize likelihood of the desired outcome."* |
| **Claude Code memory** | Three‑tier hierarchy: lightweight index (~150 chars, always loaded), detailed topic files (on demand), raw transcripts (search only). |
| **Critical memory principle** | "The agent treats its own memory as a 'hint' and verifies against actual state before acting." |
| **Error math** | 10 steps × 99% per step = ~90.4% e2e. Errors compound. |
| **LangGraph 4 error types** | Transient (retry+backoff); LLM‑recoverable (return as ToolMessage); user‑fixable (interrupt); unexpected (bubble). |
| **Stripe retry cap** | 2 attempts. |
| **OpenAI 3‑level guardrails** | Input, output, tool. Tripwire halts immediately. |
| **Anthropic permission separation** | Model decides what to attempt; tool system decides what's allowed. Claude Code: 3 stages (trust establishment, permission check, explicit confirmation), ~40 discrete tool capabilities. |
| **Verification approaches** | Rules‑based (tests/linters); visual (Playwright screenshots); LLM‑as‑judge (separate subagent). |
| **Boris Cherny quote** | Verification 2–3× quality. |
| **Subagent execution models (Claude Code)** | Fork (byte‑identical copy of parent); Teammate (separate pane + file mailbox); Worktree (own git worktree, isolated branch). |
| **OpenAI subagent patterns** | Agents‑as‑tools (specialist returns to parent) vs Handoffs (specialist takes full control). |
| **Anthropic Gather‑Act‑Verify** | Gather context (search files, read code) → take action (edit files, run commands) → verify (run tests, check output) → repeat. |
| **Seven Decisions** | (Listed at the end of the article, partly cut off in extraction; recoverable from context: thin/thick, state model, memory hierarchy, multi‑agent topology, permission model, verification strategy, termination conditions) |

### Evidence cited

- LangChain Terminal Bench 2.0 climb (outside top 30 → rank 5) by harness‑only changes.
- Separate research project: 76.4% pass rate with LLM‑optimized infrastructure.
- Chroma research on mid‑window degradation.
- Stanford "Lost in the Middle."
- ETH study: LLM‑generated system prompts ~20% inference overhead + performance loss.

---

## Source 2 — *Harnesses Are Everything: How to Optimize Yours* (PDF)

- **Author:** Alex Ker (@thealexker), with credit to HumanLayer's Kyle
- **Platform:** Twitter/X thread, archived as PDF (`thread-2045203785304232162.pdf`)
- **Pages:** 6
- **Position:** Most practical / tactical — what to actually do today

### Core thesis

> Three simple surfaces separate harnesses that compound your output from ones that compound your mistakes: lean .md files, R.P.I. prompts, and subagents for context isolation.

### Key contributions

| Concept | Detail |
|---|---|
| **Three pillars** | Lean .md files; R.P.I. framework; subagents |
| **Instruction budget** | (Kyle / HumanLayer) Frontier models can only follow a few hundred instructions before entering the "dumb zone." Bloat encourages hallucination. |
| **Lean AGENTS.md rule** | Human‑written outperforms LLM‑generated. ETH research: LLM‑generated prompts degrade performance + cost ~20% more in inference. **Every token should fight for its place.** |
| **Progressive disclosure** | Three surfaces: CLIs (agent runs `--help`), Skills (name + description at startup, full SKILL.md on demand), MCP tools (varies by harness) |
| **Surface comparison table** | Claude Code (search‑based MCP, 85% context reduction) vs Codex CLI (all loaded) vs OpenCode (all loaded, plugin available) |
| **R.P.I. Framework** | Research → Plan → Implement. **One phase per context window.** No action during research. Human reviews plan. Implementation in fresh context. |
| **R.P.I. discipline statement** | "Operating a harness is leading it to behave in a way the best staff engineers approach problem‑solving: break problems into subproblems, plan before implementing, get a second set of eyes on the plan." |
| **Subagent heuristic** | Use one when a summary of the work is sufficient for your main agent. Keep work inline if you'll need the intermediate context. |
| **Fan‑out pattern** | Parallel investigation — main agent generates N candidate theories, spawns subagent for each; summaries flow back. Speed + context isolation. |
| **Pipeline pattern** | Sequential depth — UX designer → architect → devil's advocate. Each stage adds analysis. Frontier model judge consolidates if needed. |
| **Multi‑model concurrency** | One thread MiniMax M2.5 + one thread GLM‑5 etc. — fan‑out applies to model diversity too. |
| **Built‑in subagents comparison** | Claude Code (Explore Haiku / Plan / General‑purpose); Codex CLI (Explorer / Worker / Default); OpenCode (configurable). Automatic delegation: Claude Code yes; Codex no; OpenCode yes. |
| **Internal CLI advice** | For tools the model wasn't trained on (e.g., `uv`): write one line in AGENTS.md ("use uv for Python; run uv --help to discover subcommands") — gives agent an entry point without wasting context. |

### Evidence cited

- ETH research on LLM‑generated system prompts (cost + performance).
- Anthropic's 85% context reduction from MCP search.
- HumanLayer's "instruction budget" concept.
- Baseten case (their own): rudimentary fan‑out when gpt‑oss‑120b launched.

### Unique framing

Alex Ker frames the harness as **"a `while (have next message) do {tool}` loop"** that amplifies speed and quality of all code generated onwards.

---

## Source 3 — *The Agent Harness Belongs Outside the Sandbox*

- **Author:** Andrea Luzzardi (Mendral; co‑founder with Sam Alba)
- **Platform:** Mendral blog
- **Date:** 2026‑04‑10
- **URL:** mendral.com/blog/agent-harness-belongs-outside-sandbox
- **Position:** The most architectural source — answers a question no other source explicitly poses

### Core thesis

> Where the harness loop runs determines security, failure modes, and capabilities. For multi‑user / hosted SaaS agents, the loop belongs *outside* the sandbox, not inside it.

### Key contributions

| Concept | Detail |
|---|---|
| **Inside vs outside framing** | Inside: loop coexists with target code in same container; tool execution local. Outside: loop on backend infra; tool execution dispatched to sandbox via API; sandbox returns results. |
| **Single user vs multi‑user inflection** | Inside is fine for laptops (Claude Code). Multi‑user SaaS makes filesystem assumptions break — credentials get distributed; suspension during idle isn't possible; consistency becomes a problem. |
| **Three pillars of outside‑loop** | (1) Durable execution. (2) Sandbox lifecycle management. (3) Filesystem virtualization. |
| **Durable execution** | "An agent loop is a long‑running function. Minutes at a minimum, hours in our case." Mendral built on Inngest; each loop turn = checkpointed step; survives deployments and instance failures. |
| **Sandbox lifecycle (Blaxel)** | 25ms resume from standby. Sandbox active only during tool execution; suspended during LLM thinking + waits. |
| **Filesystem virtualization** | Path‑based dispatch. `/workspace/*` → sandbox RPC; `/skills/*` and `/memory/*` → Postgres. **"One tool surface, two backends, invisible to the agent."** |
| **Why not separate memory_read/memory_write tools** | More tools dilute model attention; duplicates cause disambiguation problems; preserves the API surface the model was RL‑trained on (Claude Code patterns). |
| **Credential isolation** | "Your credentials stay out of the sandbox. The loop holds the LLM API keys, the user tokens, the database access." Sandbox compromise can't exfil what it doesn't have. |
| **Remaining challenges** | SOTA volatility (new patterns may assume local FS); convention brittleness (path layout mirrors Claude Code; layout changes require migration); bash leakage (bash bypasses virtualization — mitigated with prompt + tree‑sitter, imperfect); consistency model (last‑writer‑wins for concurrent org‑level memory updates — open). |

### Company context

Mendral positions as "The AI DevOps Engineer" — three always‑on agents for security, reliability, performance automation. Founders come from Docker / Dagger backgrounds.

### Evidence cited

- Anthropic's training of frontier models on harnesses that look like Claude Code.
- Inngest for durable execution (production track record).
- Blaxel for sandbox lifecycle (25ms resume claim).

### Unique value

Mendral is the only source that names **path‑based filesystem virtualization** as a pattern. This is the cleanest known technique for extending a trained API surface (Claude Code's filesystem assumptions) for multi‑user backends without breaking the model.

---

## Source 4 — *Agent Harness Engineering*

- **Author:** Addy Osmani
- **Platform:** addyosmani.com/blog
- **Date:** 2026
- **Position:** Most reflective / philosophical — connects harnesses to broader engineering practice

### Core thesis

> A coding agent = model + harness. The harness is what makes intelligence shippable. Patterns are converging into a load‑bearing discipline.

### Key contributions

| Concept | Detail |
|---|---|
| **Core equation** | "coding agent = AI model(s) + harness" |
| **Foundational principle** | *"A decent model with a great harness beats a great model with a bad harness."* |
| **What constitutes a harness** | System prompts/config files; tools, skills, MCP servers; bundled infra (filesystem, sandbox, browser); orchestration logic (subagent routing, handoffs); hooks/middleware; observability |
| **"Skill issue" reframe** | (HumanLayer) "It's not a model problem. It's a configuration problem." Agent failures = configuration problems = engineering work. |
| **Evidence: Claude Opus harness gap** | Opus 4.6 scores significantly lower on Terminal Bench 2.0 in Claude Code than in custom harnesses. Viv's team: Top 30 → Top 5 by harness changes alone. |
| **Ratchet pattern** | *"Every line in a good AGENTS.md should be traceable back to a specific thing that went wrong."* Each agent mistake is a permanent signal — engineer to prevent that exact mistake recurring. **Explains why harness engineering cannot be templated.** |
| **Key components named** | Filesystem + git (durable state); Bash + code execution (catch‑all); sandboxes; memory + continual learning; context management (compaction, tool‑call offloading, skills, full context resets) |
| **Long‑horizon patterns** | Ralph Loops; planning (write plan files, self‑verify); Planner/Generator/Evaluator splits (agents bias positive grading own work); Sprint contracts |
| **Hooks** | Scripts at lifecycle points (pre‑tool, post‑edit, pre‑commit). **"Success is silent, failures are verbose."** The harness — not the model — enforces non‑negotiables. |
| **AGENTS.md principles** | ≤60 lines (HumanLayer standard); each rule traces to failure or hard constraint; **ten focused tools beat fifty overlapping ones**; tool descriptions populate prompts → MCP selection is a trust decision |
| **Model‑harness co‑training loop** | Models post‑trained coupled to harness primitives. Opus 4.6 better in Claude Code partly because trained with it in the loop. Practical: optimal harness isn't where model trained — designed for your specific task. |
| **HaaS** | "Harness‑as‑a‑Service" — industry shift from LLM APIs (completions) to harness APIs (runtimes). SDKs provide loop/tools/context/sandbox out‑of‑box. |
| **Convergence pattern** | *"Leading coding agents (Claude Code, Cursor, Codex, Aider, Cline) look more like each other than their underlying models do."* |
| **Future directions** | Parallel multi‑agent on shared codebases; agents analyzing traces to fix harness‑level failures; dynamic JIT tool/context assembly — "harnesses stop being static config and start becoming something closer to a compiler" |

### Evidence cited

- Claude Opus 4.6 scores on Terminal Bench 2.0 (Claude Code vs custom).
- Viv's team improvement (Top 30 → Top 5 via harness).
- Anthropic case (single agent unresponsive game vs multi‑agent playable).
- Manus 5× rewrites in 6 months.

### Unique value

Addy is the source that most clearly articulates **the ratchet pattern** — every rule traces to a specific failure. This is the single most important habit to internalize for ongoing harness maintenance.

---

## Source 5 — *Learn Harness Engineering*

- **Author:** walkinglabs
- **Platform:** walkinglabs.github.io/learn-harness-engineering/
- **Format:** 12‑lecture course + 6 projects + resource library (404 at fetch time)
- **Position:** Most prescriptive / didactic — concrete file names, templates, state machines

### Course structure

| Lecture | Topic | Core contribution |
|---|---|---|
| 1 | Why capable agents still fail | Three‑agent planner/generator/evaluator; verification gap; DoD format |
| 2 | What a harness actually is | Five subsystems (instructions/tools/environment/state/feedback); Make‑target verification commands |
| 3 | Why the repo must become the system of record | Knowledge lives next to code; module‑local ARCHITECTURE.md / CONSTRAINTS.md |
| 4 | Why one giant instruction file fails | 50–200 line AGENTS.md + on‑demand topic docs; each instruction tagged (source/applicability/expiry) |
| 5 | Why long‑running tasks lose continuity | PROGRESS.md + DECISIONS.md; clock‑in/clock‑out routines; completion drops 100% → 58% without persistence |
| 6 | Why initialization needs its own phase | Init ≠ implementation; Startup Readiness Checklist; project templates beat empty dirs |
| 7 | Why agents overreach and under‑finish | WIP=1; 5 parallel features → 20% e2e vs WIP=1 → 100% (87.5% vs 37.5% verified completion) |
| 8 | Why feature lists are harness primitives | (behavior, verification command, state) triples; state machine `not_started → active → blocked → passing`; agents can't self‑transition |
| 9 | Why agents declare victory too early | 3‑layer termination validation (static/runtime/e2e); actionable error feedback (ERROR/WHY/FIX); Anthropic case ($9 vs $200) |
| 10 | Why end‑to‑end testing changes results | Boundaries are where defects live; Electron case (5 defects passed unit, failed e2e); architectural enforcement via lint+grep |
| 11 | Why observability belongs inside the harness | Sprint Contract + Evaluator Rubric (A/B/C/D); OpenTelemetry semantic conventions; Task Trace |
| 12 | Why every session must leave a clean state | Session Exit Checklist; Quality Document (periodic A–C scoring); dual‑mode cleanup; 12‑week decay data |

### Cross‑lecture file inventory

The walkinglabs course is unique in naming specific files and their contents:

| File | Purpose |
|---|---|
| `AGENTS.md` / `CLAUDE.md` / `.cursorrules` | Entry instructions, 50–200 lines |
| `PROGRESS.md` | Current session state |
| `DECISIONS.md` | Design log with rejected alternatives |
| `ARCHITECTURE.md` (per module) | Module knowledge |
| `CONSTRAINTS.md` | Hard MUST / MUST NOT |
| `docs/api-patterns.md`, `docs/database-rules.md`, `docs/testing-standards.md` | Topic docs |
| `features.json` (or `docs/features.md`) | Backlog with state machine |
| `Makefile` | `setup` / `test` / `lint` / `check` / `dev` |
| Session Exit Checklist + Quality Document | Cleanup discipline |
| OpenTelemetry traces | session / task / verification spans |
| Sprint Contract + Evaluator Rubric | Per‑task |

### Projects (capstones)

1. Baseline vs Minimal Harness (Prompt‑Only vs Rules‑First)
2. Agent‑Readable Workspace (repo structure + handoff)
3. Multi‑Session Continuity (state files + init scripts)
4. Incremental Indexing (runtime feedback + scope control)
5. Grounded Q&A Verification (independent review / role separation)
6. Runtime Observability and Debugging (capstone)

### Evidence cited

- Anthropic case ($9 single agent vs $200 three‑agent; same Opus 4.5).
- Electron 5‑defect case (all unit‑pass, all e2e‑fail).
- 12‑week decay data: build 100%→68%, tests 100%→61%, startup 5min→60+min.
- 5 parallel features (20% e2e pass) vs WIP=1 (100% e2e pass).

### Unique value

walkinglabs is the most actionable source: **file names, schema fields, state machine transitions, checklists.** Where Akshay tells you the 12 components exist, walkinglabs tells you exactly what to put in `features.json`.

---

## Source 6 — Pi (earendil‑works/pi) — codebase, field‑verified

- **Type:** Open‑source agent‑harness codebase (not an article). MIT, TypeScript monorepo (`agent`, `ai`, `coding-agent`, `tui`).
- **Repo:** github.com/earendil-works/pi
- **Verified:** 2026‑05‑29, by direct inspection of a shallow clone — *source, not READMEs.* File:line citations below.
- **Position:** A real‑world *instance* of the canon (independent confirmation of the 12‑component convergence, Source 4) that also contributes three refinements the prior five sources under‑specify.

### What it confirms

Independent reimplementation of the spine by a different team in a different language: dumb event‑driven loop, `AgentTool` schema with 4 core tools (read/write/edit/bash), native tool‑calls, **throw → catch → report‑as‑tool‑error** (matches the LLM‑recoverable error type), `beforeToolCall` block (the model‑decides / tools‑allow split), AGENTS.md auto‑load + compaction. When an outside team reinvents the spine, the convergence thesis holds.

### Coordinate

Thin core · single‑user · inside‑sandbox · **permissive** (explicitly "No permission popups") · coding domain. **No built‑in `pre-stop`/verification gate and no risk‑tier permission model** (both verified *absent* — grep‑empty in `packages/coding-agent/src` and `packages/agent/src`). `docs/extensions.md` lists *"Permission gates (confirm before rm -rf)"* and *path protection* as example **extensions you write** — i.e. Pi ships components 1–7 and defers the Safety & Scale ring (8–12) to the adopter, by design.

### Three field‑verified refinements to the canon

| # | Refinement | Lands in | Evidence |
|---|---|---|---|
| 1 | **Branching session tree** — a 5th state pattern beyond Akshay's four. Entries carry `parentId`; a movable leaf pointer + `getPathToRoot(leaf)` makes the LLM context the *root‑to‑leaf path* (not the append order); `moveTo()` forks to any prior entry. Model / thinking‑level / active‑tool changes are tree nodes too, so branching time‑travels *config* state, not just messages. Compaction is itself a node (`firstKeptEntryId`). Tree‑structured resume **without git**. | `core/02` component 7 | `packages/agent/src/harness/session/session.ts:109-116, 138, 246-265, 22-40` |
| 2 | **Harness‑as‑platform** extensibility — one `ExtensionAPI` that mutates the model surface (`registerTool`/`setActiveTools`), the loop (~28 lifecycle hooks with veto/mutate result types: `context`, `before_provider_request`, `tool_call`, `tool_result`…), the human harness (`registerCommand`/`registerShortcut`/`registerFlag`/UI widgets), **and the provider backend itself** (`registerProvider`/`unregisterProvider` — add models, override baseURL, inject OAuth; hot‑reloadable). Broader than tools‑or‑skills; the mechanism by which a thin core defers the non‑negotiables to userland. | `architectural-decisions.md` Decision 7 | `packages/coding-agent/src/core/extensions/types.ts:1086-1313` |
| 3 | **Steer / follow‑up as loop primitives**, distinct from interrupt. `steer(msg)` redirects the live run without killing it; `followUp(msg)` queues work to drain after idle; both back‑pressured by `QueueMode`; separate from `abort()`. | `core/02` component 1 | `packages/agent/src/agent.ts:169-170, 212-213, 264-270, 300` |

### Unique value

The only **codebase** source — lets the convergence claim be checked against shipping code rather than prose, and supplies the first concrete *"thin core + arbitrary‑code extension layer"* data point. Contrast with Mendral (Source 3): Mendral extends a **fixed** API surface for multi‑user via path dispatch; Pi instead makes the **whole harness user‑pluggable** for single‑user. Two different answers to "how do you add capability without breaking the trained surface."

---

## Cross‑source matrix on key topics

|  | Akshay | Alex Ker | Mendral | Addy O. | walkinglabs |
|---|---|---|---|---|---|
| **Definition of harness** | ✓ (canonical) | ✓ | ✓ (architectural) | ✓ | ✓ (subsystems) |
| **Loop semantics** | ✓ (7 steps) | ✓ (while loop) | (implicit) | (implicit) | (implicit) |
| **12 components** | ✓ (origin) | partial | – | partial | 5 subsystems |
| **Context management** | ✓ (4 strategies) | ✓ (3 progressive disclosure surfaces) | (implicit) | ✓ (offloading) | ✓ (topic docs) |
| **Memory tiers** | ✓ (3‑tier) | – | ✓ (DB pattern) | ✓ (FS standards) | ✓ (PROGRESS+DECISIONS) |
| **Subagents** | ✓ (3 models, 2 patterns) | ✓ (fan‑out + pipeline) | – | ✓ (planner/gen/eval) | (implicit, 3‑agent case) |
| **Verification** | ✓ (3 approaches) | ✓ (R.P.I.) | – | ✓ (sprint contracts) | ✓ (3 layers + e2e) |
| **Termination** | ✓ (6 conditions) | – | – | (hooks) | ✓ (e2e gating + clean exit) |
| **State persistence** | ✓ (git + files) | – | ✓ (durable exec) | ✓ (FS + git) | ✓ (PROGRESS / DECISIONS / features) |
| **Error handling** | ✓ (4 types + cap) | – | – | – | ✓ (actionable feedback) |
| **Guardrails** | ✓ (3 levels + permission separation) | – | ✓ (credential isolation) | ✓ (hooks) | ✓ (hard constraints) |
| **Observability** | (implicit) | – | – | (cost meter) | ✓ (Sprint Contract / Rubric / OTel) |
| **Multi‑user architecture** | – | – | ✓ (entire article) | – | – |
| **Co‑evolution** | ✓ (test) | (mentioned) | ✓ (motivation for path dispatch) | ✓ (loop) | (implicit) |
| **Anti‑patterns** | (implicit) | ✓ (LLM‑gen prompts) | (bash leakage) | ✓ (self‑eval) | ✓ (catalog across 12 lectures) |
| **Specific file names + schemas** | – | (AGENTS.md) | (path scheme) | (AGENTS.md) | ✓ (most prescriptive) |
| **Domain blueprints** | – | – | – | – | (project capstones) |

✓ = primary contributor • partial = mentions but not depth • – = not covered

---

## Reading order recommendation

For a new harness engineer:

1. **Start with Akshay** (this PDF) — get the vocabulary and the 12 components.
2. **Read Addy Osmani** — internalize the ratchet pattern and the philosophy.
3. **Read Alex Ker** — collect the tactical heuristics (R.P.I., lean .md, progressive disclosure).
4. **Read walkinglabs lectures 1–6** — concrete files and routines.
5. **Read Mendral** — if and only if you're building multi‑user / hosted.
6. **Read walkinglabs lectures 7–12** — production discipline.

Then come back to the synthesized docs in `../core/` and `../blueprints/` to operationalize.

---

## Citations / URLs

| # | Source | Where to find it |
|---|---|---|
| 1 | Akshay — *Anatomy of an Agent Harness* | x.com/akshay_pachaar (PDF archive in this folder) |
| 2 | Alex Ker — *Harnesses Are Everything* | x.com/thealexker (PDF archive in this folder) |
| 3 | Mendral — *Outside the Sandbox* | mendral.com/blog/agent-harness-belongs-outside-sandbox |
| 4 | Addy Osmani — *Agent Harness Engineering* | addyosmani.com/blog/agent-harness-engineering/ |
| 5 | walkinglabs — *Learn Harness Engineering* | walkinglabs.github.io/learn-harness-engineering/en/ |
| 6 | Pi — earendil‑works/pi (codebase, verified 2026‑05‑29) | github.com/earendil-works/pi |

Beren Millidge's *Scaffolded LLMs as Natural Language Computers* (2023) is the original Von Neumann analogy. Cited via Akshay's PDF.

HumanLayer's Kyle is cited in Alex Ker's PDF for the "instruction budget" concept; HumanLayer also gets credit in Addy Osmani's piece for the "configuration problem" framing.
