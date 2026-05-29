# Worked Example — Deep Research Agent

> A complete Phase 0 → Phase 3 build of a research agent ("Citator") for an internal analyst team.

---

## The project in one sentence

> *Citator helps strategy analysts at our firm produce 5–10 page market briefings with verifiable citations, in 30–60 minutes instead of 8+ hours.*

---

## Phase 0 — `docs/harness-design.md` (filled in)

```markdown
# Harness Design — Citator

## Project
One-sentence value: Citator helps strategy analysts at our firm produce 5-10 page
market briefings with verifiable citations, in 30-60 minutes instead of 8+ hours.

## Pre-flight

### Q1 — Who/what valuable?
Strategy analyst at our firm. Smallest valuable unit: a 3-page briefing on one
specific question (e.g., "current state of the EU AI Act implementation") with
EVERY claim cited. Alternative today: 8 hours of tabs, manual notes, hand-formatted.

### Q2 — Timescale?
Single window for one briefing (~30-60 min). Multi-window for "campaign" briefings
where one analyst tracks a topic across weeks. Need both modes; build the
single-window mode first.

### Q3 — Model co-trained?
Mostly — research is a co-trained capability but citation discipline and
source-diversity are NOT. Medium-thin harness with strong verification.

### Q4 — Worst risk tier?
Tier 1 (web fetches; writes to a research_journal). No external mutations.

### Q5 — Single or multi-user?
Multi-user, hosted. Internal SaaS used by 8-12 analysts.

## Derived decisions

1. Agent count:        Multi-agent. Planner + fan-out (one subagent per
                       subquestion) + synthesizer + independent judge.
2. Reasoning strategy: R.P.I. — analyst reviews the plan before fan-out (their
                       domain expertise is in framing the right subquestions).
3. Context strategy:   Rich for subagents (each one needs full source context);
                       aggressive compaction in the main loop (only summaries).
4. Verification:       Inferential (judge with rubric) + computational
                       (citation_extract verifies every URL resolves and quote
                       appears in fetched text).
5. Permissions:        Tiered. Mostly Tier 0-1. No Tier 3+.
6. Tool scoping:       Minimal per step. Domain-specific tool kit.
7. Harness thickness:  Medium. Encode citation discipline; let the model handle
                       synthesis.

## Framework choice
LangGraph. Reasons: fan-out + synthesis = explicit graph; need
checkpointing because long-running campaign briefings; auditable transitions
for compliance review.

## Blueprint chosen
02-deep-research-agent. Modifications:
- Per-firm trusted-source list (we prefer official EU/SEC/FT sources for some
  topics)
- Internal vector store for prior briefings as one of the source backends

## Open questions
- Do we want analyst-level personalization beyond per-firm? Defer until 6 weeks
  of production usage.
- Multi-language sources (briefings may need to cite French/German originals)?
  Phase 4 problem.

## Sign-off
[x] all 5 / 7 decisions / framework / blueprint / user approved
```

---

## Phase 1 — `AGENTS.md` (research‑specific, 72 lines)

```markdown
# Citator — Agent instructions

Citator produces market/policy/competitive briefings with verifiable citations.
Used by strategy analysts at our firm. Hosted internal SaaS.

## First run
make setup     # install deps, init vector store
make dev       # start research_journal API + worker
make test      # pytest tests/ -x
make check     # ruff + mypy + pytest + citation-integrity tests

## Hard constraints

- Every factual claim in a briefing MUST have a [src] reference resolving to a
  fetched source and a quoted excerpt containing the claim.
- Source diversity: max 30% of citations may come from a single domain.
- Recency: when a query implies "current" or "recent", prefer sources <90 days
  old; flag older.
- Never include uncited claims — even "common knowledge" requires a citation.
- Briefings >5 pages must go through pipeline review (UX -> domain -> devil's
  advocate subagents).

## Verification commands
- Unit:           pytest tests/unit -x
- Integration:    pytest tests/integration
- Citation check: python scripts/verify_citations.py drafts/*.md
- Full:           make check (includes citation check)

## Topic docs
- docs/source-tiers.md — trusted source hierarchy + per-domain caveats
- docs/rubric.md — A/B/C/D grading dimensions for briefings
- docs/citation-format.md — exact format for [src] references

## Session protocol
Clock-in: read PROGRESS.md + DECISIONS.md + active briefing's plan.md
Clock-out: update PROGRESS.md; capture briefing artifact in
research-jobs/<job-id>/

## Tools
- web_search (multi-provider)
- web_fetch (sanitized HTML→markdown; SSRF-safe)
- pdf_extract
- citation_extract (URL + claim -> exact excerpt that contains the claim)
- research_journal_write / research_journal_query
- vector_store_search (prior briefings)
- report_render (markdown -> final format)

## Memory
- index.md: lightweight per-firm preferences + per-analyst topic profile
- topic files: one per ongoing campaign
- Memory is hint; verify against current source state before acting

## What goes wrong
- Hallucinated citations (URL doesn't say what agent claims) -> citation_extract
  must return EXACT excerpt that contains the claim; judge verifies.
- Echo chamber -> source diversity rubric dimension catches.
- Stale data -> recency rubric dimension catches; flag <90d when implied.
```

---

## Phase 1 — `Makefile` (research‑specific)

```makefile
.PHONY: setup dev test test-unit test-integration test-citation lint typecheck check clean

setup:
	uv venv && uv pip install -e ".[dev]"
	docker-compose pull
	python scripts/init_vector_store.py

dev:
	docker-compose up -d  # postgres + redis + qdrant
	uv run uvicorn citator.api:app --reload

test-unit:
	uv run pytest tests/unit -x

test-integration:
	uv run pytest tests/integration

test-citation:
	# Verifies that every [src] in test fixtures resolves AND the quoted text
	# actually appears in the fetched source.
	uv run python scripts/verify_citations.py tests/fixtures/briefings/*.md

test: test-unit test-integration test-citation

lint:
	uv run ruff check src/ tests/

typecheck:
	uv run mypy --strict src/

check: lint typecheck test
	@echo "✓ make check passed"

clean:
	rm -rf .pytest_cache .mypy_cache cache/web_fetches
	docker-compose down -v
```

---

## Phase 2 — `features.json`

```json
[
  {
    "id": "CT01",
    "behavior": "Briefing on EU AI Act implementation status, 3 pages, all claims cited, source diversity >0.5",
    "verification": "make check && python scripts/judge_run.py drafts/eu-ai-act.md --threshold B",
    "state": "passing",
    "evidence": "research-jobs/2026-05-20-eu-ai-act/final.md, judge grade A/A/B/A/A"
  },
  {
    "id": "CT02",
    "behavior": "Fan-out across 5 subquestions completes in <8 minutes for a 3-page briefing",
    "verification": "python scripts/benchmark.py --task small_briefing --runs 5 --max-p95 480",
    "state": "active",
    "evidence": null
  },
  {
    "id": "CT03",
    "behavior": "Campaign mode: weekly delta briefings on a topic, with diff against prior week",
    "verification": "pytest tests/integration/test_campaign_mode.py",
    "state": "not_started",
    "evidence": null
  }
]
```

---

## Phase 3 — Architecture (LangGraph topology)

```python
# src/citator/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver

class ResearchState(TypedDict):
    question: str
    plan: dict | None              # subquestions
    findings: dict[str, dict]      # SQ -> subagent output
    draft: str | None
    grade: dict | None             # rubric scores
    revision_count: int

def planner_node(state):
    return {"plan": planner_agent.run(state["question"])}

def fan_out_node(state):
    findings = {}
    for sq in state["plan"]["subquestions"]:
        # Each subagent has its own context budget
        findings[sq["id"]] = subagent_run(sq)
    return {"findings": findings}

def synthesizer_node(state):
    return {"draft": synthesizer_agent.run(
        question=state["question"],
        plan=state["plan"],
        findings=state["findings"],
    )}

def judge_node(state):
    # CRITICAL: judge is a SEPARATE agent with explicit rubric
    return {"grade": judge_agent.run(
        artifact=state["draft"],
        rubric=load_rubric(),
    )}

def route_after_judge(state):
    if state["grade"]["lowest"] in ("A", "B"):
        return END
    if state["revision_count"] >= 2:
        return END  # escalate to human after 3 attempts
    return "synthesizer"

g = StateGraph(ResearchState)
g.add_node("planner", planner_node)
g.add_node("fan_out", fan_out_node)
g.add_node("synthesizer", synthesizer_node)
g.add_node("judge", judge_node)
g.add_edge(START, "planner")
g.add_edge("planner", "fan_out")
g.add_edge("fan_out", "synthesizer")
g.add_edge("synthesizer", "judge")
g.add_conditional_edges("judge", route_after_judge,
                        {"synthesizer": "synthesizer", END: END})

app = g.compile(checkpointer=PostgresSaver.from_conn_string(DB_URL))
```

---

## Phase 3 — Judge rubric (`docs/rubric.md`)

```markdown
# Briefing Evaluation Rubric

| Dimension          | A                       | B                       | C                  | D                  |
|--------------------|-------------------------|-------------------------|--------------------|--------------------|
| Citation coverage  | 100% claims cited       | >90% cited              | >70% cited         | <70% or hallucinated |
| Source diversity   | 5+ source types         | 3-4                     | 2                  | 1 / echo chamber    |
| Depth per SQ       | All SQs fully answered  | All but minor gaps      | 1-2 gaps           | >2 gaps             |
| Balance            | Multi-perspective       | Some perspective        | Single view        | Echo chamber        |
| Recency (if implied)| <90d primary sources   | <180d                   | <365d              | >1yr or unflagged   |
| Prose clarity      | Analyst-publishable     | Editable                | Needs rework       | Rewrite             |

Lowest grade wins. C or D triggers re-work.
```

---

## Critical implementation: `citation_extract` (the lynchpin tool)

```python
# src/citator/tools/citation_extract.py
@tool("citation_extract",
      "Given a claim and a source URL, fetch the URL and extract the EXACT excerpt "
      "from the source that contains or supports the claim. Returns the excerpt and "
      "its location. If no excerpt supports the claim, returns null — DO NOT INVENT.",
      {"claim": str, "url": str})
async def citation_extract(args):
    claim = args["claim"]
    url = args["url"]

    # 1. Fetch (cached, sanitized, SSRF-safe)
    page = await web_fetch_cached(url)
    if not page:
        return {"content": [{"type": "text", "text": "ERROR: could not fetch URL"}]}

    # 2. Sanitize — strip injection-shaped content
    text = sanitize(page.text)

    # 3. Find a passage supporting the claim
    # Use a small dedicated model (not the main planner) to extract
    excerpt = await extraction_model.find_supporting_excerpt(claim, text)

    if not excerpt:
        # CRITICAL: do not fabricate. Return null.
        return {"content": [{
            "type": "text",
            "text": f"NO MATCH: no excerpt in {url} supports the claim. "
                    f"Consider this an absent citation."
        }]}

    return {"content": [{
        "type": "text",
        "text": f"URL: {url}\n"
                f"Position: {excerpt.location}\n"
                f"Excerpt: {excerpt.text}",
    }]}
```

The judge then runs an *independent* verification: it re‑fetches each cited URL and confirms the excerpt actually appears in the source. **Two layers of citation integrity.**

---

## Phase 3 — `DECISIONS.md` highlights

```markdown
## 2026-05-26 — Hallucinated citation blocked by citation_extract returning null

**Decision:** citation_extract must return null when no excerpt supports the
claim. Synthesizer MUST drop the claim if extraction returns null. Judge
re-verifies after synthesis.

**Reason:** First pilot briefing on EU AI Act contained one claim with a
plausible-looking but non-existent citation. Subagent had inferred the claim
from context and "filled in" a URL. citation_extract returning null + judge
re-fetch caught it on second briefing.

**Rejected alternative:** Trust the subagent's citation. Doesn't scale — every
analyst hour is paid; every uncaught hallucination is a credibility hit.

**Constraint added to:** AGENTS.md hard constraint #1, judge rubric (citation
coverage dimension), citation_extract tool docs.

**Expiry:** Permanent.


## 2026-05-26 — Source diversity rubric dimension

**Decision:** Briefings with >30% citations from a single domain get downgraded
on "source diversity" dimension. Judge enforces.

**Reason:** Test briefing on AI regulation pulled 7 of 10 citations from
techpolicy.press. Strong source but echo-chamber risk; user-facing briefings
should triangulate.

**Rejected alternative:** Hard reject. Too strict for niche topics where one
source may dominate legitimately. Downgrade + analyst override is the right
balance.

**Constraint added to:** docs/rubric.md (Source diversity row).

**Expiry:** Re-evaluate after 50 briefings.
```

---

## What this teaches

1. **Domain‑specific tools are where the value lives.** `citation_extract` is THE differentiating tool. Generic web search alone wouldn't produce this quality.

2. **The judge enforces what the generator might cheat on.** Two layers — synthesizer drops uncitable claims; judge re‑verifies. Belt and suspenders.

3. **Fan‑out is bounded.** Each subagent gets a bounded subquestion + a token cap on its summary. Otherwise the synthesizer drowns.

4. **The rubric is the contract.** Once it exists, "is this briefing done?" becomes "did the judge give A or B on every dimension?" Computational tractable.

5. **Compliance‑friendly via LangGraph checkpoints.** Every state transition (plan → fan‑out → synthesize → judge) is auditable. A regulator asking "how did you derive this claim?" can trace it.

---

## What you'd do differently for your project

- Your domain‑specific tools are not `citation_extract`. They might be `evidence_extract` for legal, `pricing_lookup` for procurement, `medical_evidence_search` for clinical research. Same pattern, different verb.
- Your rubric dimensions are not the same. Source diversity matters less for technical research; more for policy.
- Your fan‑out cap is project‑specific. Tune to cost.

The pattern is reusable. The contents are not.
