# 01 — Vocabulary

> *"If you're not the model, you're the harness."* — Vivek Trivedy, LangChain

Three words people use interchangeably and shouldn't: **model, harness, agent.**

---

## The three terms

- **Model** = the weights. The trained neural net. **Stateless.** You feed it tokens, it returns tokens. That's it.
- **Harness** = the software around the model. The loop, the tools, the memory, the state files, the verification, the hooks. The infrastructure.
- **Agent** = the *behavior* you experience. Goal‑directed, tool‑using, self‑correcting. **Emergent**, not a thing you can point to.

The phrase that trips everyone up: **"I built an agent."** What that actually means is *"I built a harness and pointed it at a model, and the combination of the two produces agent‑like behavior."* The agent isn't an object. It's what happens when the harness and the model interact.

## Three quick tests that prove the distinction is load‑bearing

1. **Swap the harness, keep the model:** you get a different agent. LangChain went from outside the top 30 to **rank 5** on Terminal Bench 2.0 (a +13.7‑point jump, 52.8 → 66.5) by changing only the harness. Same model. Same weights.
2. **Swap the model, keep the harness:** the agent's identity holds. Your `AGENTS.md`, your tools, your verification — Claude Code "feels like Claude Code" whether it's running Sonnet or Opus.
3. **Strip the harness entirely:** the model still works, but it can't *do* anything. It's a chatbot. The harness is what makes it an agent.

## The Von Neumann analogy isn't just metaphor

Beren Millidge's 2023 framing: a raw LLM is a CPU with no operating system.

- A CPU is fast but useless alone — it can't store memory beyond its registers, can't read a disk, can't talk to a screen.
- An LLM is the same — it can predict tokens, but can't remember across conversations, can't read files, can't run commands.
- **An OS is what makes a CPU useful.** A harness is what makes an LLM useful.

```
   Computer              LLM Agent
   ────────              ─────────
   CPU            ←→     LLM (weights)
   RAM            ←→     Context window
   Hard disk      ←→     Vector DB / files
   Device drivers ←→     Tool integrations
   OS             ←→     Harness  ← the key layer
   Application    ←→     Agent (emergent behavior)
```

The reason this matters in practice: when an agent fails, you can almost always trace it to a harness layer.

- *"The model hallucinated"* → the harness gave the model bad context.
- *"The agent forgot"* → memory wasn't persisted.
- *"It made an irreversible mistake"* → permissions weren't gated.

Once you have this vocabulary, you stop saying *"the model needs to be better"* and start saying *"which of the 12 components failed?"*

## The three concentric levels

```
   harness eng. ⊃ context eng. ⊃ prompt eng.
```

- **Prompt engineering** = wording one prompt well.
- **Context engineering** = managing what's in the window across turns (compaction, retrieval, positioning).
- **Harness engineering** = both of those, plus tools, state, errors, verification, safety, lifecycle — everything that makes autonomous behavior possible.

**People often try to fix harness problems with prompt engineering.** They write longer prompts. They add "you must always X" rules. It rarely works, because the failure isn't at the prompt layer — it's two rings out.

---

## The killer evidence

LangChain documented a **+13.7 point Terminal Bench 2.0 jump** (52.8 → 66.5) keeping `gpt-5.2-codex` fixed and changing only the harness. That's the closest thing to a controlled experiment we have: same model, harness change alone, 25+ rank improvement. **When you can change only one variable and get that result, that variable is where your engineering should go.**

Source: [LangChain — Improving Deep Agents with Harness Engineering](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering).

---

## What's next

If the vocabulary is clear, the next walkthrough (`02-the-loop.md`) shows the mechanical core of every harness — the simple while‑loop and the empire of complexity hiding inside each step.
