# 05 — Tools and Skills

Tools are the agent's hands. Skills are progressive‑disclosure wrappers around them. This is the layer where most "harness vs. framework" arguments actually live.

---

## Part 1 — The tool layer

A tool is a **schema** (name, description, parameter types) the model can call. The tool layer handles:

1. **Registration** — declare schemas to the model.
2. **Schema validation** — sanity‑check arguments.
3. **Argument extraction** — parse from model output.
4. **Sandboxed execution** — run in controlled environment.
5. **Result capture.**
6. **Formatting** — results back to LLM‑readable observations.

### Native tool calling vs free‑text parsing

Modern frontier models return structured `tool_calls` objects. The harness checks:

```
if response.tool_calls:
    for call in response.tool_calls:
        validate(call)
        check_permissions(call)
        result = execute(call)
        append_to_history(result_as_tool_message)
else:
    return response.text  # final answer
```

Free‑text parsing (regex over `Action: bash\nInput: ls`) is a legacy pattern. Avoid it; native calling eliminates an entire class of brittleness.

### Structured outputs

When you need a typed return (not a tool call but a structured answer), both OpenAI and LangChain support **Pydantic‑schema‑constrained responses.** Use this for tasks like "return the parsed receipt as JSON" — don't ask the model to format JSON by hand.

Legacy fallback: `RetryWithErrorOutputParser` (feeds original prompt + failed completion + parsing error back). Still useful for edge cases where you can't use native structured outputs.

---

## Part 2 — Tool categories

Claude Code's six categories are a useful checklist for *any* coding‑adjacent harness:

| Category | Examples | Notes |
|---|---|---|
| **File operations** | read, write, edit, glob | Mutating ops must serialize |
| **Search** | grep, ripgrep, semantic search | Read‑only — can parallelize |
| **Execution** | bash, npm, docker | High‑risk — gate with permissions |
| **Web access** | fetch, search | Idempotent if `GET`; cache aggressively |
| **Code intelligence** | LSP, tree‑sitter, AST | Often beats grep for structural queries |
| **Subagent spawning** | task, fork, worktree | The recursive case |

For non‑coding domains, build domain‑equivalents:
- **Shopping:** catalog search, cart ops, checkout, payment, fulfillment.
- **Research:** web search, citation extraction, document chunking, summarization.
- **Fashion:** wardrobe read, look composition, retailer fetch, image gen.
- **Personal assistant:** calendar, email, messaging channels, home automation.

---

## Part 3 — Tool design principles

### Ten focused tools beat fifty overlapping ones

Addy Osmani: *"ten focused tools outperform fifty overlapping ones."* Every tool description **populates the prompt every turn** (or is searchable, in progressive‑disclosure systems). Bloat hurts.

The Mendral pattern (path‑based dispatch) is one solution: **one tool surface, multiple backends.** `filesystem_read` routes `/workspace/*` to the sandbox and `/skills/*` and `/memory/*` to Postgres. Same tool surface the model knows from training, two real backends.

> Avoiding separate `memory_read` / `memory_write` tools matters because:
> - More tools reduce model attention per tool.
> - Duplicates create disambiguation problems.
> - Frontier models are RL‑trained on harnesses that look like Claude Code; preserving the trained API surface preserves performance.

### Read‑only vs mutating concurrency

| Type | Concurrency |
|---|---|
| Read‑only | Can run **in parallel** |
| Mutating | Must run **serially** to keep state coherent |

Most SDKs surface this as a flag. Concurrency without serialization on mutating ops is a common production bug (race conditions in file edits).

### Specific, keyword‑rich descriptions

When tool discovery is search‑based (Claude Code's MCP search), descriptions must be **specific and keyword‑rich**. Vague descriptions ("does various things with files") never match.

### Bash as the catch‑all is a feature, not a bug

Manus rewrites: "complex tool definitions became general shell execution." As models get smarter, **shelling out beats hand‑crafted tools for the long tail.** Don't build a `git_status` tool — let the model run `git status` in bash. Build a tool only when:
- Shell wouldn't work (sandboxed env, non‑shell semantics)
- You need permission gating that shell can't enforce
- The operation must be auditable / typed (cart checkout, payment)

**Hard evidence: the Vercel case.** Vercel published a detailed post‑mortem on cutting their agent's tool surface from 16 tools down to effectively one (bash). Results: success rate **80% → 100%**, **3.5× faster** (274.8s → 77.4s), **37% fewer tokens** (~102k → ~61k), **42% fewer steps** (~12 → ~7). One of the cleanest production demonstrations of "fewer focused tools beat many overlapping ones." Source: [Vercel — "We removed 80% of our agent's tools"](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools).

---

## Part 4 — Skills: the progressive‑disclosure wrapper

A **skill** is a named, descriptive unit of capability whose full instructions are loaded **only when the model decides it's relevant.**

The industry convergence (Claude Code, Codex, OpenCode):

```
session start:
  load skill names + descriptions (~50 lines total)

at runtime, when model picks a skill:
  read full SKILL.md (could be 500 lines)
  load any referenced files / scripts on demand
```

### Skill anatomy

```
skills/
└── deploy-staging/
    ├── SKILL.md             ← description + body
    ├── deploy.sh            ← referenced script
    └── rollback.sh          ← referenced script
```

`SKILL.md` structure:

```markdown
---
name: deploy-staging
description: Deploy a service to the staging environment. Use when user asks to "deploy", "ship to staging", or after merging a feature PR.
---

# Deploying to staging

## Preconditions
- Branch is merged to main
- CI green on main
- No active deploy lock

## Steps
1. Check the lock: `./scripts/check-lock.sh`
2. Deploy: `./deploy.sh <service-name>`
3. Verify: `curl -f https://staging.example.com/healthz`
4. Update PROGRESS.md
```

### Why this works

- Names + descriptions are short → low context cost when always loaded.
- Full bodies are large → loaded only when needed.
- Skills can reference scripts → scripts loaded only when invoked.
- Composable — a skill can mention other skills.

Codex's docs explicitly call this **"progressive disclosure"** and credit it as core to keeping context clean.

### Where skills shine vs. plain prompts

| Use a skill when… | Use the system prompt when… |
|---|---|
| Procedure is invoked occasionally | Behavior applies to every turn |
| Procedure has steps + verification | Rule is single‑line |
| Procedure has referenced scripts / files | No external artifacts |
| You want it discoverable, not always present | It must always be true |

---

## Part 5 — MCP (Model Context Protocol)

MCP is the open standard for connecting LLMs to external tools / data sources. As of mid‑2026, **the divergence between harnesses is largest at the MCP layer.**

| Harness | MCP handling |
|---|---|
| **Claude Code** | Built‑in tool search: lightweight index at startup, full schemas on demand → **~85% context reduction** |
| **Codex CLI** | Loads ALL configured MCP tool definitions at session start |
| **OpenCode** | Loads all tool definitions at session start; docs warn users to limit which servers they enable |

If your harness doesn't do MCP search, you must **manage this yourself**:
- Be selective about which servers you connect per project.
- Write tool descriptions that are specific and keyword‑rich.
- **Disconnect irrelevant or unused MCPs** to save on context and inference tokens.

### MCP tool descriptions — the trust decision

Tool descriptions populate the prompt. Loading an MCP tool means trusting its description not to lie or to poison the prompt. This is **a trust decision**, not just a capability decision.

Addy Osmani: *"Tool descriptions populate prompts, making MCP selection a trust decision."*

---

## Part 6 — Tools for CLIs the model has never seen

For a CLI **the model wasn't trained on** (your company's internal tool), you have two options:

| Option | Mechanic | Cost |
|---|---|---|
| **Paste reference into context** | Full docs in system prompt | Burns context every turn |
| **Progressive disclosure** | Agent runs `mycli --help`, then `mycli deploy --help` | Negligible if model uses it |

Always prefer the second. In `AGENTS.md`, just write:

```markdown
- Use `uv` for Python package management; run `uv --help` to discover subcommands before assuming syntax.
```

This gives the agent an **entry point** without wasting context on a full reference.

Note: popular tools (`kubectl`, `gh`, `git`) the model already knows from training. The real test of progressive disclosure is **the CLI nobody outside your company has ever used.**

---

## Part 7 — Skills in practice: matrix from sources

| Capability | Claude Code | Codex CLI | OpenCode |
|---|---|---|---|
| Agent can run `--help` incrementally via shell | ✓ | ✓ | ✓ |
| Skills system | Built‑in. Name + description loaded at startup, full SKILL.md on demand | Built‑in. Same mechanism | Built‑in. Skill tool loads SKILL.md into conversation on demand |
| MCP tools | Built‑in search. Index at startup, full schemas on demand (~85% reduction) | All loaded at session start | All loaded at session start; community plugin available for search‑based loading |

---

## Part 8 — Hooks: the deterministic backbone

Hooks are scripts that execute at **lifecycle points** the harness defines:

| Hook point | Common use |
|---|---|
| `pre-tool-call` | Validate arguments, log, enforce policy |
| `post-tool-call` | Capture result, update telemetry |
| `pre-edit` | Check that file isn't locked |
| `post-edit` | Run formatter / linter / type check |
| `pre-commit` | Block commits with debug code / TODOs |
| `pre-stop` | Block agent from terminating with failing tests |
| `on-user-prompt-submit` | Inject context, rewrite request |

> **The harness executes hooks, not the model.** This is what lets you enforce non‑negotiables (typecheck must pass, no `console.log` in commits, destructive commands blocked) deterministically — without trusting the model to remember them.

Hooks are **how you make memory / preferences enforced rather than optional.** A user instruction "always run tests before commit" is unreliable as a system prompt rule. As a `pre-commit` hook, it's guaranteed.

Addy Osmani: *"Success is silent, failures are verbose"* — hook failures surface directly to the agent so it can self‑correct.

---

## Part 9 — Anti‑patterns

| Anti‑pattern | Why it fails |
|---|---|
| Fifty overlapping tools | Model attention dilutes; disambiguation fails |
| Tool descriptions that are vague ("does various things") | Search‑based discovery breaks |
| Hand‑crafted tools where shell would do | Manus rebuilt 5× removing exactly these |
| Loading all MCP servers globally | Context fills; cost rises; trust risk grows |
| Treating tool errors as crashes (not LLM‑recoverable) | Loop dies on transient failures the model could've worked around |
| No serialization on mutating tools | Race conditions in concurrent file edits |
| Skills that don't reference anything (pure prompts) | Just splits your system prompt — use only when you have steps + scripts |
| Using LLM‑generated tool descriptions | Same risk as LLM‑generated system prompts: 20% inference overhead, performance degradation (ETH) |

---

## Part 10 — A 6‑step recipe for adding a new tool

1. **Name it precisely** — what verb + what noun? (`cart_add_item`, not `do_cart_thing`)
2. **Write the description for search** — specific, keyword‑rich, mentions when to use it.
3. **Define the schema strictly** — required vs optional, types, enums where possible.
4. **Decide read vs mutate** — can it parallelize? Does it need serialization?
5. **Wire permissions** — what trust level is needed? User confirmation required?
6. **Wire error handling** — what's transient, what's LLM‑recoverable, what bubbles up?

After it works: write a SKILL.md if there's a procedure (multi‑step, with verification). Otherwise leave it as a raw tool.

---

## Cross‑references

- The loop these tools execute in: `03-loop-in-motion.md`
- Permissions / sandboxing detail: `09-error-handling-and-guardrails.md`
- Subagents as a *recursive* tool: `06-subagents.md`
- Why your AGENTS.md should list tools/skills lightly: `04-context-and-memory.md`
