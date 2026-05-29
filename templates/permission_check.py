"""Permission check — risk tier matrix + the check function.

Adapt the RISK_TIERS dictionary to your tool set. Wire `permission_check()` into
your harness's tool dispatch — every tool call goes through this before execute.

This is reference code; adapt the imports / types to your SDK.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any


# === Risk tiers ===
# Decide once, apply everywhere. Map every tool to a tier.
# Tier 0: read-only             → auto-allow
# Tier 1: mutate local state    → allow w/ notice
# Tier 2: mutate user state     → policy / confirm in untrusted contexts
# Tier 3: external effect       → ALWAYS require user confirmation
# Tier 4: irreversible          → require typed confirmation + cooldown

RISK_TIERS: dict[str, int] = {
    # === Read-only (Tier 0) ===
    "read_file":         0,
    "grep":              0,
    "glob":              0,
    "list_files":        0,
    "web_fetch":         0,
    "memory_read":       0,

    # === Local mutate (Tier 1) ===
    "edit_file":         1,
    "write_file":        1,
    "memory_write":      1,

    # === Local execute (Tier 2) ===
    "bash":              2,
    "run_tests":         2,

    # === External effect (Tier 3) ===
    "git_push":          3,
    "send_email":        3,
    "post_message":      3,
    "deploy":            3,
    "charge_payment":    3,  # IRREVERSIBLE if not idempotent

    # === Irreversible (Tier 4) ===
    "drop_table":        4,
    "force_push":        4,
    "delete_user_data":  4,
    "mass_send":         4,
}


# === Decision enum ===
class Decision(Enum):
    ALLOW = "allow"
    ALLOW_WITH_NOTICE = "allow_with_notice"
    REQUIRE_USER_CONFIRM = "require_user_confirm"
    REQUIRE_TYPED_CONFIRM = "require_typed_confirm"
    DENY = "deny"


@dataclass
class PermissionResult:
    decision: Decision
    reason: str = ""


# === Optional: spending caps (delete if not a money-handling agent) ===
SPEND_CAPS: dict[str, float] = {
    "per_purchase":   500,
    "per_session":   1000,
    "per_day":       2000,
    "per_month":     8000,
}


@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]
    idempotency_key: str | None = None


@dataclass
class UserContext:
    user_id: str
    trusted_project: bool = False
    confirmed_keys: set[str] | None = None
    spent_today: float = 0.0
    refund_window_open: bool = False
    quote_age: timedelta | None = None  # for shopping-style agents

    def confirmed_purchase(self, key: str) -> bool:
        return self.confirmed_keys is not None and key in self.confirmed_keys


def permission_check(call: ToolCall, user: UserContext) -> PermissionResult:
    """Gate every tool call. Return a decision the harness applies."""
    if call.name not in RISK_TIERS:
        return PermissionResult(Decision.DENY, f"unknown tool: {call.name}")

    tier = RISK_TIERS[call.name]

    if tier == 0:
        return PermissionResult(Decision.ALLOW)

    if tier == 1:
        return PermissionResult(Decision.ALLOW_WITH_NOTICE, f"will {call.name}")

    if tier == 2:
        if user.trusted_project:
            return PermissionResult(Decision.ALLOW)
        return PermissionResult(Decision.REQUIRE_USER_CONFIRM, f"{call.name} requires policy confirmation")

    if tier == 3:
        # External effect — money / messages / deploys
        if not call.idempotency_key:
            return PermissionResult(Decision.DENY, f"{call.name} missing idempotency_key — refuse")
        if not user.confirmed_purchase(call.idempotency_key):
            return PermissionResult(Decision.REQUIRE_USER_CONFIRM, f"user must confirm {call.name}")

        # Optional spending checks (only for money-handling tools)
        amount = call.args.get("total_amount")
        if amount is not None:
            if amount > SPEND_CAPS["per_purchase"]:
                return PermissionResult(Decision.REQUIRE_TYPED_CONFIRM, f"amount ${amount} exceeds per_purchase cap")
            if user.spent_today + amount > SPEND_CAPS["per_day"]:
                return PermissionResult(Decision.DENY, f"daily cap exceeded ({user.spent_today + amount} > {SPEND_CAPS['per_day']})")

        # Quote freshness check (shopping-specific)
        if call.name == "charge_payment" and user.quote_age and user.quote_age > timedelta(minutes=10):
            return PermissionResult(Decision.DENY, "quote is stale — re-quote required")

        return PermissionResult(Decision.ALLOW)

    if tier == 4:
        if not user.confirmed_purchase(call.idempotency_key or ""):
            return PermissionResult(Decision.REQUIRE_TYPED_CONFIRM, f"{call.name} is irreversible — typed confirmation required")
        return PermissionResult(Decision.ALLOW)

    return PermissionResult(Decision.DENY, f"unknown tier {tier}")


# === Example use in the harness loop ===
if __name__ == "__main__":
    # Demo
    user = UserContext(user_id="alice", trusted_project=True)

    examples = [
        ToolCall("read_file", {"path": "/etc/passwd"}),
        ToolCall("edit_file", {"path": "src/x.py"}),
        ToolCall("bash", {"command": "ls"}),
        ToolCall("git_push", {"branch": "main"}, idempotency_key="push-2026-05-26-001"),
        ToolCall("drop_table", {"table": "users"}, idempotency_key="drop-001"),
    ]

    for call in examples:
        result = permission_check(call, user)
        print(f"{call.name:20s} → {result.decision.value:25s} ({result.reason})")
