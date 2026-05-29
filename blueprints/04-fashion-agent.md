# Blueprint 04 — Fashion Agent

> **Target user:** anyone with a wardrobe and limited time. The agent knows your closet, your taste, the occasion, the weather, and your goals; recommends what to wear, what to buy, and what to retire.

This is the **least co‑trained** domain of the five blueprints — fashion judgment, visual taste, and wardrobe state are not standard model capabilities. The harness does more work; the model does less. Expect thicker scaffolding.

---

## 1. Description and target user

A fashion agent is a hybrid of:
- A **stylist** (taste + occasion + body)
- A **wardrobe manager** (what you own + condition + last worn)
- A **personal shopper** (gap analysis + retail purchase)
- A **visual reviewer** (looks at outfit photos and gives feedback)

Users: consumers (especially those with active social/work calendars), creators, professionals with image considerations, anyone overwhelmed by their closet.

---

## 2. Why this domain needs a custom harness

A raw LLM can describe a great outfit — but can't:
- See what you own (no wardrobe state)
- See what you actually look like (no visual feedback)
- Know what's clean / dirty / at the dry cleaner
- Track what you wore last week (no memory of wear)
- Browse the actual stores you shop at (no catalog access)
- Compose outfits using **only** items that fit, are in season, and match the occasion

Fashion is one of the few domains where **visual feedback** is a first‑class verification tool, not an afterthought. Playwright‑style screenshots become wardrobe photos and outfit mirror selfies.

---

## 3. Architecture

```
                  ┌─────────────────────────────────────┐
   "What should  │  Intent normalizer                  │
    I wear?" ──▶ │  (occasion + weather + mood +       │
                 │   constraints + goal)               │
                 └─────────────────┬───────────────────┘
                                   ▼
                 ┌─────────────────────────────────────┐
                 │  Wardrobe query                     │  ← reads wardrobe DB
                 │  (what's available right now)       │     filtered: clean, fits, in‑season
                 └─────────────────┬───────────────────┘
                                   ▼
                 ┌─────────────────────────────────────┐
                 │  Outfit composer                    │
                 │  (combinatorial; pulls 3 options)   │
                 └─────────────────┬───────────────────┘
       ┌───────────────────────────┴─────────────────────────┐
       ▼                                                     ▼
  ┌──────────┐   ┌──────────┐    ┌──────────┐          ┌─────────────┐
  │Option A  │   │Option B  │    │Option C  │ ◀── parallel image gen
  │ render   │   │ render   │    │ render   │     (sample look,
  └────┬─────┘   └────┬─────┘    └────┬─────┘     not photoreal)
       │              │                │
       └──────────────┴────────────────┘
                       ▼
              ┌──────────────────┐
              │  Visual judge    │ ← scores: cohesion, occasion fit,
              └────────┬─────────┘   user taste profile
                       ▼
              ┌──────────────────┐
              │  User picks      │ ← always human review
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Wear log update │ ← marks items "worn today"
              └──────────────────┘

   Sidecar: gap analyzer + shopper (if recurring shortfall in wardrobe)
```

---

## 4. Core decisions

| Decision | Choice | Reasoning |
|---|---|---|
| **Thin vs thick** | **Thick** | Wardrobe state, taste, occasion semantics aren't well covered by raw LLM; explicit logic for filtering, scoring, composing |
| **Inside vs outside sandbox** | **Outside** | Multi‑user SaaS; image data + payment + addresses live with the loop |
| **Multi‑user** | Yes | Hosted app |
| **Memory** | Heavy: per‑user **taste profile** (slowly evolving), **wardrobe inventory** (changes daily), **wear log** (per day), **outfit history** (what worked / what didn't) |
| **State** | Wardrobe DB is the central state; outfit suggestions are derived |
| **Subagents** | Outfit composer (combinatorial), visual judge, gap analyzer, shopper (handoff to shopping blueprint) |
| **Verification** | **Visual:** render outfit, judge it. **Behavioral:** user picks; if they reject, that's signal |
| **Framework fit** | LangGraph (state graph fits the multi‑step composition), or CrewAI (stylist / wardrobe manager / personal shopper map well to roles) |

---

## 5. Tool inventory

| Tool | Risk tier | Purpose |
|---|---|---|
| `wardrobe_query` | 0 | Filter inventory by attribute (color, type, season, clean status) |
| `wardrobe_add` | 1 | Add an item (from photo + extracted attributes) |
| `wardrobe_update` | 1 | Update condition / status / location |
| `wardrobe_retire` | 1 | Mark item out of rotation (donated, lost, ruined) |
| `weather_lookup` | 0 | Today's weather + forecast |
| `calendar_lookup` | 0 | Today's events → infer occasion + dress code |
| `outfit_compose` | 0 | Generate N outfit combinations from wardrobe filtered set |
| `outfit_render` | 0 | Generate sample look image (not photoreal — just composition preview) |
| `outfit_score` | 0 | LLM judge against taste profile + occasion |
| `wear_log_append` | 1 | Mark items as worn today |
| `taste_profile_read` | 0 | Read user's taste profile |
| `taste_profile_update` | 1 | Update from feedback signals (with user confirmation) |
| `gap_analyze` | 0 | Identify wardrobe gaps from recurring shortfalls |
| `shop_recommend` | 0 | Surface candidate purchases (handoff to shopping blueprint for actual purchase) |

**Critical:** `outfit_render` doesn't need to be photoreal — a stylized sample look is enough to compare against the user's taste. The verification is **the user's eye**, not the agent's.

---

## 6. State files

Per‑user (long‑lived):
```
users/<user_id>/
├── taste_profile.md
│   # Style descriptors (preppy / minimal / streetwear / formal)
│   # Color palette (likes / avoids)
│   # Silhouette preferences
│   # Brands favored / blocked
│   # Confidence by occasion type
├── wardrobe.json
│   # Items list with attributes:
│   # [{id, type, color, season, brand, size, condition, location,
│   #   last_worn, photo_url, retired}]
├── occasions.json
│   # User‑defined occasion types with dress codes
├── wear_log.json
│   # Per‑day record of what was worn (for "haven't worn X in 3 months" insights)
├── outcomes.md
│   # User feedback: "loved Tuesday's outfit", "felt awkward in pants combo"
└── gaps.md
    # Identified wardrobe gaps (auto‑refreshed weekly)
```

Per‑recommendation session:
```
sessions/<session_id>/
├── intent.md          # occasion + weather + mood + constraints
├── candidates.json    # 3–5 outfit options
├── chosen.json        # what user picked
└── feedback.md        # captured during/after wear
```

---

## 7. Subagent topology

| Pattern | When |
|---|---|
| **Pipeline (compose → score → render → judge)** | Per outfit suggestion |
| **Fan‑out over options** | Render 3 looks in parallel for user comparison |
| **Independent visual judge** | Scores composition against taste profile |
| **Gap analyzer (background)** | Periodic, not per‑request |
| **Shopper (handoff)** | When gap is severe; hands off to shopping blueprint |

The visual judge **must be a different agent than the composer.** Otherwise self‑evaluation bias means the agent loves its own outfits.

---

## 8. Verification strategy

Fashion is non‑deterministic, so verification is **layered confidence**, not pass/fail:

| Layer | What |
|---|---|
| **Hard constraints** | Items exist, are clean, fit, are in season, match occasion's dress code. Binary pass/fail. |
| **Soft constraints** | Color cohesion, silhouette balance, formality consistency. Scored 0–100. |
| **Visual rendering** | Generate composition preview. Composer + judge both inspect. |
| **User pick** | Strongest signal. Track which option got picked → adjusts taste profile. |
| **Post‑wear feedback** | Optional 1‑tap "loved it / fine / not me" after wear log entry. |

The trick: don't overfit to user feedback (taste evolves slowly), but feed it back enough that the agent learns.

---

## 9. Build steps

1. **Build the wardrobe DB first.** Inventory schema. Item ingestion via photo → attribute extraction. This is the hardest data problem.
2. **Build `wardrobe_query` with confidence.** Filtering must be reliable; nothing else works if this is buggy.
3. **Build taste profile schema** based on real user data. Iterate on the dimensions.
4. **Build occasion taxonomy.** "Casual / business casual / formal / workout / date / vacation" — minimum 8 occasion types with dress codes.
5. **Build `outfit_compose`.** Combinatorial over filtered set, scoring against soft constraints.
6. **Build `outfit_render`.** Stylized composition image, not photoreal.
7. **Build the visual judge.** Separate agent; scores against user's taste profile.
8. **Build the user picker UI.** 3 options, photo + reasoning. Pick = feedback.
9. **Build wear log + outcome capture.** Track what was worn, ask for outcome.
10. **Build gap analyzer + shopper handoff.** Once per week, identify gaps; hand off to shopping blueprint for actual purchase.

---

## 10. Failure modes specific to fashion

| Failure | Counter |
|---|---|
| Recommends items user doesn't own | Hard filter on `wardrobe_query`; agent gets only owned items as input |
| Recommends dirty / at‑cleaners items | Status field on items; filter respects it |
| Mismatched occasion (track suit for client dinner) | Occasion → dress code → filter; hard reject items below dress code |
| Same outfit recommended week after week | Wear log integration; weight recently‑worn items down |
| Item retired but still in DB | Retirement field; explicit retire flow |
| Taste profile drifts wrong direction from one bad pick | Smoothing: profile updates are weighted; single signals don't overcorrect |
| User photo upload fails or has poor attributes | Manual attribute editing UX; allow override |
| Hallucinated brand/material/care info | Pull from retailer / known DB; never agent‑generated |
| Visual rendering doesn't match real items | Use rendering as composition preview, not as ground truth; user picks based on actual item photos |
| Body / fit not considered (only owns items, not what fits today) | Optional fit/condition tags; user can "exclude" items temporarily |
| Cultural / context misses (formal in different cultures) | Per‑user culture preference in profile; conservative defaults |
| Cost of running visual generation per request | Cache rendered outfits; render only top 3, not all combinations |

---

## Critical: visual judgment is *the* failure mode

Most fashion agent failures look like "the outfit makes no sense." Mitigations specific to this:

- **Rules first.** Color palettes (split‑complementary, analogous), formality matching, silhouette balance. The model is unreliable on these without rules.
- **Style‑specific judges.** A "preppy" judge knows preppy rules; a "minimal" judge knows minimal rules. The user's preferred style picks the judge.
- **Show, don't summarize.** The user evaluates the outfit visually. Don't show the agent's reasoning in pickled prose — show the look + 1‑line reason.

---

## Why this blueprint has *more* scaffolding than the coding agent

Coding agents work because models are co‑trained on code. Fashion agents work because the harness **encodes fashion knowledge** (color rules, dress codes, body proportions, season logic) that the model wasn't trained on.

Expect this blueprint to be **medium‑to‑thick** for years to come — until a frontier model is trained on millions of stylist sessions, the rules belong in code.

---

## Reference reads

- Thick‑harness reasoning: `../architectural-decisions.md` (Decision 1)
- Visual feedback as verification: `../core/08-verification-and-termination.md` Part 5
- Outside‑sandbox for multi‑user: `../architectural-decisions.md` (Decision 2)
- Subagent pipeline pattern: `../core/06-subagents.md`
- Handoff to shopping blueprint: `03-shopping-agent.md`
