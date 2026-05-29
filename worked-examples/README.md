# Worked Examples

> Real Phase 0 → Phase 3 walkthroughs with **actual filled‑in artifacts** for three blueprint domains. Use these as concrete reference when the abstract `blueprints/` and `FRAMEWORK.md` aren't enough.

## What's here

| File | Domain | Use when |
|---|---|---|
| `coding-agent.md` | Coding agent (Blueprint 01) | Most common case — you're building dev tooling |
| `research-agent.md` | Deep research (Blueprint 02) | Multi‑source synthesis with citations |
| `shopping-agent.md` | Shopping / money (Blueprint 03) | Tier 3+ irreversible operations |

Each shows:
- Filled‑in `harness-design.md` (pre‑flight + 7 decisions)
- Filled‑in `AGENTS.md`
- Actual `Makefile` for the domain
- `features.json` with 5+ real features
- `DECISIONS.md` with 3–5 design log entries
- Architecture sketch
- Phase 1 → Phase 3 progression

## How to use these

Don't copy verbatim — these are *opinionated worked examples for a specific project*, not templates. Read them to see *what the artifacts look like when this works.* Then go back to `templates/` for the blank versions and `FRAMEWORK.md` for the process.

## Why three blueprints (and not all six)

Coding, research, and shopping cover the three biggest archetypes:
- **Coding** = the densest co‑training, thinnest harness, computational verification.
- **Research** = open‑ended output, fan‑out subagents, inferential verification.
- **Shopping** = irreversible side effects, tier‑3+ permissions, durable execution.

Fashion (Blueprint 04) and multichannel (Blueprint 05) are extensions/specializations of these patterns. If your project doesn't match these three exactly, pick the closest and adapt.

If your project doesn't match any of these, read `blueprints/06-build-your-own.md` and the worked example closest to your risk profile.
