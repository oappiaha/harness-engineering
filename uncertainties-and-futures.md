# Uncertainties and Futures

A working document on what's *not* settled in this folder. Three categories:

1. **Synthesis uncertainties** — places where this folder went further than the sources.
2. **Field‑level uncertainties** — open problems no source has solved.
3. **Future shifts** — predictions about what changes in 12–18 months.

> **Date:** living document; sections marked with date stamps. Re‑evaluate every quarter.

---

## Recently resolved (May 2026 audit)

A dedicated research pass found primary sources for most of the data points originally flagged as "extrapolated" or "folklore." Summary:

| Claim | Status | Primary source |
|---|---|---|
| LangChain top 30 → rank 5 on Terminal Bench 2.0 by harness change | **CONFIRMED** | [LangChain blog](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering) (+13.7 pts, 52.8 → 66.5, model fixed at `gpt-5.2-codex`) |
| 76.4% pass rate via LLM‑optimized harness | **CONFIRMED** | [Yoonho Lee Meta‑Harness](https://yoonholee.com/meta-harness/) — on Claude Opus 4.6, 89 Dockerized tasks |
| Vercel cut 80% of tools, performance up | **CONFIRMED** with stronger numbers | [Vercel blog](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools) — success 80%→100%, **3.5× faster**, **37% fewer tokens**, **42% fewer steps** |
| Anthropic ~85% context reduction from MCP search | **CONFIRMED** | [Anthropic engineering](https://www.anthropic.com/engineering/advanced-tool-use) — 77K → 8.7K tokens; +25 pts accuracy on Opus 4 |
| Blaxel 25ms resume from standby | **CONFIRMED** | [Mendral blog](https://www.mendral.com/blog/agent-harness-belongs-outside-sandbox) + [Blaxel product page](https://blaxel.ai/sandbox) |
| WIP=1 → 87.5% vs parallel → 37.5% completion | **CONFIRMED** | [walkinglabs lecture 7](https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-07-why-agents-overreach-and-under-finish/) |
| 22× cost ratio: $9 single vs $200 three‑agent | **CONFIRMED** (numbers) / **PARTIAL** (Anthropic attribution) | [walkinglabs lecture 1](https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-01-why-capable-agents-still-fail/) — quoted as "Anthropic ran a controlled experiment" but no Anthropic primary link |
| Chroma 30%+ degradation + Stanford "Lost in the Middle" | **CONFIRMED** | Stanford (Liu et al.) + [Chroma context‑rot study (18 frontier models)](https://www.morphllm.com/context-rot) |

### Updated nuances

| Claim | Refined finding |
|---|---|
| **3.6× faster Plan‑and‑Execute** | **PARTIAL** — the figure is from the **LLMCompiler paper** (Kim et al.), specifically LLMCompiler vs ReAct, cited via [LangChain's Plan‑and‑Execute post](https://www.langchain.com/blog/planning-agents). Not a general "Plan‑and‑Execute" benchmark. Adjust framing in `architectural-decisions.md` and `conversations/03-seven-decisions.md`. |
| **ETH: LLM‑generated AGENTS.md** | **CONFIRMED with caveat** — [MarkTechPost coverage of ETH Zurich study](https://www.marktechpost.com/2026/02/25/new-eth-zurich-study-proves-your-ai-coding-agents-are-failing-because-your-agents-md-files-are-too-detailed/). Performance drop is **~3% (small)** but cost increase **>20% (large)** and **2–4 extra reasoning steps**. The "performance degrades" framing is slightly stronger than the data warrants; the cost framing is solid. |
| **HumanLayer "60‑line AGENTS.md" standard** | **FOLKLORE** as a hard standard; **REAL** as their internal practice. From their own blog: *"general consensus is that < 300 lines is best, and shorter is even better. At HumanLayer, our root CLAUDE.md file is less than sixty lines."* Their authors explicitly say "Your mileage may vary." Treat 60 as a directional target, not a hard rule. |

Affected docs have been updated to reflect these nuances (citations added to `core/02-twelve-components.md`, `core/04-context-and-memory.md`, `core/05-tools-and-skills.md`, and `architectural-decisions.md`).

---

## How to read this doc

Each entry has:

- A claim or open question
- Why it's uncertain
- Confidence level (low / medium / high)
- What would resolve it
- Where it touches the rest of the folder

This is the right place to read **before** taking a major architectural bet that depends on a claim elsewhere in this folder.

---

## Part 1 — Synthesis uncertainties (mine)

Where the folder extrapolated past the sources.

### S1. `pre-stop` hook as "the single highest‑leverage piece of wiring"

**Where it appears:** `core/08-verification-and-termination.md`, `anti-patterns.md`, multiple blueprints.

**Status:** I believe it. The evidence is one walkinglabs case study (Anthropic's playable game) plus the math of premature‑victory failures. **For coding agents it's clearly the dividing line.**

**Uncertainty:** for shopping / research / fashion, the highest‑leverage piece might be different (human confirmation, citation check, visual judge).

**Confidence:** high for coding; medium for "some externalized completion check is the dividing line."

**Resolution:** more domain‑specific production reports. *"Best piece of wiring for X agent class"* would be a useful next post.

---

### S2. The 5‑tier permission model as canonical

**Where it appears:** `architectural-decisions.md`, `core/09-error-handling-and-guardrails.md`, shopping blueprint.

**Status:** synthesized — no source publishes a 5‑tier table. Claude Code has three stages; OpenAI has three guardrail levels; nobody has 5 tiers explicitly.

**Confidence:** medium on the specific bucketing; high on the principle ("gate by reversibility and blast radius").

**Resolution:** field testing on a real shopping agent or comparable. If a tier doesn't trigger in 6 months of production, collapse it. If a class of permission failures doesn't fit any tier, add one.

---

### S3. WIP = 1 magnitude [RESOLVED — confirmed]

**Where it appears:** `core/08-verification-and-termination.md`, anti‑patterns.

**Claim cited:** 87.5% vs 37.5% verified completion (walkinglabs).

**Status (May 2026):** **CONFIRMED.** walkinglabs lecture 7 documents the specific experiment: 8 features attempted; unconstrained "Buffet mode" produced 3 working (37.5%); WIP=1 "Single‑plate" produced 7 working (87.5%). E2E test pass rates were 20% vs 100% respectively.

**Remaining caveat:** still one source's data; magnitudes may vary by domain. Direction is solid.

**Source:** [walkinglabs lecture 7](https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-07-why-agents-overreach-and-under-finish/)

---

### S4. The Vercel 80%‑tool‑cut claim [RESOLVED — confirmed with stronger numbers]

**Where it appears:** `architectural-decisions.md`, `core/05-tools-and-skills.md`.

**Status (May 2026):** **CONFIRMED** — and the actual numbers are stronger than I cited.

Vercel published a detailed blog post documenting:
- Tool count: 16 → effectively 1 (bash)
- Success rate: **80% → 100%**
- Speed: **3.5× faster** (274.8s → 77.4s)
- Tokens: **37% fewer** (~102k → ~61k)
- Steps: **42% fewer** (~12 → ~7)

**Source:** [Vercel blog — "We removed 80% of our agent's tools"](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools)

---

### S5. The five blueprints — not all field‑tested

**Where it appears:** `blueprints/`.

**Status:**
- `01-coding-agent.md`: high confidence (matches major coding agents).
- `02-deep-research-agent.md`: medium‑high (deep research products exist; architectures partial).
- `03-shopping-agent.md`: high on architecture (e‑commerce patterns are well known); medium on specifics.
- `04-fashion-agent.md`: **speculative**. Less production precedent; pattern application is logical but unverified.
- `05-multichannel-personal-assistant.md`: medium. OpenClaw exists but isn't a mature reference.

**Confidence:** treat 04 and 05 as **opinionated starting points, not field‑tested designs.**

**Resolution:** build one and report back. Add field notes when patterns hold or break.

---

### S6. The "lean vs many" reconciliation

**Where it appears:** `architectural-decisions.md` Beyond‑seven debate C, `core/04-context-and-memory.md`.

**Status:** the reconciliation by scope (always loaded ≠ available) is mine. The sources don't explicitly bridge them this way.

**Confidence:** high — the reconciliation is straightforward once you separate loading semantics from file count. But it's an interpretation, not a quote.

**Resolution:** test against more sources as they emerge.

---

### S7. The Gather→Act→Verify framing across non‑coding domains

**Where it appears:** `core/03-loop-in-motion.md`.

**Status:** Claude Code uses this explicitly for coding. I generalized to other domains without strong evidence.

**Confidence:** high for any task with executable specs; medium for taste/judgment domains where "verify" is fuzzy.

**Resolution:** test on a fashion or design agent and see if the phases stay clean or blur.

---

### S8. The cross‑source matrix accuracy

**Where it appears:** `source-synthesis.md`, `sources/source-notes.md`.

**Uncertainty:** I built it from five sources; possible I attributed a position to one author that another also held, or missed a position altogether.

**Confidence:** medium — careful but not exhaustive.

**Resolution:** corrections welcome. The matrix is a starting point, not an authoritative attribution.

---

## Part 2 — Field‑level uncertainties

These are gaps where no source has a great answer.

### F1. Multi‑agent coordination on shared state

**Question:** how do multiple agents working on the same codebase / DB / wardrobe coordinate without deadlocks, duplicated work, or silent conflicts?

**State of the field:** Addy Osmani explicitly flags this as open. Mendral admits "last‑writer‑wins for concurrent org‑level memory updates" is unresolved.

**Classic answers that apply but aren't operationalized:** locks, optimistic concurrency, CRDTs, event sourcing.

**Confidence in current best practice:** low. Most production systems just use single‑agent‑per‑resource.

**Watch:** this will be a significant component of any agent platform at scale.

---

### F2. Cost economics at production scale

**Question:** what's the cost curve for an agent serving 10K users over 3 months? What dominates? What can be cached/batched/routed?

**State of the field:** $9 vs $200 is the most‑quoted number; it's one case study. Real cost models, caching strategies, multi‑model routing, per‑user budgets are barely covered.

**Confidence in current best practice:** low. Lots of folklore, few public case studies.

**Watch:** expect at least one major public post‑mortem in 2026–2027. When it lands, integrate.

---

### F3. Evaluation of evaluators

**Question:** when we use LLM‑as‑judge, how do we know the judge is reliable?

**State of the field:** recursive judges (judge the judge) are unsatisfying. Human review of a sample is the honest answer but no source operationalizes the methodology.

**Confidence in current best practice:** low. *Doing* inferential evaluation is solved; *trusting* it isn't.

**Watch:** likely to develop into a sub‑discipline (eval ops?).

---

### F4. Privacy / regulated industries

**Question:** what does a GDPR / HIPAA / SOC2‑compliant harness look like? Right‑to‑forget for long‑term memory? PHI handling? Audit trails at the loop layer?

**State of the field:** Mendral touches credential isolation. Otherwise barely covered.

**Confidence in current best practice:** low for harness‑specific patterns; high for general regulated software patterns that apply.

**Watch:** as agents enter regulated industries, expect industry‑specific guides.

---

### F5. Cold start with no prior `AGENTS.md`

**Question:** what does the first 30 minutes with an empty repo and no harness config look like?

**State of the field:** walkinglabs's lecture 6 covers initialization but assumes you know what should be in `AGENTS.md`.

**Likely workflow (my speculation):**

1. Spawn an exploration subagent to map the codebase.
2. Have it draft `ARCHITECTURE.md`.
3. Human reviews and edits.
4. Generate initial `AGENTS.md` from the draft + workflow questions.

**Confidence in current best practice:** medium. The pattern is reasonable but unpublished.

---

### F6. Multi‑provider routing inside one harness

**Question:** how do you architect a harness that routes some tasks to Claude, others to GPT, others to a local model — with cost and quality awareness?

**State of the field:** Alex Ker mentions multi‑model fan‑out. Architecture isn't worked out.

**Confidence in current best practice:** low for production patterns.

**Watch:** expect this to land as a feature in major SDKs within 12 months.

---

### F7. Right‑sizing observability

**Question:** what's the minimum observability that gives you debugging power without spending too much on traces?

**State of the field:** everyone agrees it matters; nobody quantifies "how much."

**Confidence in current best practice:** medium for general principles (sample tail traces, span per task, cost meter); low for domain‑specific tuning.

---

### F8. The cost of co‑evolution lock‑in

**Question:** if frontier models are post‑trained with specific harnesses, what does it cost to switch providers? How do you architect to mitigate lock‑in?

**State of the field:** Akshay acknowledges co‑evolution; nobody publishes a mitigation strategy.

**Mendral's path dispatch** is the closest published technique — it preserves a trained API surface (Claude Code's filesystem) while extending the backend. But that protects you within one provider, not across.

**Confidence in current best practice:** low. This will become a strategic question for large customers.

---

## Part 3 — Predicted shifts (12–18 months)

Confidence labels: **H** = high, **M** = medium, **L** = low‑but‑directional.

### H1. Tool search becomes universal (H)

Today: Claude Code has MCP search; Codex / OpenCode load everything.
Soon: search‑based loading is default everywhere. The "load all at startup" pattern goes away because context cost is too obvious once measured.

**Implication for the folder:** the "Tool Scoping" decision (#6) becomes less of a choice and more of an "everyone scopes; the question is just *how*."

### H2. Hooks become first‑class everywhere (H)

Today: Claude Code's hook system is the most mature.
Soon: every major harness has equivalent fidelity. Non‑negotiables are deterministic only when the harness enforces them, not the model.

**Implication:** the recommendations around `pre-stop`, `pre-commit`, `post-edit` hooks are likely to remain stable across frameworks.

### H3. The vocabulary shifts (H — confident about the shift; uncertain what to)

"Harness" is a 2026 term. By 2027 I expect a new word — *runtime, substrate, agent OS, fabric.* The concept survives; the noun won't.

**Implication:** search this folder's terminology against current sources every 6–12 months.

### M1. HaaS consolidation (M)

5+ major frameworks today. In 12–18 months: probably 2–3 dominant.

**My guess:** Claude Agent SDK, OpenAI Agents SDK, and one graph‑based option (LangGraph or successor). CrewAI and AutoGen consolidate or pivot.

**Implication:** `framework-comparison.md` will need a rewrite within a year.

### M2. Skills become richer than markdown (M)

Today: SKILL.md + referenced scripts.
Soon: explicit IO contracts, dependency declarations, versioning, registry pattern. Closer to packages than to prompts.

**Implication:** `core/05-tools-and-skills.md` Part 4 needs revisiting when this lands.

### M3. Agents analyzing their own traces (M)

Addy Osmani's prediction. The trace‑analysis → harness‑improvement loop becomes the next layer. Within 12 months expect a major framework to ship "analyze trace archive, propose AGENTS.md changes" as built‑in.

**Implication:** observability becomes input to the harness, not just output.

### M4. Multi‑modal as table stakes (M)

Visual feedback, voice in, screen describe become expected.

**Implication:** the fashion blueprint stops being speculative when models can actually *see* clothes. The verification surface widens — Playwright‑style "look at the actual UI" goes from advanced to default.

### L1. Verification moves partially into the model (L)

Today: external (`make check`).
Soon: hybrid — model self‑proposes verification; harness executes; separate evaluator grades.

**Implication:** the Computational vs Inferential decision (#4) gets a third option: "model‑proposed, harness‑executed."

### L2. The line between framework and model blurs (L)

Co‑evolution intensifies. Choosing a framework starts to look like choosing a model.

**Implication:** "framework choice" might not be the right framing in 12 months. It becomes "which model+harness pair am I betting on."

### L3. Thin wins for more domains (L)

As models improve on non‑coding domains, thick harnesses for those domains become legacy.

**Fashion is the canonical test case.** My guess: 18–24 months until a frontier model is good enough at outfit composition that the thick harness in `blueprints/04-fashion-agent.md` becomes overkill.

### L4. Cost meters become default (L)

Today: cost is an afterthought.
Soon: per‑task budgets, cost‑aware routing, cost meters as a default component.

**Implication:** `core/10-observability.md` Part 7 (cost meter) moves from "should have" to "must have."

---

## What's most likely to age badly

If I had to bet which parts of this folder look wrong in 12 months:

| Section | Likely aging |
|---|---|
| `framework-comparison.md` recommendations | **Fast** — framework consolidation |
| Specific data points (22×, 87.5%, 25ms, 80%) | **Fast** — replaced by newer benchmarks |
| `core/05-tools-and-skills.md` MCP specifics | **Medium** — MCP itself is evolving |
| Architectural principles (thin vs thick, lean vs many) | **Slow** — these are general engineering wisdom |
| `anti-patterns.md` | **Slow** — failure modes lag behind success modes |
| `core/01-foundations.md` vocabulary | **Slow** — until the term "harness" itself gets replaced |

The synthesis is most useful as a **map of the territory**, less useful as **specific directions through it.**

---

## How to maintain this doc

1. When you discover a synthesis uncertainty has been resolved (or refuted), move it to a "resolved" section with date and source.
2. When a predicted shift lands, mark it confirmed; if it doesn't land in the predicted window, downgrade the confidence.
3. Add new entries when:
   - You make a claim in another doc that you can't fully back up → log it here.
   - You hit a problem the sources don't address → log it here.
   - A new source contradicts something in this folder → log it here.

This doc is the corrective lens for the rest of the folder. Keep it honest.

---

## Cross‑references

- The claims being hedged: throughout `core/`, `blueprints/`, `anti-patterns.md`
- The synthesis matrix this doc qualifies: `source-synthesis.md`
- Sources themselves: `sources/source-notes.md`
