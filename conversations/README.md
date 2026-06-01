# Conversations — Walkthrough Track

A companion to the reference docs (`core/`, `blueprints/`, etc.). The reference docs are dense and comprehensive — built for *looking things up*. These walkthroughs are progressive and conversational — built for *learning the field*.

If you've never built a harness, **start here.** Read in order; each one builds on the previous. Then go to `../core/` once you need depth.

---

## The track

| # | Title | What you'll learn | Builds on |
|---|---|---|---|
| 01 | Vocabulary | What a harness, agent, and model are — and why the distinction is load‑bearing | nothing |
| 02 | The loop | The 7‑step cycle, the wrapper question, why one user message triggers many model calls | 01 |
| 03 | The seven decisions | The architectural bets every harness faces (Akshay's diagram, fully explained) | 01, 02 |
| 04 | Shopping deep dive | A worked example: why a shopping agent breaks every assumption from coding agents | 01–03 |
| 05 | Where sources disagree | The three big debates and which dissolve into "specify your scope" | 01–04 |
| 06 | Pi and the thesis | Does specialization just mean "more tools"? Why the *gap type* decides, not the harness | 01–05 |

For uncertainties and where this folder might age badly, see `../uncertainties-and-futures.md` (it's a reference doc rather than a walkthrough because it serves as a corrective lens you'd want to re‑consult).

---

## How these are different from the reference docs

| | Walkthroughs | Reference docs |
|---|---|---|
| **Order** | Sequential — builds | Random‑access — lookup |
| **Tone** | Conversational | Prescriptive |
| **Depth** | Just enough | Exhaustive |
| **Code** | Worked examples | Skeletons + patterns |
| **Length** | 100–300 lines each | 200–500 lines each |
| **Audience** | Someone *learning* harness engineering | Someone *building* one |
| **When to read** | Start of a project | During a project |

---

## After the walkthroughs

Once you've read 01–05, the rest of the folder makes a lot more sense:

- `../core/` — depth on each component
- `../blueprints/` — domain‑specific applications
- `../architectural-decisions.md` — the seven decisions as a reference (with the decision tree)
- `../framework-comparison.md` — which SDK to use
- `../anti-patterns.md` — what goes wrong
- `../source-synthesis.md` — where the five sources agree / disagree
- `../uncertainties-and-futures.md` — what's still open
- `../sources/source-notes.md` — primary‑source notes
