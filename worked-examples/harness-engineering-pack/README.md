# harness-engineering-pack

A Pi extension that implements the framework's **portable non-negotiables** as the
outer Safety & Scale ring around Pi's thin inner loop. The honest, buildable form of
*"Pi as substrate + our framework as the outer ring"* — valid **only at Pi's coordinate**
(single-user · inside-sandbox · coding-adjacent · permissive-OK).

## What ports cleanly vs. what doesn't

| Framework non-negotiable | In this pack | Fidelity |
|---|---|---|
| `pre-stop` verification gate (#1) | `agent_end` → run `make check` → re-drive on failure | ⚠️ **re-drive, not a true veto** — Pi exposes no stop-veto (`agent_end`/`turn_end` carry no result type, verified `types.ts:642,655`) |
| Tiered permissions (#2) | `tool_call` → risk tier → `ui.select` / typed confirm / `block` | ✅ faithful |
| Independent evaluator (#3) | `/evaluate` → separate `pi` process, different model + rubric | ✅ faithful (mirrors Pi's own subagent-as-separate-process pattern) |
| Observability + cost (#7) | provider/tool hooks → cost meter + `/cost`; OTel stubbed | ✅ structure faithful; real OTel wiring is project-specific |
| Ratchet log (#8) | `/ratchet` → appends `DECISIONS.md` | ✅ faithful |

## What it structurally CANNOT do (route elsewhere)

Multi-user identity · credentials-with-loop · outside-sandbox execution · durable
mid-loop resume. These are properties of **where the loop process runs**, not behaviors
a plugin can add. For any of them, Pi is the wrong substrate — see
`../../architectural-decisions.md` (Beyond-seven debate A) and route to outside-sandbox
+ durable execution (Mendral pattern).

## Status

**Skeleton.** `TODO` markers flag the two spots needing API confirmation against your Pi
version: the print/JSON flags for the evaluator process, and the provider `usage` shape
in `after_provider_response`. Everything else is wired against verified API surface.

## Install (once finished)

```
# global:  ~/.pi/agent/extensions/harness-engineering-pack/
# project: .pi/extensions/harness-engineering-pack/
# then /reload (auto-discovered locations hot-reload)
```
