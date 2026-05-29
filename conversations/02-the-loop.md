# 02 — The Loop

Builds on `01-vocabulary.md`. The mechanical core of every harness in 7 lines, then the complexity hiding inside each step, then the question almost everyone asks: *"wait, does the model get called multiple times per user message?"* (Yes. Many times.)

---

## The core: a while loop

```python
while True:
    prompt = assemble(system, tools, memory, history, user_msg)
    response = llm(prompt)
    if response.has_tool_calls:
        results = execute(response.tool_calls)
        history.append(results)
    else:
        return response
```

That's it. Anthropic literally calls their version a *"dumb loop, smart model."* **The intelligence lives in the model. The loop just manages turns.**

So why is this hard?

## Each step hides a small empire

**Step 1 — Prompt assembly.** Sounds trivial. In reality you're stitching together: system prompt + tool schemas + memory files + conversation history + user message. Every one of those can blow up your context window. You need a *compaction strategy* for when history gets long, a *memory tier* decision, a *positioning* rule (high-importance content at the start AND end — "Lost in the Middle").

**Step 2 — LLM inference.** Call the API, get a response. Easy until you handle streaming, partial outputs, retries on transient failures, cost tracking, latency budgets.

**Step 3 — Classify output.** Did the model return text or tool calls or both? A model can emit several tool calls in one response. Which ones are read‑only (safe to parallelize)? Which mutate state (must serialize)? Did it request a handoff?

**Step 4 — Tool execution.** This is where most of the *architecture* lives. For each call: validate, check permissions (trust tiers, per-call policy, maybe explicit user confirmation), execute in a sandbox, enforce a timeout, capture results. Read-only ops parallelize. Mutating ops serialize. **A bug here is the difference between "agent went on a wild goose chase" and "agent dropped your prod database."**

**Step 5 — Result packaging.** The tool returned something. Now you have to turn it into a message the LLM can read. Errors get caught and packaged as `ToolMessage(is_error=True)` so the model can self-correct — not crash the loop.

**Step 6 — Context update.** Append to history. Easy until you're near the context window limit. Then you need *opinionated compaction* (preserve architectural decisions, drop redundant tool outputs), *observation masking* (hide old payloads, keep action history), or *JIT retrieval* (load full content on demand). **This is where most production agents fail silently.**

**Step 7 — Loop.** Back to step 1.

## Termination is layered, not single

| # | Condition | Type |
|---|---|---|
| 1 | Model returns text with no tool calls | Natural |
| 2 | Max turn limit exceeded | Safety |
| 3 | Token budget exhausted | Cost |
| 4 | Guardrail tripwire | Safety system |
| 5 | User interrupts | UX |
| 6 | Safety refusal returned | Model declined |
| 7 | **`pre-stop` hook blocks** ("you say done but `make check` fails") | **Production rigor** |

That last one is the production differentiator. Without a `pre-stop` hook, the loop ends whenever the model claims it's done. With it, the harness *audits* the claim. **This single piece of wiring is what separates demo agents from shipping agents.**

---

## The wrapper question: where is the harness, really?

```
        ┌─────────────────────────────────────┐
        │   Your process (the harness)        │
        │                                     │
        │   ┌──────────────────────────┐      │
        │   │  Loop + state + tools +  │      │
        │   │  memory + hooks + guard  │      │
        │   │  rails + verification +  │      │
        │   │  observability           │      │
        │   └──────────┬───────────────┘      │
        │              │                      │
        │       calls out via HTTPS           │
        │              │                      │
        └──────────────┼──────────────────────┘
                       ▼
              ┌────────────────────┐
              │   LLM API          │
              │  (Anthropic /      │
              │   OpenAI / ...)    │
              │  the *model*       │
              │  lives here        │
              └────────────────────┘
```

- **The model is a remote service.** Anthropic / OpenAI run it. You don't.
- **The harness is software you own** running in *your* process — your CLI, your server, your SaaS backend.
- The harness calls the model the way it calls any other API.

### The subtle inversion

In a normal API client, *your code* drives:

```python
# Thin SDK wrapper — NOT a harness
answer = openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "What's 2+2?"}]
)
```

In a harness, **the model drives.** Your code is more like a butler: it presents options (tools), executes whatever the model decides, and feeds results back.

```python
def run_harness(user_msg):
    history = [system_prompt, user_msg]

    for turn in range(MAX_TURNS):
        prompt = assemble_prompt(
            system=system_prompt,
            tools=tool_registry.schemas(),
            memory=memory.tier1_index(),
            history=history,
        )
        response = llm_api.call(prompt)

        if not response.tool_calls:
            if not hooks.run("pre-stop", history):
                history.append(make_tool_message(
                    "ERROR: verification failed. Run `make check` and fix."
                ))
                continue                      # force the model to continue
            return response.text              # truly done

        for call in response.tool_calls:
            if not permissions.allow(call):
                history.append(make_tool_message(f"ERROR: denied — {call}"))
                continue
            try:
                with timeout(call.timeout_s), sandbox(call.policy):
                    result = tool_registry.execute(call)
                history.append(make_tool_message(result))
            except ToolError as e:
                history.append(make_tool_message(f"ERROR: {e}", is_error=True))

        if context.size(history) > THRESHOLD:
            history = compactor.compact(history)

    return "max-turns-exceeded"
```

`run_harness` plus everything it imports — `tool_registry`, `memory`, `permissions`, `hooks`, `compactor`, `sandbox`, `timeout` — **is the harness.** The model itself is one line: `response = llm_api.call(prompt)`.

---

## "Does one user message = many model calls?" Yes.

This is the question that makes the loop click.

User says: *"Fix the failing test in the cart module."*

```
Turn 1:
  llm_api.call(history = [system, user_msg])
  → tool_calls = [grep("test_cart")]

Turn 2:
  llm_api.call(history = [system, user_msg, grep_call, grep_result])
  → tool_calls = [read_file("tests/cart/test_pagination.py")]

Turn 3:
  llm_api.call(history = [...everything above..., file_contents])
  → tool_calls = [read_file("src/cart.py")]

Turn 4:
  llm_api.call(history = [...everything above..., source_contents])
  → tool_calls = [edit_file(...)]

Turn 5:
  llm_api.call(history = [...above..., edit_confirmation])
  → tool_calls = [bash("pytest tests/cart/")]

Turn 6:
  llm_api.call(history = [...above..., test output...])
  → "Fixed the off-by-one. Tests pass." (no tool calls)
  → pre-stop hook: make check passes
  → loop exits
```

**One user message. Six `llm_api.call()` invocations.** A complex refactor easily 30–50.

## The two facts that explain why

**1. The model is stateless.** It doesn't remember turn 3 when you call it for turn 4. There's no session on the provider's side that's "tracking your agent." Every call is a fresh inference.

**2. Therefore the harness re‑sends the whole history every turn.** That's what gives the model continuity. The "memory" of what happened earlier is just *the bytes the harness shipped back on the next call.*

```
   Turn 1:  [system, user_msg]
   Turn 2:  [system, user_msg, grep_call, grep_result]
   Turn 3:  [system, user_msg, grep_call, grep_result, read_call, file_contents]
   Turn 4:  [...everything above..., read_call_2, source_contents]
   Turn 5:  [...everything above..., edit_call, edit_confirmation]
   Turn 6:  [...everything above..., bash_call, test_output]
```

Every turn re‑uploads everything before it. By turn 50, you might be sending 100K tokens of history *every call.*

## Which is why the rest of the components exist

- **Cost** — every turn pays input tokens for *all prior history* plus output tokens. Cost grows roughly quadratically. This is why retry caps aren't paranoia, they're survival.
- **Context rot** — by turn 20, the original user message is buried under hundreds of tool results. Important content drifts to mid-window. The model literally attends to it less.
- **Compaction** — when history would exceed the window, the harness summarizes and replaces old turns. Otherwise the next call 413s.
- **Prompt caching** — since you're re-sending mostly the same prefix every turn, the provider can cache it server-side and charge you less. Anthropic's claim: **~85% context reduction** on MCP search-based loading.
- **Subagents** — instead of the main loop accumulating 50 turns of investigation, fire off a subagent with its own fresh history, let it do 20 turns inside *its own* loop, and return a 2K-token summary. Main loop only sees the summary.

## Mental model

Each `llm_api.call` is like asking a brilliant amnesiac for advice. They're sharp — but they remember nothing.

So you walk in, hand them a folder containing: the rules (system prompt), their job description (tool schemas), what's happened so far (history), and the latest update (tool results). They read the folder, give you advice ("run grep with this pattern"), forget everything, and you walk out. Next turn you walk back in with a thicker folder.

**That's the loop.** The harness is the assistant carrying the folder back and forth, doing the work the model asks for, and curating what goes in so the amnesiac can still find the important bits.

> Once you see this, almost every harness design decision is downstream of one question: *how do we keep the folder small, fresh, and high-signal as it grows?*

---

## Anti-pattern: the half-loop

A "harness" that only owns steps 1–3 (assemble → call → classify) and treats step 4 as the application's problem. Works for chatbots. Collapses for agents — because errors are packaged inconsistently, context updates get forgotten, permission checks get missed, compaction never happens.

**If your harness doesn't own all 7 steps, it's a prompt wrapper, not a harness.** That's the line.

---

## What's next

`03-seven-decisions.md` walks the seven architectural bets every harness faces — the canonical taxonomy from Akshay's *Anatomy of an Agent Harness*.
