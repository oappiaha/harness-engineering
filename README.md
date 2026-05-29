# Harness Engineering — A First-Stop Reference

> **For Claude Code sessions starting an agentic project:** Read this README for orientation, then **go to `FRAMEWORK.md`** — that's the playbook. The rest of this folder is depth that `FRAMEWORK.md` points into when you need it.

This folder is the curated, opinionated synthesis of five primary sources on harness engineering as of mid‑2026, audited and citation‑checked against primary sources where possible.

---

## What this is

A reference library for **harness engineering** — the discipline of building the software infrastructure *around* an LLM that turns a stateless model into a goal‑directed, tool‑using, self‑correcting agent. Synthesized from:

| # | Source | Author | Focus |
|---|---|---|---|
| 1 | *The Anatomy of an Agent Harness* (PDF) | Akshay Pachaar | 12 production components, frameworks comparison |
| 2 | *Harnesses Are Everything: How to Optimize Yours* (PDF) | Alex Ker | Lean configs, R.P.I. framework, subagents |
| 3 | *The Agent Harness Belongs Outside the Sandbox* | Andrea Luzzardi (Mendral) | Single‑user vs multi‑user architecture |
| 4 | *Agent Harness Engineering* | Addy Osmani | Skill issue, ratchet pattern, hooks, HaaS |
| 5 | *Learn Harness Engineering* (12‑lecture course) | walkinglabs | Repo‑as‑system‑of‑record, feature lists, e2e validation |

Full source notes live in `sources/source-notes.md`.

---

## The one‑sentence definition

> **A harness is the complete software infrastructure wrapping an LLM — orchestration loop, tools, memory, context management, state persistence, error handling, verification, and guardrails — that turns model weights into an "agent."**

If you're not the model, you're the harness. (— Vivek Trivedy, LangChain)

---

## When to use this folder

| You are about to… | Start here |
|---|---|
| **Build an agent (any kind)** | **`FRAMEWORK.md`** — the capstone playbook with phases, gates, and pointers |
| Just start building right now, with starter files | `templates/first-30-minutes.md` + `templates/` |
| See worked Phase 0→3 artifacts for a real project | `worked-examples/` (3 fully built blueprints) |
| Learn harness engineering top‑to‑bottom | `conversations/` (5 walkthrough lessons in order) |
| Build a domain‑specific agent (research / shopping / fashion / multichannel / coding) | `blueprints/` |
| Add memory, subagents, verification, or hooks to an existing agent | The matching `core/` doc |
| Decide between thin vs thick, in vs out of sandbox, single vs multi‑user | `architectural-decisions.md` |
| Debug an agent that "demos but doesn't ship" | `anti-patterns.md` → `core/08-verification-and-termination.md` |
| Pick a framework (Claude Agent SDK / OpenAI / LangGraph / CrewAI / MS Agent Framework) | `framework-comparison.md` → `sdk-current-state.md` |
| Understand where sources agree vs disagree | `source-synthesis.md` |
| Audit what's still uncertain or might be wrong | `uncertainties-and-futures.md` |

---

## Folder map

```
harness-engineering/
├── README.md                       # ← orientation (you are here)
├── FRAMEWORK.md                    # ← THE PLAYBOOK — read this when building
│
├── architectural-decisions.md      # Akshay's 7 decisions + the major debates
├── anti-patterns.md                # Catalog of failure modes
├── framework-comparison.md         # Conceptual map of SDKs
├── sdk-current-state.md            # Versioned, code‑example deep dive on SDKs (mid‑2026)
├── source-synthesis.md             # Where the 5 sources agree / disagree / verified claims
├── uncertainties-and-futures.md    # What's still uncertain + predicted field shifts
│
├── templates/                      # ← Copy-pasteable starter files
│   ├── README.md
│   ├── harness-design.md           # Phase 0 worksheet (5 questions + 7 decisions)
│   ├── AGENTS.md                   # Always-loaded landing page skeleton
│   ├── Makefile                    # setup/dev/test/lint/check targets
│   ├── pre-stop.sh                 # The non-negotiable hook
│   ├── PROGRESS.md                 # Session state template
│   ├── DECISIONS.md                # Design log template
│   ├── features.json               # Backlog with state machine
│   ├── permission_check.py         # Risk tier matrix + check function
│   ├── sprint-contract.md          # Pre-task scope agreement
│   └── first-30-minutes.md         # Recipe: empty dir → Phase 1 gate
│
├── worked-examples/                # ← Fully populated artifact sets
│   ├── README.md
│   ├── coding-agent.md             # Phase 0→3 for FlakyFixer
│   ├── research-agent.md           # Phase 0→3 for Citator
│   └── shopping-agent.md           # Phase 0→4 for Procurer
│
├── conversations/                  # Walkthrough track — read in order to learn the field
│   ├── README.md
│   ├── 01-vocabulary.md            # Harness vs agent vs model
│   ├── 02-the-loop.md              # The 7-step loop + wrapper question
│   ├── 03-seven-decisions.md       # The architectural bets, explained
│   ├── 04-shopping-deep-dive.md    # Worked example
│   └── 05-where-sources-disagree.md # Three debates and which dissolve
│
├── core/                           # Reference — depth per component
│   ├── 01-foundations.md           # Harness vs model vs agent; Von Neumann; three levels
│   ├── 02-twelve-components.md     # The 12 components of a production harness
│   ├── 03-loop-in-motion.md        # 7-step cycle, step by step
│   ├── 04-context-and-memory.md    # Context rot, compaction, three-tier memory
│   ├── 05-tools-and-skills.md      # Tool design, MCP, Skills, progressive disclosure
│   ├── 06-subagents.md             # Fork/Teammate/Worktree; fan-out vs pipeline; R.P.I.
│   ├── 07-state-and-persistence.md # Repo as system of record, Ralph Loop
│   ├── 08-verification-and-termination.md  # DoD, L1/L2/L3, pre-stop hook
│   ├── 09-error-handling-and-guardrails.md # 4 error types, permission stages
│   └── 10-observability.md         # Sprint Contract, Rubric, OpenTelemetry
│
├── blueprints/                     # Domain-specific harness recipes
│   ├── 00-README.md
│   ├── 01-coding-agent.md          # Claude-Code-style
│   ├── 02-deep-research-agent.md   # Fan-out research + judge
│   ├── 03-shopping-agent.md        # Money, idempotency, durable execution
│   ├── 04-fashion-agent.md         # Visual taste, wardrobe state
│   ├── 05-multichannel-personal-assistant.md  # Cross-channel PA
│   └── 06-build-your-own.md        # 10-step recipe for novel domains
│
└── sources/
    └── source-notes.md             # Per-source notes + cross-source matrix
```

---

## The harness in one diagram

```
                          ┌────────────────────────────────────────┐
   User input  ──────────▶│                HARNESS                 │
                          │                                        │
                          │   ┌──────────────────────────────┐     │
                          │   │  1. Orchestration loop       │     │
                          │   │     (assemble → call → parse │     │
                          │   │      → tool → loop)          │     │
                          │   └──────────────────────────────┘     │
                          │   ┌──────────┐  ┌──────────┐  ┌─────┐  │
                          │   │ Tools    │  │ Memory   │  │Guard│  │
                          │   │  +Skills │  │  3‑tier  │  │rails│  │
                          │   └──────────┘  └──────────┘  └─────┘  │
                          │   ┌──────────┐  ┌──────────┐  ┌─────┐  │
                          │   │ Context  │  │ State    │  │Verif│  │
                          │   │  mgmt    │  │ persist  │  │ loop│  │
                          │   └──────────┘  └──────────┘  └─────┘  │
                          │                                        │
                          │            ┌──────────────┐            │
                          │            │     LLM      │ ← stateless│
                          │            │  (weights)   │            │
                          │            └──────────────┘            │
                          │   ┌──────────┐  ┌──────────┐  ┌─────┐  │
                          │   │Subagents │  │  Error   │  │Obser│  │
                          │   │ fan‑out  │  │ handling │  │ vab.│  │
                          │   └──────────┘  └──────────┘  └─────┘  │
                          │                                        │
                          └────────────────────────────────────────┘
                                              │
                                              ▼
                                       Tool calls out
                                       Response back
```

The **agent** is the *emergent behavior* a user sees. The **harness** is what makes that emergence reliable.

---

## Five truths that the sources converge on

1. **A great harness beats a great model.** LangChain documented +13.7 points on Terminal Bench 2.0 (52.8 → 66.5, outside top 30 → rank 5) by changing only the harness, model fixed at `gpt-5.2-codex` ([source](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering)). An LLM‑optimized harness ("Meta‑Harness") hit 76.4% pass rate on Claude Opus 4.6, surpassing Terminus‑KIRA ([source](https://yoonholee.com/meta-harness/)). Claude Opus scores higher in Claude Code than in a custom harness.
2. **Reliability is compounded.** 99% per‑step success over 10 steps = ~90.4% end‑to‑end. Verification loops 2–3× quality.
3. **Context rot is real.** Stanford's "Lost in the Middle" + Chroma's "Context Rot" study (18 frontier models tested) confirm degradation across the board. Even million‑token windows suffer instruction‑following degradation.
4. **Every rule should be traceable to a specific failure.** Don't pre‑emptively constrain. Add a line to `AGENTS.md` because something went wrong, then keep that line under audit.
5. **Co‑evolution matters.** Modern frontier models are post‑trained with specific harnesses in the loop. Diverging too far from those primitives degrades model performance. *The future‑proofing test:* if performance scales up with stronger models without harness changes, the design is sound.

## Three places they disagree (and what to do)

1. **Thin vs thick harness.** Anthropic/Claude bet on the model ("dumb loop, smart model"). LangGraph encodes the logic. → For coding agents where the model has been trained, go thin. For novel domains where the model has no prior, go thicker until the model catches up.
2. **Inside vs outside the sandbox.** Single‑user laptop tools (Claude Code) put the loop *inside*. Multi‑user SaaS (Mendral) puts the loop *outside* and virtualizes the filesystem. → Single user / local = inside. Multi‑user / hosted = outside.
3. **One config vs many.** Alex Ker says lean, ~60‑line `AGENTS.md`. walkinglabs says many `.md` files (PROGRESS, DECISIONS, ARCHITECTURE, CONSTRAINTS). → These aren't contradictory: keep the global system prompt lean, and rely on progressive disclosure (named topic files loaded on demand).

Full breakdown in `source-synthesis.md`.

---

## What this folder is NOT

- **Not a tutorial for any specific SDK.** Use Claude Agent SDK / OpenAI Agents SDK docs for that.
- **Not a list of "best practices" without why.** Every recommendation here cites the source and explains the failure mode it prevents.
- **Not static.** Harness engineering is evolving fast (Manus rebuilt 5× in 6 months). Treat anything dated >6 months as suspect.

---

## How to extend this folder

When you finish a project that taught you something the sources missed:
1. Add a short note in the relevant `core/` doc (mark with `> Field note (YYYY‑MM):`).
2. If it's a new pattern, add it to `architectural-decisions.md` or `anti-patterns.md`.
3. If it's a new domain, add a blueprint in `blueprints/`.
4. Keep this README's "five truths / three disagreements" sections updated.

Each rule in this folder should remain *traceable to a specific failure or source*. The ratchet pattern applies to documentation too.
