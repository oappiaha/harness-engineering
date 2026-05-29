# Decisions

> Design log. Every non-trivial choice + the rejected alternatives + the reason.
>
> **Session-scale ratchet:** add an entry **immediately** when the user corrects you or you discover a gap. Don't wait for "review time."

## Format

```markdown
## YYYY-MM-DD — <Short decision name>

**Decision:** <what was decided>

**Reason:** <why; cite specific incidents, constraints, or data>

**Rejected alternative:** <what we considered and didn't pick, with why>

**Constraint added to:** <AGENTS.md? a hook? a tier change?>

**Expiry:** <when this decision should be re-evaluated; or "None — permanent until X">
```

---

## Initial entries

## YYYY-MM-DD — Phase 0 pre-flight completed

**Decision:** Locked the 5 pre-flight answers and 7 architectural decisions per `docs/harness-design.md`.

**Reason:** TODO — paste the one-sentence value prop here.

**Rejected alternative:** TODO — was there a different framework or blueprint considered?

**Constraint added to:** All Phase 1 work follows the design doc; deviations require an entry here.

**Expiry:** Quarterly re-audit (next: YYYY-MM-DD).

---

## YYYY-MM-DD — Initial AGENTS.md authored

**Decision:** TODO — list the hard constraints in AGENTS.md.

**Reason:** TODO — what specific past failures or external rules motivate each constraint?

**Rejected alternative:** TODO — what we considered putting in but didn't.

**Constraint added to:** `AGENTS.md`.

**Expiry:** Each constraint reviewed every 90 days. Remove if no longer earning its place.

---

<!-- Add new entries above. Newest on top. -->
