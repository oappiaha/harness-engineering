# Templates — Copy‑Pasteable Starters

Drop these into a new harness project. Each one is intentionally **minimal and TODO‑marked** — fill in the project‑specific parts.

## Usage

```bash
# From your new project root:
cp -r /path/to/harness-engineering/templates/* .
mv harness-design.md docs/

# Then edit each file's TODO markers
```

## What's here

| File | Purpose | Phase |
|---|---|---|
| `harness-design.md` | The Phase 0 worksheet — answer 5 pre‑flight questions + 7 decisions | 0 |
| `AGENTS.md` | Always‑loaded landing page; ≤80 lines; ratchet‑traced rules | 1 |
| `Makefile` | `setup` / `dev` / `test` / `lint` / `check` targets | 1 |
| `pre-stop.sh` | Hook that runs `make check` and blocks broken termination | 1 |
| `PROGRESS.md` | Current session state — clock‑in / clock‑out | 1 |
| `DECISIONS.md` | Design log + rejected alternatives + ratchet entries | 1 |
| `features.json` | Multi‑feature backlog with state machine | 2 |
| `permission_check.py` | Risk tier matrix + `permission_check()` function | 2 |
| `first-30-minutes.md` | Exact recipe: empty directory → Phase 1 gate | reference |
| `sprint-contract.md` | Pre‑task scope agreement (Phase 3+) | 3 |

## Rules for the operator

1. **Do not LLM‑generate `AGENTS.md`.** Co‑author with the user; or leave the TODO markers for them to fill personally.
2. **Make the 5 pre‑flight answers concrete.** Bad: "engineers." Good: "a backend engineer at our company who wants to fix flaky tests in auth without context switching."
3. **Fill in TODO markers iteratively.** Don't try to fill all in one pass. Start with what you know; revisit as you build.
4. **Commit after each template is filled in.** `harness-design.md` first; then `AGENTS.md`; then the rest. One concept per commit.

## After copying

Run the **Phase 1 self‑audit** from `FRAMEWORK.md` to verify you're ready to start Phase 1 development.
