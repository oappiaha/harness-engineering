# Blueprint 03 — Agentic Shopping

> **Target user:** a consumer (or business buyer) who wants an agent to research products, compare options, and purchase on their behalf — within constraints they set.

Shopping is **higher stakes per action** than research: a wrong recommendation is bad; a wrong purchase is worse. The harness must reflect this asymmetry.

---

## 1. Description and target user

A shopping agent takes a need ("find me a 27‑inch 4K monitor under $600 with USB‑C") and:
- Browses catalogs (multiple retailers)
- Compares specs and prices
- Applies user preferences and constraints (budget, style, ethics)
- Optionally completes purchase
- Tracks order, manages returns

Users: consumers, household ops, small business procurement.

---

## 2. Why this domain needs a custom harness

A raw LLM can describe a great monitor — but can't:
- Check live prices (which change)
- Navigate retailer‑specific cart UX
- Hold the user's payment + shipping details safely
- Track a real order
- Distinguish "this is a good purchase" from "I generated a plausible‑sounding answer"

Plus, **money + identity + irreversibility** all live in tier 3–4 risk. The permission model is the most important component.

---

## 3. Architecture

```
                       ┌───────────────────────────┐
   "Find me X" ──────▶ │   Intent normalizer       │
                       │  (need + budget + prefs + │
                       │   blockers)               │
                       └─────────────┬─────────────┘
                                     ▼
                       ┌───────────────────────────┐
                       │   Discovery agent         │
                       │  (catalog browsing)       │
                       └─────────────┬─────────────┘
        ┌───────────────┬────────────┴────────┬───────────────┐
        ▼               ▼                     ▼               ▼
   ┌─────────┐    ┌─────────┐          ┌─────────┐      ┌─────────┐
   │Retailer │    │Retailer │          │Retailer │      │Retailer │
   │   A     │    │   B     │          │   C     │      │   N     │
   └────┬────┘    └────┬────┘          └────┬────┘      └────┬────┘
        │              │                    │                │
        └──────────────┴────────────────────┴────────────────┘
                                  │
                                  ▼  candidates (10–20)
                       ┌───────────────────────────┐
                       │   Compare & score         │  ← against user prefs
                       └─────────────┬─────────────┘
                                     ▼  top 3
                       ┌───────────────────────────┐
                       │   User review             │  ← human gate (ALWAYS)
                       └─────────────┬─────────────┘
                                     ▼  approved
                       ┌───────────────────────────┐
                       │   Purchase executor       │  ← tier‑3+ confirmation
                       │  (cart, checkout, pay)    │
                       └─────────────┬─────────────┘
                                     ▼
                       ┌───────────────────────────┐
                       │   Order tracker           │  ← long‑lived; durable exec
                       └───────────────────────────┘
```

---

## 4. Core decisions

| Decision | Choice | Reasoning |
|---|---|---|
| **Thin vs thick** | Medium‑thick | Catalog navigation per retailer is custom enough to warrant structured tools; thin loop on top |
| **Inside vs outside sandbox** | **Outside** | Payment / OAuth tokens / shipping address MUST stay with the loop, never in sandbox |
| **Multi‑user** | Yes — always | Hosted SaaS pattern |
| **Memory** | Per‑user **preference profile** + **purchase history**; per‑session research scratch |
| **State** | Per‑purchase job with state machine (intent → discovery → review → purchase → tracking → complete) |
| **Subagents** | Fan‑out across retailers; pipeline for compare + score; judge for "is this the right purchase?" |
| **Verification** | **Hard human gate** before any purchase. Soft verification of recommendation quality. |
| **Permission model** | Tier 3+ on all purchases. Typed confirmation for spend > $X. Spending caps per session / day / month |
| **Framework fit** | OpenAI Agents SDK (typed handoffs help), or LangGraph (auditable transitions matter for refunds / disputes) |

---

## 5. Tool inventory

Domain tools:

| Tool | Risk tier | Purpose |
|---|---|---|
| `catalog_search` | 0 | Search a retailer (per‑retailer adapter) |
| `product_detail` | 0 | Fetch a product's full spec + price + reviews |
| `compare_products` | 0 | Side‑by‑side from candidate list |
| `cart_add` | 1 | Add to user's cart on retailer X |
| `cart_view` | 0 | Read current cart |
| `cart_remove` | 1 | Remove item |
| `checkout_quote` | 1 | Get price quote with shipping + tax (no purchase) |
| `checkout_execute` | **3** | Actually charges card — requires user confirmation |
| `order_track` | 0 | Pull order status |
| `initiate_return` | 2 | Start return flow |
| `cancel_order` | 2 | Cancel before ship |
| `preference_read` | 0 | Read user's preferences |
| `preference_write` | 1 | Update user's preferences (with confirmation) |

Plus standard web search / fetch for product research outside catalogs.

**Critical:** `checkout_execute` is the one tool you treat as **irreversible** (tier 3+). Wire it through:
- Typed user confirmation
- Spending cap check (session / day / month)
- Idempotency key (no double charges)
- Order ID returned and persisted before tool returns

---

## 6. State files

Per‑user (long‑lived):
```
users/<user_id>/
├── profile.md
│     # Style preferences, sizes, dietary restrictions, brand preferences
│     # Ethical filters (sustainable, fair trade, etc.)
├── budget.md
│     # Monthly cap, category caps, "no purchase without approval over $X"
├── shipping.md
│     # Default address; secondary addresses
├── payment.md             # Tokenized references only; never raw card data
├── purchase_history.json  # Past purchases + outcomes (returned? loved? regretted?)
└── blocked.md             # Retailers / brands they refuse
```

Per‑job:
```
purchases/<job_id>/
├── intent.md              # Normalized need
├── candidates.json        # Top N with scores
├── chosen.json            # Final pick + reasons
├── confirmation.json      # User's typed approval
├── order.json             # Retailer order ID, ship date, etc.
└── outcome.md             # Did user like it? (filled in 2–4 weeks later)
```

---

## 7. Subagent topology

| Pattern | When |
|---|---|
| **Fan‑out per retailer** | Discovery — parallel searches across catalogs |
| **Pipeline: spec → review → social proof** | Per‑candidate deep dive |
| **Compare & score** | Synthesizer sub‑agent that ranks against user prefs |
| **Judge: "is this the right purchase?"** | Independent evaluator before user review |
| **Customer‑service agent** | Returns / disputes (different harness, often handoff) |

Notable: do not subagent the **purchase executor.** Keep payment in one agent, one transaction, traceable.

---

## 8. Verification strategy

Two halves:

### A. Pre‑purchase verification (soft)

- Candidate satisfies hard constraints (budget, blocked list, must‑have features)
- Score against user profile ≥ threshold
- Judge rubric: fit, price, reviews quality, retailer trust → if any D, re‑rank

### B. Purchase verification (hard)

- **Human confirmation required.** No exceptions for tier 3+ actions.
- For tier 4 (above spending cap): typed acknowledgment.
- Pre‑purchase: order quote shown with shipping + tax breakdown.
- Post‑purchase: order ID stored before tool returns success.
- **Idempotency:** if the same purchase intent is replayed (retry, crash recovery), the same idempotency key prevents double charge.

### Post‑purchase verification (long‑tail)

- Order tracking (durable execution; spans days).
- Outcome capture: 2–4 weeks after delivery, ask user "did this work out?" Feedback feeds preferences memory.

---

## 9. Build steps

1. **Risk tier the tools first.** Before any code, write the risk tier matrix. Especially `checkout_execute` = 3+.
2. **Lock the permission flow.** Typed confirmation, spending caps, idempotency keys, daily/monthly limits.
3. **Define `intent`** schema (need + budget + prefs + blockers).
4. **Build per‑retailer adapters.** Even if just web scraping initially, define a stable `catalog_search` interface.
5. **Build candidate ranking.** Score against user profile; explainable score (not opaque).
6. **Build the human review surface.** This is product, not just engineering — the user sees top 3 with reasoning.
7. **Build `checkout_execute`** with idempotency + cap checks + audit logging.
8. **Build order tracker.** Durable execution required (orders span days).
9. **Build outcome capture loop.** 2–4 weeks post‑delivery, prompt user; feed into preferences.
10. **Wire safety net.** Daily / monthly spend dashboard; pause button; "did this agent buy something I didn't approve?" alert.

---

## 10. Failure modes specific to shopping

| Failure | Counter |
|---|---|
| Double charge (network blip on `checkout_execute`) | Idempotency key per intent; safe to retry |
| Wrong item delivered (agent misread spec) | Spec verification step before checkout; show user "this exact SKU" |
| Cap circumvention (split purchase across retailers) | Aggregate spend per intent, not per tool call |
| Price changed between quote and execute | Re‑quote at execute time; reject if delta > X% |
| Stockout between recommendation and purchase | Check stock at execute time; surface to user |
| Shipping to wrong address | Default + per‑order address override; user confirms address pre‑purchase |
| Stale preferences (user changed taste) | Outcome capture; periodic preference re‑review |
| Prompt injection from product reviews | Sandbox fetch; review text treated as untrusted; agent doesn't take instructions from reviews |
| Retailer adapter drift (HTML changed) | Per‑retailer test suite run on schedule; alert on adapter failure |
| Brand bias in recommendations (only Amazon) | Source diversity metric; user can pin retailers |
| Hallucinated coupons / promo codes | Only apply codes from verified retailer endpoints, never agent‑generated |
| "Helpful" upsells beyond intent | Strict scope: discovery returns only candidates matching intent; no add‑ons added to cart without explicit ask |
| Refund / return mid‑flight | Customer‑service agent has separate harness; handoff explicit |

---

## Critical: payment data handling

This is the difference between a viable shopping agent and a liability.

- **No raw card data** in agent context. Use tokenized payment methods (Stripe Payment Methods, etc.).
- **Loop holds payment token reference** (Mendral pattern); sandbox / model never sees the token directly.
- **Audit log every checkout_execute call** with order ID, amount, retailer, timestamp.
- **User must be able to query "what did the agent buy"** at any time, including failed attempts.
- **PCI scope** stays on the payment processor — never on the harness.

---

## Reference reads

- Permission model + risk tiers: `../core/09-error-handling-and-guardrails.md`
- Outside‑sandbox architecture (credentials with loop): `../architectural-decisions.md` (Decision 2)
- Subagents for discovery: `../core/06-subagents.md`
- Long‑horizon state (order tracking): `../core/07-state-and-persistence.md`
- Verification + human gates: `../core/08-verification-and-termination.md`
