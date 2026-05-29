# Harness Design — Phase 0 Worksheet

> Fill this out **before any code**. The 5 pre‑flight questions + 7 decisions live here. Reference: `FRAMEWORK.md`.
>
> **Operator (Claude Code session) instructions:** ask the user each question; transcribe their answer here verbatim. If the user says "I don't know yet," push back — pre‑flight gaps cost weeks later. If they truly don't know, log it as a known unknown and proceed with explicit warnings.

---

## Project

**One‑sentence value proposition:**
> TODO: `<Agent name>` helps `<user persona>` do `<task class>` by `<core capability>`.

Example: *"FlakyFixer helps backend engineers at our company fix flaky tests in the auth service without leaving the terminal."*

---

## Pre‑flight: 5 questions

### Q1 — Who is the user, and what is the smallest thing the agent does that's valuable?

> TODO: Write a single concrete sentence. Bad: "power users." Good: "a backend engineer fixing flaky tests in auth without context-switching."

**Derivations from this answer:**
- Primary user archetype: TODO
- Core task: TODO
- Smallest valuable unit: TODO
- Alternative the user has today: TODO

### Q2 — Single‑session or multi‑session? Hours? Days? Weeks?

> TODO: Pick one of: `minutes/single-window` / `hours/single-window` / `days/multi-window` / `weeks+`

**Implications:**
- If `days/multi-window` or `weeks+`: Ralph Loop **mandatory**, durable execution **mandatory**.
- If `hours+`: cost cap and verification required.
- If `minutes`: standard loop is fine.

### Q3 — Is the model co‑trained on this domain?

> TODO: Pick one of: `yes` / `mostly` / `mostly no` / `no`

**Calibration:**
- `yes` — coding, web tasks, text summarization. → thin harness.
- `mostly` — research, writing, analysis. → medium‑thin + verification.
- `mostly no` — fashion judgment, vertical workflows, regulated processes. → thick.
- `no` — proprietary domain knowledge. → thick + custom data + frequent re‑eval.

### Q4 — What's the risk tier of the most impactful action?

> TODO: Pick highest tier present: `Tier 0` / `Tier 1` / `Tier 2` / `Tier 3` / `Tier 4`

**Tiers:**
- `Tier 0` — Read only (grep, search, fetch)
- `Tier 1` — Mutate local state (file edit, write memory)
- `Tier 2` — Mutate user state (cart add, calendar event)
- `Tier 3` — External effect (deploy, charge, send message) → **always confirm**
- `Tier 4` — Irreversible (drop DB, mass send, big spend) → **typed confirm + cooldown**

**If Tier 3+ exists:** permission UX must be explicit; idempotency keys mandatory.

### Q5 — Single user (local) or multi‑user (hosted)?

> TODO: Pick one of: `single user, local CLI` / `single user, hosted per-user infra` / `multi-user, shared infra` / `compliance/regulated`

**Implications:**
- Local CLI → inside sandbox. Standard SDK.
- Per‑user hosted → inside sandbox fine.
- Multi‑user shared → **outside sandbox** (Mendral 3 pillars: durable exec, sandbox lifecycle, filesystem virtualization).
- Compliance → outside sandbox + audit at loop layer + per‑user data isolation.

---

## Derived decisions (Akshay's 7)

Fill these in *after* the 5 questions, since each is derived.

### 1. Agent Count: single vs multi‑agent

> TODO: single / multi
>
> Reasoning: TODO (often: multi if Phase 3 needs an independent evaluator)

### 2. Reasoning Strategy: ReAct vs Plan‑and‑Execute vs R.P.I.

> TODO: ReAct / Plan-and-Execute / R.P.I.
>
> Reasoning: TODO (often: R.P.I. for high-stakes; ReAct for novel/exploratory)

### 3. Context Strategy: aggressive compaction vs rich context

> TODO: aggressive / rich / hybrid
>
> Reasoning: TODO (cost-sensitive → aggressive; recall-sensitive → rich)

### 4. Verification: computational vs inferential

> TODO: computational / inferential / both
>
> Reasoning: TODO (use both whenever possible; computational catches "broken," inferential catches "not good")

### 5. Permissions: tiered (default)

> TODO: confirm tiered + write the risk tier table for your tools
>
> Tools and tiers: TODO (fill `permission_check.py` after this section)

### 6. Tool Scoping: full toolkit vs minimal per step

> TODO: full / minimal-per-step
>
> Reasoning: TODO (Vercel cut 80% of tools → success 80%→100%; default to minimal where SDK supports)

### 7. Harness Thickness: thin vs thick

> TODO: thin / medium / thick
>
> Reasoning: TODO (matches Q3 — coding → thin, fashion → thick, etc.)

---

## Framework choice

> TODO: Claude Agent SDK / OpenAI Agents SDK / LangGraph / CrewAI / MS Agent Framework / OpenCode / Custom

**Reasoning:** TODO (link to specific feature you need from this SDK)

📖 *Decision matrix:* `framework-comparison.md`, `sdk-current-state.md`.

---

## Blueprint chosen

> TODO: `01-coding-agent` / `02-deep-research-agent` / `03-shopping-agent` / `04-fashion-agent` / `05-multichannel-personal-assistant` / `06-build-your-own`

**Modifications from the blueprint:** TODO (where does your project differ from the blueprint? Document deviations.)

---

## Open questions / known unknowns

Things the user couldn't answer in pre‑flight. Each is a risk that needs revisiting.

- TODO

---

## Sign‑off

- [ ] All 5 pre‑flight questions answered
- [ ] All 7 decisions locked with reasoning
- [ ] Framework chosen
- [ ] Blueprint chosen
- [ ] Known unknowns logged
- [ ] User has reviewed and approved this document

**Once signed off, proceed to Phase 1 (Skeleton).** Reference: `FRAMEWORK.md`.
