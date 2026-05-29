# Framework Comparison

Side‑by‑side comparison of the major agent harnesses / frameworks. Reading order: skim the matrix → read the philosophy → choose by use case.

> **For deep, version‑specific API surface, code samples, and current‑as‑of‑mid‑2026 capabilities, see `sdk-current-state.md`.** This doc is the conceptual map; `sdk-current-state.md` is the field guide.

---

## The matrix (mid‑2026)

|  | Claude Agent SDK | OpenAI Agents SDK / Codex | LangGraph | CrewAI | MS Agent Framework | OpenCode | OpenClaw |
|---|---|---|---|---|---|---|---|
| **Author** | Anthropic | OpenAI | LangChain | independent | Microsoft | community | community |
| **Status** | active, `0.2.87` (Python) / `0.3.150` (TS) | active, `0.17.4` | active, `1.2.2` | active, `1.14.5` | **1.0 GA April 2026** (AutoGen now maintenance) | active, ~150K stars | active |
| **Language** | TS / Python | Python | Python | Python | Python / .NET | TS / Node.js | TS / Node.js |
| **Interface** | Terminal REPL / CLI / library | CLI / VS Code / web app / library | Library | Library | Library | TUI / desktop / library | 25+ messaging channels |
| **Loop** | Dumb loop, smart model | Runner class (async/sync/streamed) | Explicit state graph | Sequential / Hierarchical (Crew) + event‑driven (Flow) | Workflow builder | Multi‑provider CLI loop | WS control plane on localhost |
| **State** | Git + files; session resume by ID | 4 strategies (app mem / sessions / Conversations API / `previous_response_id`) | Typed dicts + checkpoints (Postgres/SQLite/Memory) | Task results | Workflow state | Local transcripts | Per‑channel context |
| **Memory** | `CLAUDE.md` + `MEMORY.md` (auto) | Sessions (SQLite/Redis) | Namespace‑organized JSON Store | Per‑agent backstory | Session state | Per‑project | Per‑user filesystem |
| **Multi‑agent** | `AgentDefinition` + `Agent` tool (nested invocation) | **Handoffs** (renamed from "Sync" Feb 2026) + agents‑as‑tools | Nested state graphs / supervisor / swarm | Agent / Task / Crew + hierarchical | Workflow edges | `--plan` vs `--build` agents | Pi Agent (RPC) + Browser (CDP) + Nodes |
| **Hooks** | **Named matchers** — PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd, UserPromptSubmit; can return `deny` | Guardrails (input/output/tool); coarser | Node‑level | Limited | Filters (from SK) | Tool‑call events | Channel‑specific |
| **Tool standard** | Native + MCP (in‑process + external) | Native + MCP | Native | Native + MCP | Native + MCP via SK ext | Native + MCP | RPC + browser + sensors |
| **MCP loading** | **Search‑based by default** (~85% context reduction) | All loaded at start | n/a | n/a | n/a | All loaded at start (community plugin for search) | n/a |
| **Skills** | **First‑class** filesystem `.claude/skills/*/SKILL.md` | — | — | — | — | Skill tool loads on demand | — |
| **Tracing** | BYO (instrument via hooks) | **Built‑in tracing UI** | LangSmith integration | Weaker | SK telemetry inherited | Rich SDK events | Per‑channel |
| **Durable execution** | BYO (Inngest/Temporal) | BYO | **First‑class** (checkpoint+resume) | BYO | First‑class (long‑running state) | BYO | BYO |
| **Philosophy** | Thin harness, trust the model | Code‑first | Graph‑based control | Role‑based collaboration | Workflow + enterprise | Multi‑provider flexibility | Personal life automation |

---

## Philosophy in one sentence each

| Harness | Philosophy |
|---|---|
| **Claude Agent SDK** | *"Dumb loop, smart model. All intelligence lives in the model. The harness just manages turns."* |
| **OpenAI Agents SDK** | *"Code‑first. Workflow is native Python; runner orchestrates handoffs and tool calls."* |
| **LangGraph** | *"Graph‑based control. State graphs make transitions auditable; checkpoints enable time‑travel debug."* |
| **CrewAI** | *"Role‑based collaboration. Agents are defined by role/goal/backstory/tools, work as a Crew (autonomous) or Flow (deterministic)."* |
| **Microsoft Agent Framework** | *"AutoGen + Semantic Kernel — agent abstractions plus enterprise telemetry, sessions, filters."* |
| **OpenCode** | *"Multi‑provider flexibility. 75+ LLM providers; switch mid‑session with carried context."* |
| **OpenClaw** | *"Personal assistant scaffolding across 25+ messaging channels — your life, not your codebase."* |
| **Pi** (earendil‑works) | *"Thin core, arbitrary‑code extensions. The 4‑tool loop is fixed; everything else — tools, hooks, UI, even the model provider — is a user‑pluggable extension."* |

---

## When to choose which

### Choose Claude Agent SDK / Claude Code if…
- Building a coding agent or coding‑adjacent agent.
- Single‑user local tool (laptop) or per‑user dedicated infra.
- You want the *thinnest* harness — bet on model improvement.
- MCP search‑based loading matters to you (large tool ecosystems).
- You need **deterministic hooks** (the `PreToolUse`/`PostToolUse` matchers with `deny` callbacks are unmatched).

**Strengths:** simplest mental model; co‑evolves with Claude model releases; mature hooks; mature MCP support; CLAUDE.md/AGENTS.md are the de facto standard format.

**Weaknesses:** no graph orchestration; no built‑in tracing UI (BYO via hooks); durable execution requires bolting on Inngest/Temporal; single‑user oriented.

### Choose OpenAI Agents SDK / Codex if…
- You prefer code‑first declarations over graph DSLs.
- Type‑safe Python matters.
- Built‑in tracing UI is a real differentiator for your team.
- Multi‑agent handoffs map to your problem (specialist takes control).
- You need **voice/multimodal** (best‑in‑class `gpt-realtime-2`).
- You're building on OpenAI infra (Codex Core, App Server).

**Strengths:** clean Pythonic API; explicit handoffs; first‑class tracing UI; `SandboxAgent` integration.

**Weaknesses:** MCP all loaded at start (context fills); hook system is softer than Claude SDK's; no filesystem Skills.

### Choose LangGraph if…
- Long‑running workflows where **auditable state transitions** matter.
- You need **time‑travel debugging** or **resume‑after‑crash**.
- Compliance / regulated industry — need to *prove* what the agent did.
- Multi‑agent coordination with explicit checkpoints.
- Domain isn't co‑trained — you want to encode logic explicitly.

**Strengths:** explicit graph = explicit behavior; typed state; super‑step checkpoints; multi‑agent via nested graphs; **only framework with native durable execution**.

**Weaknesses:** thicker by default — scaffolding doesn't come down on its own; graph DSL has a learning curve; bet on explicit control may age poorly as models improve.

LangChain's **Deep Agents** explicitly use the term "agent harness": built‑in tools, planning (`write_todos`), filesystem context management, subagent spawning, persistent memory. LangGraph evolved from LangChain's `AgentExecutor` (deprecated in v0.2 because it was hard to extend and lacked multi‑agent support).

### Choose CrewAI if…
- Your problem maps to a clear team metaphor (writer / editor / fact‑checker; UX / architect / devil's advocate).
- Role‑based collaboration is the right abstraction.
- You want a **"deterministic backbone with intelligence where it matters"** — Flows alongside autonomous Crew.
- Non‑developers will author agent definitions (YAML config).

**Strengths:** role/goal/backstory/tools is intuitive; dual model (Crew + Flow) in one library; YAML configs.

**Weaknesses:** softer hooks; weaker observability than LangSmith / OpenAI tracing; not as well‑suited to single‑agent task automation.

### Choose Microsoft Agent Framework if…
- You're on **AutoGen** (which is now maintenance‑only) or **Semantic Kernel** (whose enterprise features MAF absorbed).
- .NET parity matters.
- Enterprise telemetry + filters are important.
- You need workflow‑style multi‑agent orchestration.

**Strengths:** AutoGen's simplicity + SK's enterprise; first‑class .NET; explicit workflows.

**Weaknesses:** smaller community ecosystem than OpenAI/Anthropic; no Skills; MCP via SK ext rather than first‑class.

Migration paths: Microsoft publishes guides for both AutoGen → MAF and SK → MAF.

### Choose OpenCode if…
- You need to **switch models mid‑session with carried context** — uniquely valuable for cost optimization or A/B model testing.
- You want **75+ LLM providers**, including open‑source.
- The `--plan` (read‑only) vs `--build` (write) safety modes fit your workflow.
- Power‑user TUI ergonomics matter.

**Strengths:** multi‑provider flex (unmatched); TUI; community‑driven; embeddable SDK with rich telemetry events.

**Weaknesses:** MCP loads all at start (community plugin for search); smaller production footprint vs Claude Code / Codex.

### Choose OpenClaw if…
- You're building a **personal life assistant** (not a coding tool).
- Need to dispatch across WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, Matrix, IRC, and 16+ more.
- Want a single agent that follows the user across channels.

**Strengths:** unique focus on personal‑life multichannel; built‑in browser (CDP), camera/voice/screen/location sensors via Pi Agent; clear WS control plane.

**Weaknesses:** narrower scope than the big SDKs; less suited to coding or workflow automation.

### Choose Pi if… *(earendil‑works/pi — field‑verified 2026‑05‑29)*
- You want a **thin coding‑agent core you extend with arbitrary TypeScript** rather than a config‑only harness — sub‑agents, plan modes, permission gates, and verification are all *extensions*, not core.
- You need **branching conversation history** (fork from any prior point; model/thinking/tool config time‑travels with the branch) instead of linear log + git checkpoints.
- You want **mid‑session model/provider swapping** registered by an extension (`registerProvider`), or runtime tool‑set swapping (`setActiveTools`).
- You're comfortable supplying the Safety & Scale ring yourself.

**Strengths:** thinnest *extensible* core here; tree‑structured sessions; provider‑pluggable; hot‑reloadable extensions; the 12‑component spine implemented cleanly (independent confirmation of the convergence thesis).

**Weaknesses:** single‑user / inside‑sandbox / **permissive by default** ("No permission popups") — wrong defaults for multi‑user, money‑touching, or regulated domains without significant extension work; coding‑shaped (a poor base for the fashion/shopping blueprints); **no built‑in `pre-stop` or tiered permissions** — you own all of components 8–12. See `sources/source-notes.md` Source 6 for the verified architecture notes.

---

## The OpenClaw vs Claude Code diagram

```
                       OpenClaw                                 Claude Code
                       ────────                                 ───────────

What it is:     Personal assistant harness              Coding agent harness
Language:       TypeScript / Node.js                    Rust + TypeScript wrappers
Interface:      25+ messaging channels                  Terminal REPL / CLI
Focus:          Your life                               Your codebase

   WhatsApp ┐
   Telegram │
   Slack    │
   Discord  │                                                Terminal
   Signal   ├──▶ Gateway                                        │
   iMessage │   (WS control                                     ▼
   Teams    │    plane on                                  ConversationLoop
   Matrix   │    localhost)                                (stream + tool
   IRC      │                                              dispatch loop)
   (16 more)┘                                                  │
                                                               ▼
   ┌─────────┴──────────┐                                ┌─────┼─────┐
   ▼         ▼          ▼                                ▼     ▼     ▼
Pi Agent   Browser    Nodes                            Bash   Files   Web
 (RPC)    (CDP)     (camera,                           Exec   R/W/   Search/
                     voice,                                   Edit/   Fetch
                     screen,                                  Glob/
                     location)                                Grep
   │                                                       │
   ▼                                                       ▼
 Reply back to                                       Commit to repo,
 WhatsApp/Slack/                                     persist session,
 Discord/etc.                                        spawn sub‑agents
```

Shared pattern under different bets:
- Both have a **central loop** (Gateway vs ConversationLoop).
- Both have **dispatched specialist surfaces** (Pi/Browser/Nodes vs Bash/Files/Web).
- Both **persist state** (per‑channel context vs git commits + session files).

Fundamental difference: OpenClaw's surface area is **inbound channels** + **outbound life automation.** Claude Code's surface area is **a single repo's filesystem and shell.**

If your problem looks like "user lives across many channels, agent must follow them" → OpenClaw's style. If it's "user has a repo, agent works in it" → Claude Code's style.

---

## Convergence pattern (more evidence in 2026)

Addy Osmani's observation deserves restating:

> *"Leading coding agents (Claude Code, Cursor, Codex, Aider, Cline) look more like each other than their underlying models do."*

**Six things every modern SDK now ships:**

1. **Same agent‑loop shape:** `agent + tools + (hooks | middleware) + session`.
2. **MCP as the tool/integration substrate** — Anthropic, OpenAI, Microsoft, CrewAI all support it.
3. **Subagent or handoff primitive.**
4. **Session resume.**
5. **Sandboxed execution** as first‑class (OpenAI's `SandboxAgent`, Blaxel‑style external sandboxes, MAF state mgmt).
6. **Tracing/observability** moved from optional to expected.

The remaining disagreements are about *where the control lives* — thin vs thick. See `architectural-decisions.md` Decision 7.

---

## Co‑evolution and the post‑training reality

Important nuance for framework choice:

> **Modern frontier models are post‑trained with specific harnesses in the loop.** Claude's model learned to use the specific harness it was trained with. Changing tool implementations can degrade performance because of this tight coupling.

Practical implications:
- **Performance differences between harnesses for the *same* model are real.** Opus scores higher in Claude Code than in custom harnesses (cited in Addy Osmani's piece).
- **Anthropic / OpenAI have a structural edge** on their own models because of the harness they used in training.
- **For a third‑party agent, using the upstream SDK as a base is the lowest‑risk path** — it preserves trained API surfaces.
- The **Mendral path‑dispatch** trick (one tool surface, multiple backends) is one of the few clean ways to extend a trained API without breaking the model.

The empirical confirmation: **LangChain's Terminal Bench 2.0 result** (+13.7 points, outside top 30 → rank 5) was achieved keeping the model fixed (`gpt-5.2-codex`) and changing only the harness. ([LangChain blog](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering))

---

## Future‑proofing test (recap)

Akshay's metric for harness design:

> *"If performance scales up with more powerful models without adding harness complexity, the design is sound."*

Apply it before adopting a framework. If your harness is heavily logic‑encoded and a stronger model means rewriting half of it, the harness is on the wrong side of the spectrum for that problem.

---

## Decision quick reference

```
Coding agent, single user, laptop                → Claude Agent SDK / Claude Code
Coding agent, hosted, multi‑user                 → Claude Agent SDK + Mendral pattern
Type‑safe Python orchestration                   → OpenAI Agents SDK / Codex SDK
Auditable long‑running workflow                  → LangGraph
Role‑based team metaphor                         → CrewAI
.NET enterprise / SK or AutoGen migration        → Microsoft Agent Framework (1.0 GA Apr 2026)
Multi‑provider flexibility / mid‑session swap    → OpenCode
Personal life across messaging channels          → OpenClaw
Voice / realtime multimodal                      → OpenAI Agents SDK (gpt-realtime-2)
Novel vertical (fashion, regulated, etc.)        → LangGraph or CrewAI (thicker) until model coverage
Best deterministic hooks                         → Claude Agent SDK
Best built-in tracing UI                         → OpenAI Agents SDK
Best durable resume-after-crash                  → LangGraph (or any SDK + Inngest)
```

---

## Cross‑references

- Versioned API details + code examples: `sdk-current-state.md`
- The bets these frameworks make: `architectural-decisions.md`
- Failure modes per framework: `anti-patterns.md`
- The shared 12 components they all implement: `core/02-twelve-components.md`
- Source notes on Akshay's framework comparison: `sources/source-notes.md`
