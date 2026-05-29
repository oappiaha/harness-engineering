# First 30 Minutes — Empty Directory → Phase 1 Gate

> A literal recipe for a Claude Code session pointed at an empty directory and told *"build me a harness for X."*
>
> Follow these steps in order. Each step has an exact command or prompt. By the end you'll have passed the Phase 1 self‑audit and be ready for Phase 2.

---

## Pre‑step: orient

Read these three files first, then return here:

1. `README.md` (this folder's entry point)
2. `FRAMEWORK.md` (the playbook — focus on "Operator's guide for Claude Code sessions" at the top)
3. `templates/README.md` (what's in `templates/`)

Do not start coding before doing this.

---

## Step 1 (≤5 min) — Conduct the pre‑flight interview

Ask the user **each of the 5 questions in turn.** Don't proceed to the next question until the current one has a concrete answer.

### Prompt template (one per question)

> *"Before we write any code, I need 5 short answers in writing — they determine the architecture. Question 1 of 5: **Who is the user**, and **what is the smallest thing the agent does that's valuable?** A vague answer like 'power users' isn't enough; we need a concrete sentence like 'a backend engineer fixing flaky tests in auth without leaving the terminal.' What's yours?"*

> *"Question 2 of 5: **Is the work single‑session or multi‑session?** Minutes, hours, days, or weeks? This determines whether we need durable execution and a Ralph Loop."*

> *"Question 3 of 5: **Is the model co‑trained on this domain?** Coding/web/text = yes, thin harness. Research/writing = mostly. Fashion/vertical/regulated = mostly no, thick harness. Which?"*

> *"Question 4 of 5: **What's the risk tier of the worst action the agent takes?** Read‑only (tier 0)? File edits (tier 1)? Bash (tier 2)? External effects like deploys or payments (tier 3)? Irreversible like dropping databases (tier 4)?"*

> *"Question 5 of 5: **Is this single‑user (local CLI) or multi‑user (hosted SaaS)?** This decides inside‑vs‑outside sandbox."*

### Handling "I don't know yet"

- If Q1 unknown → push back: *"I can't pick the right tools without knowing the user and the minimum valuable task. Even a rough sentence is fine — we'll refine it."*
- If Q2 unknown → ask the longest typical task duration; that's the answer.
- If Q3 unknown → check `architectural-decisions.md` Decision 1; default to medium until evidence.
- If Q4 unknown → ask the user to enumerate the verbs the agent will perform; tier the worst.
- If Q5 unknown → ask deployment intent ("laptop tool or hosted service?").

**Do not generate answers yourself.** If the user genuinely refuses to answer, log it as a known unknown in `harness-design.md` and continue with explicit warnings.

---

## Step 2 (~3 min) — Initialize the repo

```bash
# Inside the user's chosen project directory
git init
mkdir -p docs scripts .claude/hooks  # use .codex/hooks for Codex CLI

# Copy starter templates
cp <path-to>/harness-engineering/templates/harness-design.md docs/
cp <path-to>/harness-engineering/templates/AGENTS.md .
cp <path-to>/harness-engineering/templates/Makefile .
cp <path-to>/harness-engineering/templates/PROGRESS.md .
cp <path-to>/harness-engineering/templates/DECISIONS.md .
cp <path-to>/harness-engineering/templates/features.json .
cp <path-to>/harness-engineering/templates/pre-stop.sh .claude/hooks/pre-stop
chmod +x .claude/hooks/pre-stop
```

> If you don't have the templates folder co‑located, paste the contents inline rather than skipping — the files matter more than the copy method.

---

## Step 3 (~10 min) — Fill in `harness-design.md` with the interview answers

Open `docs/harness-design.md` and transcribe the user's 5 answers verbatim. Then derive:

- **Blueprint choice** — match the answers against `blueprints/` and tell the user which one fits closest. Quote one sentence from that blueprint's section 4 (Core decisions) and confirm with the user.
- **Framework choice** — apply the decision matrix in `framework-comparison.md` § "Decision quick reference." Tell the user the recommendation with one‑line reasoning.
- **The 7 decisions** — fill each based on pre‑flight answers, using the quick‑decide matrix in `FRAMEWORK.md`.

Commit:

```bash
git add docs/harness-design.md
git commit -m "phase 0: pre-flight + architectural decisions"
```

> If the user disagrees with any derived choice, document the override in `DECISIONS.md` with their reason before continuing.

---

## Step 4 (~5 min) — Author `AGENTS.md` with the user

Do NOT generate this file yourself. Open the TODO‑marked template and walk through it **with the user**:

> *"AGENTS.md is the file the agent reads on every session. The ETH study found that LLM‑generated AGENTS.md degrades performance and costs ~20% more in inference — so I'll help you fill it in but won't write it for you. Let's go section by section."*

Sections to walk through with explicit user input:
1. **What this project is** — 1–2 sentences. User dictates; you transcribe.
2. **First run commands** — confirm `make setup`, `make dev`, etc. exist or need to be added.
3. **Hard constraints** — ≤15 items. **User must propose each; you can challenge.** Every constraint should trace to a specific past failure or external rule.
4. **Verification commands** — what does `make check` actually run for this project?
5. **Topic docs** — list the on‑demand `docs/*.md` files the project will use.

Then customize the `Makefile` from the template — fill in the language/framework‑specific commands.

Commit:

```bash
git add AGENTS.md Makefile
git commit -m "phase 1: AGENTS.md and Makefile"
```

---

## Step 5 (~5 min) — Verify the pre‑stop hook works

The hook is the *single most important piece of wiring*. Verify it:

```bash
# Test 1: when make check passes, the hook should allow termination
make check && echo "make check passes — hook will allow"

# Test 2: artificially break make check (e.g., create a syntax error)
# Then run the hook directly to confirm it blocks:
echo '{"hookEventName": "Stop"}' | .claude/hooks/pre-stop
# Output should contain "decision": "block"
```

If the hook isn't installed where your SDK expects:
- Claude Agent SDK: `.claude/hooks/pre-stop`
- Codex CLI: `.codex/hooks/pre-stop`
- Custom: register via SDK config

---

## Step 6 (~3 min) — Initial commit + first real run

```bash
git add .
git commit -m "phase 1: initial harness skeleton"
```

Now run **one real task** through the agent end‑to‑end:

- Pick the smallest meaningful task from the user's domain.
- Watch the agent execute it.
- If the agent claims done, the `pre-stop` hook should fire `make check`.
- If `make check` fails, the hook should reject termination.

This is the Phase 1 gate.

---

## Step 7 (~2 min) — Run the Phase 1 self‑audit

Paste this script (or save as `scripts/phase-1-audit.sh`):

```bash
#!/usr/bin/env bash
# Reference: FRAMEWORK.md § "Self-audit scripts"
# (See FRAMEWORK.md for the full script; this is a placeholder)
bash <(cat <<'AUDIT'
# ... copy the Phase 1 audit script from FRAMEWORK.md here ...
AUDIT
)
```

Run it. Every `✓` line must print. Investigate every `⚠`. Fix every `✗` before proceeding.

---

## Done — what you should have after 30 minutes

```
project/
├── AGENTS.md                 ← human-written, ≤80 lines
├── Makefile                  ← setup/dev/test/lint/check all real
├── PROGRESS.md               ← initial state captured
├── DECISIONS.md              ← Phase 0 decision logged
├── features.json             ← initial backlog
├── docs/
│   └── harness-design.md     ← 5 answers + 7 decisions + framework + blueprint
├── .claude/
│   └── hooks/
│       └── pre-stop          ← executable, runs make check
├── scripts/
│   └── phase-1-audit.sh      ← passes
└── .git                      ← 3-4 commits (phase 0, AGENTS.md+Makefile, hook, initial skeleton)
```

**You are now at the Phase 1 gate.** Tell the user:

> *"Phase 1 is complete. Here's what we have: [list]. The agent can now run one real task end‑to‑end with verified termination. Ready to start Phase 2 (Reliability)?"*

---

## What to do if you got stuck

| Stuck on | Read |
|---|---|
| User won't answer pre‑flight | `FRAMEWORK.md` § "If asked to skip pre-flight, push back" |
| Can't pick a blueprint | `blueprints/00-README.md` + `blueprints/06-build-your-own.md` |
| Can't pick a framework | `framework-comparison.md` + `sdk-current-state.md` |
| AGENTS.md feels generic | `core/04-context-and-memory.md` Part 7 |
| Hook won't fire | Check SDK docs for hook location; verify executable bit |
| Audit script fails on Phase 1 | Re‑read `FRAMEWORK.md` § "Phase 1 — Skeleton" |

---

## Common first‑30‑minutes mistakes

| Mistake | Fix |
|---|---|
| Generating `AGENTS.md` yourself | Stop. Walk through with the user. |
| Skipping pre‑flight to "just start coding" | Stop. Pre‑flight is non‑skippable. |
| Picking framework before pre‑flight done | Stop. Framework falls out of the 5 answers. |
| Wiring tools before installing `pre-stop` | Re‑order. Hook first. |
| Treating `make check` as optional | It's the verification command. It must exit 0 on success. |
| Skipping the initial commit | Commit after each step. Smaller commits, easier rollback. |
