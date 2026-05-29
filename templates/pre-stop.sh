#!/usr/bin/env bash
# pre-stop hook — runs the verification command before the agent terminates.
# If verification fails, the hook rejects termination and the agent must continue.
#
# Install:
#   cp templates/pre-stop.sh .claude/hooks/pre-stop   # Claude Agent SDK
#   cp templates/pre-stop.sh .codex/hooks/pre-stop    # Codex CLI
#   chmod +x .claude/hooks/pre-stop
#
# The hook contract varies by SDK. This template assumes Claude Agent SDK
# conventions: read JSON from stdin, write JSON to stdout, exit 0 to allow,
# exit nonzero or emit deny payload to block.
#
# For other SDKs, adapt the input/output protocol but keep the structure.

set -uo pipefail

# 1. Find project root (where Makefile lives)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# 2. Run the verification command
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

if make check >"$LOG" 2>&1; then
    # 3a. Passed — allow termination
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "decision": "allow"
  }
}
EOF
    exit 0
fi

# 3b. Failed — block termination, surface actionable error
LOG_TAIL="$(tail -c 4000 "$LOG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "decision": "block",
    "reason": "ERROR: \`make check\` exited nonzero. WHY: verification failed. FIX: address the failures below and re-run. Output (last 4KB):\n\n${LOG_TAIL}"
  }
}
EOF
exit 0  # exit 0 — we communicated the deny via JSON; non-zero exit may be treated as crash
