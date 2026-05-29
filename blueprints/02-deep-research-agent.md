# Blueprint 02 — Deep Research Agent

> **Target user:** an analyst, researcher, or PM who wants a thorough, cited, multi‑source answer to a complex question — not a quick search‑engine summary.

This is the second‑most‑mature blueprint after coding agents. Deep research products (Perplexity, OpenAI Deep Research, Claude's web search, etc.) have converged on similar patterns.

---

## 1. Description and target user

A deep research agent ingests a research question, fans out to many sources, reads and extracts findings, judges quality, and synthesizes a cited report. The user is anyone who would otherwise spend hours on tabs: investors, academics, lawyers, journalists, PMs.

The output is a **report with citations**, not a chat answer.

---

## 2. Why this domain needs a custom harness

A raw LLM with web search gets you:
- Plausible facts (some hallucinated)
- Shallow coverage (1–2 sources)
- No structured citations
- No verification against original source

The harness adds:
- **Fan‑out** over many sources (subagents working in parallel)
- **Citation discipline** (every claim → URL + extract)
- **A judge** (independent agent scores draft against rubric)
- **Long‑horizon planning** (the question often spawns subquestions)
- **Caching** (sources visited once, not per subagent)

---

## 3. Architecture

```
                    ┌───────────────────────────┐
   User question ──▶│   Planner agent           │
                    │   (decomposes into        │
                    │    subquestions)          │
                    └──────────────┬────────────┘
                                   ▼
                    ┌───────────────────────────┐
                    │   Plan reviewed by user   │
                    │   (R.P.I. plan step)      │
                    └──────────────┬────────────┘
                                   ▼ (approved)
                    ┌───────────────────────────┐
                    │   Fan‑out coordinator     │
                    └──────────────┬────────────┘
       ┌───────────────────┬───────┴──────┬──────────────────┐
       ▼                   ▼              ▼                  ▼
  ┌─────────┐         ┌─────────┐    ┌─────────┐        ┌─────────┐
  │Subagent │         │Subagent │    │Subagent │   …    │Subagent │
  │ on SQ1  │         │ on SQ2  │    │ on SQ3  │        │ on SQN  │
  └────┬────┘         └────┬────┘    └────┬────┘        └────┬────┘
       │  uses web search, fetch, PDF extract, extract        │
       │                                                      │
       └────────────┬─────────────────────────────────────────┘
                    ▼
              Summaries (1–2K tokens each)
              + citation set per subquestion
                    │
                    ▼
            ┌──────────────────┐
            │   Synthesizer    │ ← writes draft report
            └────────┬─────────┘
                     ▼
            ┌──────────────────┐
            │   Judge (eval)   │ ← independent grade vs rubric
            └────────┬─────────┘
                     ▼
            ┌──────────────────┐
            │   Final report   │
            │   + citations    │
            └──────────────────┘
```

---

## 4. Core decisions

| Decision | Choice | Reasoning |
|---|---|---|
| **Thin vs thick** | Medium | Models are co‑trained on web search; less so on structured synthesis + citation discipline → some scaffolding |
| **Inside vs outside sandbox** | **Outside** (if hosted SaaS) | Multi‑user; sandboxes idle during LLM thinking; per‑user credentials (search APIs) stay with loop |
| **Multi‑user** | Yes | Almost always a hosted product |
| **Memory** | Short‑term per query + long‑term per‑user profile (interest areas, reading level, preferred sources) |
| **State** | Job‑centric: each research run is a job with a state machine (planning → fan‑out → synthesizing → judging → done) |
| **Subagents** | **Heavy fan‑out**; one subagent per subquestion or per source cluster |
| **Verification** | Citation check (every claim cited?) + judge with rubric + factual reconciliation across subagent summaries |
| **Framework fit** | LangGraph (auditable, multi‑agent), OpenAI Agents SDK (clean handoffs), Claude Agent SDK if hosted on Anthropic infra |

---

## 5. Tool inventory

| Category | Tools | Notes |
|---|---|---|
| **Search** | web_search (multi‑provider: Google, Bing, Brave, Perplexity API), academic_search (Semantic Scholar, arXiv) | Cache aggressively; same query across subagents = one fetch |
| **Fetch** | web_fetch (HTML→markdown), pdf_extract, image_describe | Sandbox to prevent SSRF |
| **Extract** | citation_extract (URL → title + author + date + excerpt), structured_extract (URL + schema → JSON) | Tooled fact extraction is more reliable than free‑text |
| **Analysis** | summarize_with_citations (text → bullet points each with `[src]` ref) | LLM tool, not classical |
| **Memory** | research_journal_write (append‑only log of findings), research_journal_query | Becomes the report's evidence trail |
| **Output** | report_render (markdown → final format with citations) | Deterministic templating |

**Critical:** **citation_extract** is the lynchpin tool. Every fact in the final report should be traceable to a `(URL, page/section, exact extract)` tuple. Without this, the report is hallucination‑prone.

---

## 6. State files (per‑job)

```
research-jobs/<job_id>/
├── question.md                  # original question + any human refinement
├── plan.md                      # decomposed subquestions (reviewed by user)
├── PROGRESS.md                  # which subquestions in progress / done
├── findings/
│   ├── sq1/
│   │   ├── sources.json         # list of (url, title, date, fetched_at)
│   │   ├── extracts.json        # extracted citations (url, excerpt, claim)
│   │   └── summary.md           # subagent's 1–2K word summary
│   ├── sq2/...
├── draft.md                     # synthesizer's output
├── judge.json                   # judge's rubric grades + comments
└── final.md                     # delivered report
```

Per‑user (long‑lived):
```
users/<user_id>/
├── preferences.md               # reading level, preferred citation style, etc.
├── domain_profile.md            # what they research most; helps tailor depth
└── past_jobs.json               # references to prior reports (NOT contents)
```

---

## 7. Subagent topology

| Pattern | When | Cap |
|---|---|---|
| **Planner** | Always — decomposes question into subquestions | 1 |
| **Fan‑out (per subquestion)** | Parallel investigation across SQs | 5–10 typical, configurable |
| **Source‑cluster subagent** | Deep dive on one source type (academic / news / regulatory) | As needed |
| **Synthesizer** | Always — writes the draft from findings | 1 |
| **Judge** | Always — scores against rubric | 1 |
| **Reconciler** | Triggered if subagents disagree on a fact | On demand |

Subagent summaries are **strictly bounded** (1–2K tokens) so the synthesizer's main context doesn't drown.

**Anti‑pattern specific to research:** spawning a subagent per source (instead of per subquestion). Source‑level granularity is too fine — you end up with 50 subagents, no synthesis.

---

## 8. Verification strategy

Three layers, all mandatory for production:

| Layer | What |
|---|---|
| **L1 — Citation check** | Every claim in draft has a `[src]` reference. Each `[src]` resolves to a real fetched source. |
| **L2 — Cross‑source reconciliation** | For claims appearing in 2+ subagent summaries, do they agree? Disagreements flagged. |
| **L3 — Judge rubric** | Independent evaluator scores: completeness, depth, citation quality, balance, prose clarity, conclusion strength. Lowest grade wins. |

```
Rubric example
| Dimension          | A                  | B                | C            | D            |
|--------------------|--------------------|------------------|--------------|--------------|
| Citation coverage  | 100% claims cited  | >90%             | >70%         | <70%         |
| Source diversity   | 5+ source types    | 3–4              | 2            | 1            |
| Depth per SQ       | All SQs answered   | All but minor    | 1–2 missing  | >2 missing   |
| Balance            | Multi‑perspective  | Some perspective | Single view  | Echo chamber |
| Prose clarity      | Publishable        | Editable         | Needs work   | Rewrite      |
```

The judge **must not** be the synthesizer. Use a different agent (or different model) for the grade.

---

## 9. Build steps

1. **Define the question schema.** What is the input format? Plain text? Structured (topic + depth + recency)?
2. **Build the planner.** Single agent that decomposes question → 5–15 subquestions. Output a `plan.md` for review.
3. **Build the fan‑out coordinator.** Spawns one subagent per subquestion. Bounded concurrency (default 5).
4. **Wire web search + fetch + PDF extract.** Cache aggressively (same URL across subagents = one fetch). Sandbox HTML for SSRF.
5. **Build `citation_extract`.** This is the lynchpin tool — claim + URL + exact excerpt.
6. **Constrain subagent output format.** 1–2K tokens, structured: findings + citations + open questions.
7. **Build the synthesizer.** Reads all subagent outputs, writes draft.md with `[src]` references.
8. **Build the judge.** Independent agent, rubric‑driven. C or D triggers re‑work.
9. **Wire long‑horizon resumption.** Job state machine; jobs survive process restart (durable execution).
10. **Observability.** Per‑subagent cost; per‑source fetch count; cache hit rate; rubric grade distribution.

---

## 10. Failure modes specific to deep research

| Failure | Counter |
|---|---|
| Hallucinated citations (URL doesn't say what agent claims) | `citation_extract` returns exact excerpt; judge verifies excerpt contains the cited claim |
| Echo chamber (all subagents cite same few sources) | Source diversity in rubric; per‑subagent constraint on max sources from same domain |
| Subquestion overlap (3 subagents researching same thing) | Planner deduplication; coordinator dispatches mutually exclusive subqueries |
| One slow subagent blocks all | Per‑subagent timeout; coordinator returns partial results |
| Costly re‑fetches | Per‑job URL cache; per‑user URL cache for repeat queries |
| Subagent disagreements buried in summary | Reconciler subagent for conflicts; judge flags unreconciled disagreements |
| Stale data (sources from 5 years ago) | Recency weighting in source ranking; freshness rubric dimension |
| Synthesizer over‑confident on weak evidence | Confidence calibration prompt; rubric penalizes unhedged claims with single source |
| Prompt injection from fetched pages | Sandbox fetch; strip executable content; treat web text as untrusted user input |
| Unbounded fan‑out cost | Hard cap on subagents per job + token budget per job |

---

## Reference reads

- Subagent patterns (fan‑out detail): `../core/06-subagents.md`
- R.P.I. framework (Research → Plan → Implement): `../core/06-subagents.md` Part 5
- Long‑horizon execution: `../core/07-state-and-persistence.md`
- Verification with judge + rubric: `../core/10-observability.md`
- Multi‑user architecture: `../architectural-decisions.md` (Decision 2)
