# 03 — The Loop in Motion

A step‑by‑step walkthrough of one cycle of an agent harness. The loop is **simple mechanically, complex in every step.**

---

## The seven‑step cycle

```
            ┌─────────────────────────┐
            │   USER MESSAGE arrives  │
            └─────────────┬───────────┘
                          ▼
            ┌─────────────────────────┐
            │  1. PROMPT ASSEMBLY     │
            │   system + tools +      │
            │   memory + history +    │
            │   user msg              │
            └─────────────┬───────────┘
                          ▼
            ┌─────────────────────────┐
            │  2. LLM INFERENCE       │
            │   model generates text  │
            │   and/or tool_calls     │
            └─────────────┬───────────┘
                          ▼
            ┌─────────────────────────┐         no tool calls
            │  3. CLASSIFY OUTPUT     │ ─────────────────────▶  FINAL ANSWER ✓
            │   tool calls?           │
            └─────────────┬───────────┘
                          ▼  yes
            ┌─────────────────────────┐
            │  4. TOOL EXECUTION      │ ← permissions checked here
            │   validate, sandbox,    │
            │   execute               │
            └─────────────┬───────────┘
                          ▼
            ┌─────────────────────────┐
            │  5. RESULT PACKAGING    │
            │   format as LLM‑readable│
            │   (errors returned too) │
            └─────────────┬───────────┘
                          ▼
            ┌─────────────────────────┐
            │  6. CONTEXT UPDATE      │
            │   append to history     │
            │   compact if near limit │
            └─────────────┬───────────┘
                          ▼
            ┌─────────────────────────┐
            │  7. LOOP                │ ─────▶ back to step 1
            └─────────────────────────┘

Exit conditions:
  • No tool calls produced (model finished)
  • Max turns exceeded
  • Token budget exhausted
  • Guardrail tripwire fires
  • User interrupts
  • Safety refusal returned
```

---

## Step 1 — Prompt Assembly

The harness constructs the **full input** the model will see:

1. **System prompt** (server‑controlled, highest priority)
2. **Tool schemas** (names, descriptions, parameter types)
3. **Memory files** (`AGENTS.md`, `CLAUDE.md`, indexed memory hints)
4. **Conversation history** (compacted if near limit)
5. **Current user message**

**Positioning rule (from "Lost in the Middle"):** put high‑importance content at the *beginning and end* of the prompt. The middle is where signal gets lost.

OpenAI Codex uses a strict priority stack: server‑controlled system message > tool definitions > developer instructions > user instructions (cascading `AGENTS.md` files, 32 KiB limit) > conversation history.

### What the lean‑.md philosophy means here

Alex Ker's instruction budget claim: frontier models can only follow a few hundred instructions before entering the "dumb zone." Every token in `AGENTS.md` is injected globally on every session. So:
- Keep `AGENTS.md` ~60 lines.
- Every token should fight for its place.
- Human‑written outperforms LLM‑generated system prompts (ETH research: LLM‑generated prompts degrade performance while costing ~20% more in inference).

---

## Step 2 — LLM Inference

The assembled prompt goes to the model API. The model generates output tokens:
- Pure text response, **or**
- Structured `tool_calls` objects, **or**
- Both (text reasoning + tool calls).

The harness does not parse natural language for actions — modern frontier models return tool calls as structured objects. This eliminates an entire class of brittleness from the older "free‑text parsing" era.

---

## Step 3 — Classify Output

A simple decision:

| Output | Action |
|---|---|
| Text only, no tool calls | End loop, return final answer |
| Tool calls present | Proceed to step 4 |
| Handoff requested (multi‑agent SDK) | Switch current agent and restart |

Some harnesses also handle a "stop sequence" or "thought" mode where the model emits chain‑of‑thought but no action — these typically fold into the "loop again" branch.

---

## Step 4 — Tool Execution

For each tool call, the harness:

1. **Validates arguments** against the tool schema.
2. **Checks permissions** (see `09-error-handling-and-guardrails.md`).
3. **Executes in a sandboxed environment** (filesystem isolation, command allow‑list, timeouts).
4. **Captures results.**

### Read vs mutate execution mode

- **Read‑only** operations (file read, search, web fetch) can run **concurrently**.
- **Mutating** operations (file edit, command exec, state writes) typically run **serially** to keep state coherent.

Many SDKs surface this as a flag on the tool definition. Concurrency without serialization on mutating ops is a common production bug.

---

## Step 5 — Result Packaging

Tool results are formatted as **LLM‑readable messages** and inserted as `ToolMessage` (or equivalent) into the conversation. Critical rule:

> **Errors are caught and returned as error results so the model can self‑correct.**

A tool that crashes silently is a tool that lets the agent claim victory on a failed task. LangGraph's four error categories (transient, LLM‑recoverable, user‑fixable, unexpected) each have a different packaging strategy.

---

## Step 6 — Context Update

Results are appended to conversation history. If the context window is approaching its limit:

- **Compaction:** summarize history, preserving architectural decisions and unresolved bugs, discarding redundant tool outputs.
- **Observation masking** (JetBrains Junie): hide old tool outputs while keeping tool *calls* visible — preserves the action history without bloating with payloads.
- **Just‑in‑time retrieval:** load by reference, not value (paths, IDs, queries) and only resolve when needed.

This step is where most production agents fail silently. See `04-context-and-memory.md`.

---

## Step 7 — Loop

Return to step 1. Repeat until termination.

### Termination conditions (layered)

| Condition | Trigger |
|---|---|
| Model produces a response with no tool calls | Normal completion |
| Maximum turn limit exceeded | Safety net; typical default 50–200 |
| Token budget exhausted | Cost / context guardrail |
| Guardrail tripwire fires | Safety system rejected a call |
| User interrupts | Streaming UI cancel |
| Safety refusal returned | Model declined the task |

A simple question might terminate in 1–2 turns. A complex refactoring task can chain dozens of tool calls across many turns.

---

## When one loop isn't enough: the Ralph Loop

For long‑running tasks **spanning multiple context windows**, the loop runs out of room. Anthropic's two‑phase **Ralph Loop** pattern:

```
Phase 1 — Initializer Agent (one‑time setup):
  ├─ set up environment (init script)
  ├─ create progress file (PROGRESS.md)
  ├─ create feature list (features.json)
  └─ initial git commit

Phase 2 — Coding Agent (every subsequent session):
  ├─ read git log (catch up on changes)
  ├─ read PROGRESS.md (where we left off)
  ├─ pick highest‑priority incomplete feature
  ├─ work on it (regular 7‑step loop)
  ├─ commit
  └─ update PROGRESS.md (write summary)
```

The **filesystem provides continuity across context windows.** Each session starts fresh and orients itself via repo state.

Addy Osmani's description: "Hooks intercept completion attempts, re‑inject original prompts in fresh windows, forcing continuation against completion goals while maintaining state through filesystem."

Deep dive → `08-verification-and-termination.md` (Ralph Loop section).

---

## Where harness complexity hides

The loop diagram looks deceptively simple. In production, each step has hidden complexity:

| Step | Hidden complexity |
|---|---|
| 1 (Assembly) | Compaction strategy, memory tier selection, positioning, instruction budget |
| 2 (Inference) | Streaming, partial output handling, retry on transient API failures |
| 3 (Classify) | Multi‑tool calls in one turn, parallel vs serial dispatch |
| 4 (Execution) | Sandbox isolation, permission tiers, concurrency model, mutation safety |
| 5 (Packaging) | Error categorization, result truncation, ID‑based reference instead of payload |
| 6 (Update) | Compaction algorithm, observation masking, JIT retrieval |
| 7 (Loop) | Termination conditions, max‑turn safety, cost limits |

> *"Simple mechanically, complex in every step."* — Akshay, *Anatomy of an Agent Harness*

---

## The Gather‑Act‑Verify cycle

Claude Code reframes the seven‑step loop as three phases at a higher level:

```
   GATHER            ACT             VERIFY
   ──────            ──────          ──────
   • search files    • edit files    • run tests
   • read code       • run commands  • check output
   • check memory    • call APIs     • diff state
                                     │
                                     └── loop back to GATHER
```

This is a useful **macro view** when designing your own harness: each agent turn should map to one of these phases. If you can't articulate which phase a turn is in, the harness probably lacks clarity.

---

## Anti‑pattern: the half‑loop

A common failure: a "harness" that only implements steps 1–3 (assembly → call → classify) and treats step 4 as the application's responsibility. This works for chatbots but **collapses for agents** because:

- Error packaging (5) is inconsistent.
- Context updates (6) are forgotten between turns.
- Permission checks (4) are missed.
- Compaction never happens.

If your harness doesn't own all seven steps, it's a prompt wrapper, not a harness.
