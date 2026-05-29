# Blueprints — How to Read

A blueprint is a **domain‑specific harness recipe.** It takes the general patterns from `core/` and instantiates them for a concrete use case.

---

## Blueprint structure

Every blueprint in this folder follows the same 10‑section format. If you build your own, use this template.

```
1. One‑line description and target user
2. Why this domain needs a custom harness (vs. raw LLM)
3. Architecture diagram (ASCII)
4. Core decisions (filled in from `architectural-decisions.md`)
   - Thin vs thick
   - Inside vs outside sandbox
   - Single vs multi-user
   - Memory / state / verification approach
5. Tool inventory — the domain‑specific tools the agent needs
6. State files — what lives in the repo / DB
7. Subagent topology — fan‑out? pipeline? when to spawn
8. Verification strategy — what proves "done"
9. Build steps (10‑step recipe)
10. Failure modes specific to this domain
```

---

## The universal skeleton (applies to every blueprint)

Whatever the domain, you need these seven things. Blueprints layer domain specifics on top.

```
   ┌─────────────────────────────────────────────────────────┐
   │                                                         │
   │   1. Loop (assemble → call → tool → loop)               │
   │   2. Tools (domain‑specific verbs)                      │
   │   3. Context strategy (lean system prompt + on‑demand)  │
   │   4. Memory (3‑tier: index → topic → raw)               │
   │   5. State (PROGRESS.md, DECISIONS.md, features.json)   │
   │   6. Verification (L1 / L2 / L3 + pre‑stop hook)        │
   │   7. Observability (OTel trace + cost meter)            │
   │                                                         │
   └─────────────────────────────────────────────────────────┘
```

If your blueprint can't tell me how each of these seven is handled, it's not a blueprint — it's a sketch.

---

## Choosing a blueprint

| If you're building… | Start here |
|---|---|
| A coding agent | `01-coding-agent.md` |
| Agentic deep research | `02-deep-research-agent.md` |
| Agentic shopping (cart, checkout, preferences) | `03-shopping-agent.md` |
| A fashion / outfit / wardrobe agent | `04-fashion-agent.md` |
| A personal assistant across messaging channels | `05-multichannel-personal-assistant.md` |
| Something not on this list | `06-build-your-own.md` (10‑step recipe + worksheet) |

---

## How blueprints relate to frameworks

The blueprint tells you *what* you need. The framework tells you *how*. Most blueprints can be built on **any** of the frameworks in `../framework-comparison.md` — but some are easier on some frameworks than others.

Each blueprint includes a "framework fit" note in section 4.

---

## What a blueprint is NOT

- **Not a code generator.** No blueprint produces a working agent without engineering.
- **Not a complete spec.** Real systems need legal, payments, privacy, observability backends, etc.
- **Not version‑locked.** As models improve, the "thin vs thick" recommendation in a blueprint may shift. Re‑evaluate every release.

Each blueprint is **a starting point opinionated by the synthesis in this folder.** Modify aggressively to fit your context.
