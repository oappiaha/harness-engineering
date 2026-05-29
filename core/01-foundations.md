# 01 — Foundations

> *"If you're not the model, you're the harness."* — Vivek Trivedy, LangChain

This doc establishes the vocabulary. Read it once; the rest of `core/` assumes you have it.

---

## 1. What an agent harness is

The term was formalized in early 2026 but the concept existed long before. The harness is the **complete software infrastructure wrapping an LLM**:

- Orchestration loop
- Tools
- Memory
- Context management
- State persistence
- Error handling
- Guardrails
- Verification
- Observability

Anthropic's Claude Code documentation puts it simply: the SDK is "the agent harness that powers Claude Code." OpenAI's Codex team uses the same framing — explicitly equating *agent* and *harness* to refer to non‑model infrastructure.

### Agent vs harness — the distinction that trips people up

- The **agent** is the *emergent behavior*: the goal‑directed, tool‑using, self‑correcting entity a user interacts with.
- The **harness** is the *machinery producing that behavior*.
- When someone says "I built an agent," they built a harness and pointed it at a model.

---

## 2. The Von Neumann analogy (Beren Millidge, 2023)

A raw LLM is a CPU with no RAM, no disk, no I/O.

| Computer | LLM Agent |
|---|---|
| CPU | LLM (model weights) |
| RAM | Context window (fast, limited) |
| Hard disk | Vector DB / long‑term storage (large, slow) |
| Device drivers | Tool integrations |
| **Operating system** | **Agent harness** ← the key layer |
| Application | Agent (emergent behavior) |

> *"We have reinvented the Von Neumann architecture, because it's a natural abstraction for any computing system."* — Millidge, *Scaffolded LLMs as Natural Language Computers*

Implication: **a raw LLM is a CPU with no OS. The harness is the OS that makes it useful.**

---

## 3. The three concentric levels of engineering

```
    ┌────────────────────────────────────────────┐
    │           Harness engineering              │
    │  (tools, state, errors, verification,      │
    │   safety, lifecycle)                       │
    │   ┌────────────────────────────────────┐   │
    │   │       Context engineering          │   │
    │   │  (what the model sees and when)    │   │
    │   │   ┌──────────────────────────┐     │   │
    │   │   │   Prompt engineering     │     │   │
    │   │   │  (instructions to model) │     │   │
    │   │   └──────────────────────────┘     │   │
    │   └────────────────────────────────────┘   │
    └────────────────────────────────────────────┘
```

- **Prompt engineering** crafts instructions the model receives.
- **Context engineering** manages what the model sees and when (compaction, retrieval, ordering).
- **Harness engineering** is the outermost ring — it encompasses both, *plus* tool orchestration, state persistence, error recovery, verification loops, safety enforcement, and lifecycle management.

The harness is **not a wrapper around a prompt.** It is the complete system that makes autonomous agent behavior possible.

---

## 4. The scaffolding metaphor (and why it matters)

Construction scaffolding is **temporary infrastructure that enables workers to build a structure they couldn't reach otherwise.** It doesn't do the construction — but workers can't reach the upper floors without it.

```
   The Agent (emergent)
        │
        ▼
   ┌─────────────┐         ┌────────────────┐
   │             │         │ As models      │
   │  THE BUILD  │         │ improve, the   │
   │             │ ──────▶ │ scaffolding    │
   │             │  time   │ comes down.    │
   └─────────────┘         └────────────────┘
        ▲ scaffolding (the harness):
        │ tools, memory, context mgmt, hooks,
        │ guardrails, error handling, loop
```

Key insight: **scaffolding is removed when the building is complete.** As models improve, harness complexity *should* decrease. Manus rebuilt its harness 5× in 6 months — each rewrite removed scaffolding (complex tool definitions → general shell execution; management agents → simple structured handoffs).

### Co‑evolution principle

Frontier models are now **post‑trained with specific harnesses in the loop.** Claude's model learned to use the specific harness it was trained with. Changing tool implementations can *degrade* performance because of this tight coupling.

> **Future‑proofing test:** if performance scales up with stronger models *without adding harness complexity*, the design is sound.

---

## 5. The thin vs thick spectrum

A core architectural bet: how much do you trust the model versus encode logic in code?

```
       Bet on model improvement          Bet on explicit control
   THIN ◀──────────────────────────────────────────────────▶ THICK
        │              │              │              │
   Claude          OpenAI         CrewAI         LangGraph
   Agent SDK       Agents SDK     Flows
        │              │              │              │
   "trust the     "code‑first"   "control the    "harness encodes
    model"                        flow"            the logic"
```

| Position | Mechanic | When to choose |
|---|---|---|
| **Thin (Claude Agent SDK)** | One `query()` function returning an async iterator. Runtime is a "dumb loop." Model decides everything. | Coding agents; domain where model is co‑trained; you trust frontier capability. |
| **Code‑first (OpenAI Agents SDK)** | Workflow expressed in native Python (Runner class, async/sync/streamed). | Multi‑agent handoffs with type safety; teams that prefer code over DSL. |
| **Role‑based (CrewAI)** | Agent (role/goal/backstory/tools) + Task + Crew. Flows layer adds deterministic backbone. | Multi‑agent collaboration where roles map to a clear team metaphor. |
| **Graph‑based (LangGraph)** | Typed dictionaries flow through graph nodes; reducers merge updates; checkpointing at super‑step boundaries. | Long‑running workflows; auditable state transitions; time‑travel debugging. |

As models improve, **the bar shifts left** (toward thin). For a novel domain where no model has been co‑trained, **thicker is appropriate** until a frontier model catches up.

---

## 6. The mechanical core: the loop

Mechanically, every harness is **a while loop** running the Thought‑Action‑Observation (TAO) / ReAct cycle:

```
while True:
    prompt = assemble(system, tools, memory, history, user_msg)
    response = llm(prompt)
    if response.has_tool_calls:
        results = execute(response.tool_calls)  # sandboxed, validated
        history.append(results)
    else:
        return response  # final answer
```

The complexity is **not in the loop itself**. The complexity lives in everything the loop manages: prompt assembly, tool execution, context budgeting, state checkpointing, error recovery, guardrails, verification.

Anthropic describes their runtime as a "dumb loop" where all intelligence lives in the model. The harness just manages turns.

Full step‑by‑step walkthrough → `03-loop-in-motion.md`.

---

## 7. Three definitions you should be able to recite

- **Harness:** complete software infrastructure wrapping an LLM.
- **Agent:** emergent behavior the user sees.
- **Context engineering:** the goal is to find the *smallest possible set of high‑signal tokens* that maximizes likelihood of the desired outcome. (— Anthropic context engineering guide)

If you can't keep these three straight, the rest of the docs will trip you up.

---

## 8. Five truths you'll see in every doc

1. **Reliability compounds.** 99% per‑step success × 10 steps ≈ 90.4% end‑to‑end. Verification 2–3× quality.
2. **Context rot is real.** Mid‑window content is missed; long contexts degrade instruction following.
3. **Every constraint should trace to a failure.** Ratchet pattern: add rules only after specific incidents.
4. **Memory is a hint, not ground truth.** The harness verifies against actual state before acting.
5. **Scaffolding is temporary.** As models improve, harness complexity should decrease.

---

## 9. Reading order from here

| Goal | Next doc |
|---|---|
| See all the moving parts | `02-twelve-components.md` |
| Trace one cycle end‑to‑end | `03-loop-in-motion.md` |
| Avoid context disasters | `04-context-and-memory.md` |
| Build tools right | `05-tools-and-skills.md` |
| Decide architectural bets | `../architectural-decisions.md` |
| Apply to a domain | `../blueprints/` |
