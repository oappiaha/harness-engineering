# SDK Current State (mid‑2026)

A deep look at what each major harness SDK actually ships, with version numbers, API surface, and code examples. Companion to `framework-comparison.md` (which is more conceptual).

> **Snapshot date:** May 2026. This doc ages fastest of anything in the folder — verify versions before deciding. The principles in `architectural-decisions.md` are stable; the *specifics* here aren't.

---

## Snapshot table

| SDK | Version (May 2026) | Recent shift |
|---|---|---|
| **Claude Agent SDK (Python)** | `0.2.87` | Rebrand from "Claude Code SDK" → "Claude Agent SDK"; Tool Search default on (Jan 2026); Agent SDK credit on subscription plans starting June 15 2026 |
| **Claude Agent SDK (TypeScript)** | `0.3.150` | Bundles Claude Code binary as optional dep |
| **OpenAI Agents SDK (Python)** | `0.17.4` | "Sync" renamed "Handoff" (Feb 2026); SandboxAgent abstraction; gpt‑realtime‑2 voice |
| **Codex CLI** | actively shipping | `codex resume`, mid‑turn steering, Python SDK auth flows |
| **LangGraph** | `1.2.2` | Stable; checkpointing (Postgres/SQLite/Memory); `interrupt()` HITL primitive |
| **CrewAI** | `1.14.5` | Flows layer matured (event‑driven deterministic alongside autonomous Crew) |
| **Microsoft Agent Framework** | `1.0 GA` (April 2026) | Successor to AutoGen (which is now in maintenance mode); absorbed Semantic Kernel features |
| **OpenCode** | actively shipping | ~150K GitHub stars; ~6.5M MAU mid‑year; 75+ LLM providers; mid‑session model switching with carried context |

---

## 1. Claude Agent SDK (Python + TypeScript)

> The SDK that powers Claude Code — exposed as a library. Anthropic's bet is **thin harness, smart model.**

### What's first‑class

| Capability | Mechanism |
|---|---|
| **Loop** | `query()` → async iterator of messages |
| **Stateful sessions** | `ClaudeSDKClient` context manager with `.query()` / `.receive_response()` |
| **Hooks (named, matcher‑based)** | `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit` |
| **Subagents** | `AgentDefinition` map + the `Agent` tool; messages carry `parent_tool_use_id` for trace |
| **Skills** | Filesystem‑first via `.claude/skills/*/SKILL.md`; auto‑discovered |
| **MCP tools** | In‑process SDK MCP servers via `create_sdk_mcp_server` + external stdio servers; **Tool Search by default** |
| **Built‑in tools** | Read, Write, Edit, Bash + full Claude Code toolset |
| **Permission model** | Allowlist (`allowed_tools`) with fallback `permission_mode`; hook‑based interception |
| **Session resume** | `resume=session_id` |

### The minimal example

```python
import anyio
from claude_agent_sdk import query

async def main():
    async for message in query(prompt="What is 2 + 2?"):
        print(message)

anyio.run(main)
```

### A real‑world example: hooks + custom tools + agents

```python
from claude_agent_sdk import (
    query, ClaudeAgentOptions, HookMatcher,
    tool, create_sdk_mcp_server, AgentDefinition,
)

# 1. Custom tool defined in-process (no subprocess overhead)
@tool("greet", "Greet a user", {"name": str})
async def greet_user(args):
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}

server = create_sdk_mcp_server(name="my-tools", version="1.0.0", tools=[greet_user])

# 2. Pre-tool hook — deterministic block
async def check_bash_command(input_data, tool_use_id, context):
    if input_data["tool_name"] != "Bash":
        return {}
    command = input_data["tool_input"].get("command", "")
    if "rm -rf /" in command:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "destructive command blocked",
            }
        }
    return {}

# 3. Subagent definition
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Bash", "Agent", "mcp__tools__greet"],
    hooks={
        "PreToolUse": [HookMatcher(matcher="Bash", hooks=[check_bash_command])],
    },
    mcp_servers={"tools": server},
    agents={
        "code-reviewer": AgentDefinition(
            description="Reviews code changes before commit",
            prompt="You are a code reviewer. Focus on correctness, not style.",
            tools=["Read", "Bash"],
        ),
    },
)

async for message in query(
    prompt="Refactor auth.py and have code-reviewer check the diff",
    options=options,
):
    print(message)
```

### Architecture notes

- **The CLI binary is bundled** as an optional dep in TS; auto‑installed in Python.
- **In‑process MCP** is a real performance win (no IPC overhead, single Python process, type‑safe).
- **Hook callbacks return `permissionDecision`** — that's how `deny` becomes deterministic, not advisory.
- **The Agent tool spawns subagents** with messages tagged by `parent_tool_use_id`, so subagent trees are traceable in the message stream.

### Where it shines

- Coding agents — the SDK was built for and tested on Claude Code's workload.
- Filesystem‑native projects — Skills, hooks, `.claude/` directory all use the FS as the source of truth.
- Tight permission control — hooks give deterministic blocking without rewriting the loop.

### Where it lags

- No built‑in **graph orchestration** — multi‑agent topology lives inside the linear loop via Agent tool. Not as expressive as LangGraph's nested state graphs.
- No built‑in **tracing UI** — you instrument via hooks; observability is BYO.
- **Distributed/durable execution** isn't first‑class (would need to bolt on Inngest or equivalent).

---

## 2. OpenAI Agents SDK + Codex CLI/SDK

> Code‑first orchestration. Multi‑agent via explicit handoffs. Built‑in tracing UI.

### What's first‑class

| Capability | Mechanism |
|---|---|
| **Loop** | `Runner.run()` — async / sync / streamed modes |
| **Agents** | `Agent` class with `name`, `instructions`, `tools`, `handoffs` |
| **Multi‑agent** | **Handoffs** (specialist takes control) — renamed from "Sync" in Feb 2026 |
| **Tools** | `@function_tool` (native), hosted tools (WebSearch, CodeInterpreter, FileSearch), MCP |
| **Sessions** | Auto conversation history |
| **Sandboxes** | `SandboxAgent` + `SandboxRunConfig` — persist filesystem/exec state across tasks |
| **Guardrails** | Built‑in input/output guardrails with tripwire |
| **Tracing** | Built‑in tracing UI — first‑class observability |
| **Voice** | `gpt-realtime-2` realtime agents with full feature compat |

### The minimal example

```python
from agents import Agent, Runner, function_tool, handoff

@function_tool
def search(query: str) -> str:
    """Search the web for information."""
    return f"results for {query}"

researcher = Agent(name="researcher", instructions="Research topics", tools=[search])
writer     = Agent(name="writer", instructions="Write reports", handoffs=[handoff(researcher)])

result = await Runner.run(writer, input="Write a report on harness engineering")
```

### Handoff vs agents-as-tools

- **Handoff** — control transfers; the receiving agent takes over the conversation.
- **Agents‑as‑tools** — specialist handles a bounded subtask, returns to the caller.

The handoff rename (Feb 2026) was clarifying: "Sync" was confusingly named for the actual semantic.

### Where it shines

- Multi‑agent coordination with type safety.
- Built‑in observability — the tracing UI is genuinely useful for debugging.
- Codex integration — same SDK powers the Codex CLI.
- Voice/multimodal — best‑in‑class realtime support.

### Where it lags

- No first‑class filesystem‑based Skills concept (Anthropic‑specific).
- Hook fidelity is lower — no named `PreToolUse`/`PostToolUse` matcher callbacks with deterministic blocking. Guardrails approximate but don't fully replace.
- MCP support loads all tools at startup (no search‑based loading yet).

---

## 3. LangGraph

> The graph framework. Explicit state machines. The only one of these with first‑class checkpointing for resume‑after‑crash.

### What's first‑class

| Capability | Mechanism |
|---|---|
| **Graph topology** | `StateGraph`, nodes, conditional edges, subgraphs |
| **State** | Typed state with reducers; updates merged at super‑step boundaries |
| **Checkpointing** | `PostgresSaver`, `SqliteSaver`, `MemorySaver` — durable resume |
| **Human‑in‑the‑loop** | `interrupt()` pauses execution; state inspectable/editable before resume |
| **Multi‑agent** | Supervisor / swarm / hierarchical templates; agents‑as‑nodes |
| **Tools** | Node‑level; integrates LangSmith for tracing |

### The minimal example

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver

class MyState(TypedDict):
    user_msg: str
    plan: str
    result: str

def planner(state): return {"plan": llm.plan(state["user_msg"])}
def actor(state):   return {"result": execute(state["plan"])}

g = StateGraph(MyState)
g.add_node("plan", planner)
g.add_node("act", actor)
g.add_edge(START, "plan")
g.add_edge("plan", "act")
g.add_edge("act", END)

app = g.compile(checkpointer=PostgresSaver.from_conn_string("postgresql://..."))

# Resume-after-crash works automatically
app.invoke(
    {"user_msg": "..."},
    config={"configurable": {"thread_id": "thread-123"}},
)
```

### Where it shines

- Durable execution — the only framework here where you can resume mid‑graph from a checkpoint after a process crash, hours later.
- Auditable transitions — useful for compliance / regulated industries.
- Complex multi‑agent topologies via nested subgraphs.

### Where it lags

- Higher cognitive overhead than chat‑loop SDKs.
- No filesystem‑driven Skills.
- No built‑in MCP search‑based loading.
- Hook system is weaker than Claude SDK's deterministic blocking.

---

## 4. CrewAI

> Role‑based collaboration. Two layers: classic `Crew` (autonomous role‑playing) and `Flows` (event‑driven deterministic).

### What's first‑class

| Capability | Mechanism |
|---|---|
| **Agent** | Role / goal / backstory / tools |
| **Task** | Unit of work assigned to an agent |
| **Crew** | Collection of agents executing tasks (sequential or hierarchical) |
| **Flows** | Event‑driven deterministic orchestration — `@start`, `@listen`, `@router`, `or_`, `and_` |
| **YAML config** | Role definitions can live in YAML |
| **Memory** | Per‑agent backstory + Crew‑level memory toggle |
| **MCP** | Via registry |

### The minimal example

```python
from crewai import Agent, Task, Crew, Process
from crewai.flow.flow import Flow, start, listen

researcher = Agent(role="Researcher", goal="Find facts", backstory="...")
writer = Agent(role="Writer", goal="Compose reports", backstory="...")

research_task = Task(description="Research X", agent=researcher)
write_task = Task(description="Write report from research", agent=writer)

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    process=Process.hierarchical,
    memory=True,
)

result = crew.kickoff()

# Or use Flow for deterministic orchestration:
class MyFlow(Flow):
    @start()
    def begin(self): return "initial"

    @listen(begin)
    def follow(self, input):
        return crew.kickoff(input)
```

### Where it shines

- Role/team metaphor — intuitive when the problem maps to "writer / editor / fact‑checker."
- Dual model — autonomous Crew **and** deterministic Flow in one library is genuinely useful.
- YAML role configs — non‑developers can author agents.

### Where it lags

- Hook system is weaker than Claude SDK's.
- Observability primitives weaker than LangGraph + LangSmith or OpenAI's tracing UI.
- MCP support is via registry but less mature.

---

## 5. Microsoft Agent Framework (MAF)

> **AutoGen's successor.** Reached **1.0 GA in April 2026** for .NET and Python. AutoGen entered maintenance mode in early 2026. Absorbed Semantic Kernel features (filters, telemetry, type safety, session state).

### What's first‑class

- **Workflows** — explicit multi‑agent execution paths.
- **AutoGen‑style** simple agent abstractions.
- **SK‑style enterprise** features: sessions, telemetry, filters, type safety.
- **First‑class .NET parity** with Python.
- **Long‑running + HITL state management.**

### The minimal example (C#)

```csharp
var workflow = new WorkflowBuilder()
    .AddAgent(planner)
    .AddAgent(coder)
    .AddAgent(reviewer)
    .AddEdge(planner, coder)
    .AddEdge(coder, reviewer)
    .Build();

await workflow.RunAsync(input);
```

### Where it shines

- Enterprise contexts that need .NET parity.
- Telemetry / filters inherited from Semantic Kernel.
- Migration path from AutoGen or SK projects.

### Where it lags

- Smaller community tool ecosystem vs OpenAI/Anthropic.
- No Skills system.
- MCP support is via SK extension rather than first‑class.

### Migration notes

If you're on AutoGen, plan a migration to MAF — AutoGen is maintenance‑only. If you're on Semantic Kernel, MAF absorbs SK's enterprise features cleanly. Microsoft published migration guides for both.

---

## 6. OpenCode

> Open‑source CLI breakout of 2026. ~150K GitHub stars, ~6.5M MAU mid‑year.

### What's first‑class

- **75+ LLM providers** — broadest model selection of any harness here.
- **Mid‑session model switching with carried context** — uniquely valuable for cost optimization.
- **`--plan` (read‑only) vs `--build` (write) agents** — explicit safety mode.
- **Embeddable SDK** with rich tool‑call telemetry events.
- **Bubble Tea TUI** + desktop app.
- **Skill tool** loads SKILL.md into conversation on demand.
- **PDF attachments**, **OAuth**, **reasoning streams**.

### Where it shines

- Multi‑provider flexibility.
- TUI ergonomics — power users love it.
- Open‑source, community‑driven extensions.

### Where it lags

- MCP tools load all at session start (no search‑based loading; community plugin exists).
- Smaller production deployment footprint vs Claude Code / Codex.

---

## 7. Codex CLI

> Pairs with OpenAI Agents SDK for embedding. Built for the developer experience.

### What's first‑class

- **`codex resume`** picker (with `--all` flag).
- **Mid‑turn steering** — interrupt and redirect.
- **Local transcript persistence**.
- **GPT‑5.3‑Codex support**.
- **Python SDK auth flows** (API key, ChatGPT browser, device code).

### Where it shines

- Developer ergonomics — resume, steer, persist.
- Tight integration with OpenAI infra.

### Where it lags

- All MCP tools load at session start (no search‑based loading).
- Less subagent flexibility than Claude Code or LangGraph.

---

## What's converging (the standard kit)

Six things every modern SDK now ships:

1. **Same agent‑loop shape:** `agent + tools + (hooks | middleware) + session`.
2. **MCP as the tool/integration substrate** — Anthropic, OpenAI, Microsoft, CrewAI all support it.
3. **Subagent or handoff primitive** in every SDK (`Agent` tool / handoff / subgraph / Crew).
4. **Session resume** is universal — captured by ID, replayable.
5. **Sandboxed execution** is becoming first‑class (OpenAI's `SandboxAgent`, Blaxel‑style external sandboxes, MAF state mgmt).
6. **Tracing/observability** has migrated from optional to expected (OpenAI tracing UI, LangSmith, MAF telemetry).

---

## Where they still diverge meaningfully

| Axis | State of art |
|---|---|
| **Hook fidelity** | Claude Agent SDK is the only one with named, matcher‑based, deterministic `PreToolUse` / `PostToolUse` / `Stop` callbacks that can return a `deny` decision. Others rely on guardrails / filters / listeners — softer mechanisms. |
| **MCP loading strategy** | Anthropic ships **search‑based / lazy** by default (~85% token reduction). Everyone else still loads‑all‑at‑startup. |
| **Subagent model** | Claude = nested invocation via `Agent` tool. OpenAI = handoffs (control transfer). LangGraph = nested subgraphs. CrewAI = role‑based delegation. MAF = workflow edges. **These are not interchangeable.** |
| **Skills** | Unique to Anthropic. No other SDK has a parallel filesystem‑auto‑discovered Skills system. |
| **Durability** | Only LangGraph offers checkpoint‑and‑resume across crashes as a first‑class primitive. Everyone else needs a workflow engine (Inngest, Temporal) bolted on. |
| **Cost primitives** | None ship native per‑agent cost accounting. Observability stacks cover this externally. |

---

## Choosing checklist (mid‑2026)

```
Is your model Claude?                          → Claude Agent SDK (best co-training)
Is your model GPT?                             → OpenAI Agents SDK
Need durable resume-after-crash?               → LangGraph (or any SDK + Inngest)
Role-based team metaphor?                      → CrewAI
.NET / enterprise / SK migration?              → Microsoft Agent Framework
Multi-provider flexibility / mid-session swap? → OpenCode
Best built-in tracing UI?                      → OpenAI Agents SDK
Best deterministic hook system?                → Claude Agent SDK
Custom graph topology?                         → LangGraph
Voice/realtime?                                → OpenAI Agents SDK (gpt-realtime-2)
```

---

## Things to watch (next 6–12 months)

These are field‑level shifts I'd expect to land between now and end of 2026:

1. **Tool Search across all SDKs.** Anthropic's lead here is too obvious — expect OpenAI, OpenCode, and Codex to ship equivalents.
2. **Skills standardization or rejection.** Either Anthropic's Skills concept becomes a cross‑SDK pattern, or it stays Anthropic‑only and the others double down on alternatives.
3. **Native durable execution.** LangGraph's checkpointing demonstrates the value; expect at least one other SDK to ship native (not bolt‑on) durability.
4. **AutoGen end‑of‑life completion.** Currently maintenance; full deprecation likely.
5. **OpenCode framework consolidation.** Either OpenCode formalizes its SDK and absorbs more share, or one of the big SDKs ships equivalent multi‑provider flex.
6. **Cost meters as default.** None ship this today; the next year is likely when they start to.

---

## Sources

- [Claude Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Agent SDK TypeScript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Agent SDK overview — code.claude.com](https://code.claude.com/docs/en/agent-sdk/overview)
- [OpenAI Agents SDK Python](https://github.com/openai/openai-agents-python)
- [Codex CLI](https://developers.openai.com/codex/cli)
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [CrewAI](https://github.com/crewAIInc/crewAI)
- [Microsoft Agent Framework overview](https://learn.microsoft.com/en-us/agent-framework/overview/)
- [AutoGen → MAF migration](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/)
- [OpenCode docs](https://opencode.ai/docs/agents/)
- [Anthropic — Advanced tool use (Tool Search)](https://www.anthropic.com/engineering/advanced-tool-use)
