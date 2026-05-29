# Sprint Contract: `<Task name>`

> Pre‑task negotiated agreement between user and agent (and/or planner agent and generator agent). Authored *before* code. The literal definition of "done" for this task.
>
> Operator: copy this file per non‑trivial task, fill in, and have the user sign off **before implementation begins**.

## Goal

> TODO: one sentence — what does completing this task accomplish for the user?

## Scope

What's IN:

- TODO
- TODO
- TODO

## Exclusions

What's deliberately OUT of scope — these will NOT be done in this task:

- TODO
- TODO

(Documenting exclusions prevents scope creep AND prevents the agent from "helpfully" expanding the task.)

## Verification standards

How we know the task is done. **Each criterion must be executable or observable.**

- [ ] TODO (e.g., `pytest tests/cart/test_pagination.py` exits 0)
- [ ] TODO (e.g., `curl -f http://localhost:3000/api/cart?cursor=X` returns 200 with valid JSON)
- [ ] TODO (e.g., Playwright test `tests/visual/cart-page.spec.ts` passes)
- [ ] TODO (e.g., `docs/api.md` updated with new endpoint)

## Acceptance evidence

What artifacts will be captured to prove the task is done:

- TODO (e.g., `screenshots/cart-page-after.png`)
- TODO (e.g., `tests/cart/test_pagination.py` exists and passes)
- TODO (e.g., commit SHA on main: `abc1234`)

## Rubric (for inferential / open-ended outputs only)

If the task produces an open‑ended output (writing, design, recommendation), grade against this rubric:

| Dimension | A | B | C | D |
|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO | TODO |

**Grader:** TODO (which agent grades? must be different from the generator)

## Risk

- Worst case if this goes wrong: TODO
- Reversibility: TODO (instant / minutes / hours / impossible)
- Rollback plan: TODO

## Sign‑off

- [ ] User has reviewed and approved scope, exclusions, and verification standards
- [ ] Generator agent acknowledges contract
- [ ] Evaluator agent acknowledges rubric

---

**On completion:**
1. Generator agent produces artifact.
2. Evaluator agent grades against rubric (if applicable).
3. Verification commands run (computational check).
4. If all pass: commit, update `PROGRESS.md`, update `features.json` state to `passing`.
5. If any fail: re‑plan with feedback; do NOT proceed.
