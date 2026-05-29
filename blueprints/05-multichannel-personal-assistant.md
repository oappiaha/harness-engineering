# Blueprint 05 — Multi‑Channel Personal Assistant

> **Target user:** an individual who lives across 5+ messaging / productivity apps and wants one agent to follow them everywhere — read, respond, schedule, remember, automate.

This is the **OpenClaw philosophy** instantiated as a blueprint. Where Claude Code's surface area is a single repo, the personal assistant's surface area is **the user's life across 25+ channels.**

---

## 1. Description and target user

The agent reaches the user wherever they are: WhatsApp, Telegram, Slack, Discord, iMessage, email, calendar, smart home, etc. From a single conversation, it can:
- Schedule things across multiple calendars
- Draft replies across multiple inboxes
- Remember context across channels
- Trigger automations (home, IFTTT‑style)
- Surface notifications intelligently

Users: knowledge workers, founders, creators, parents — anyone overwhelmed by app‑hopping.

---

## 2. Why this domain needs a custom harness

A raw LLM can write a great reply — but can't:
- Receive messages from WhatsApp
- Read your calendar
- Reach your front door's smart lock
- Distinguish "urgent" from "noise" across 25 sources
- Maintain identity / personality consistency across channels

The harness adds:
- **Channel adapters** (one per app)
- **Cross‑channel identity** (user is one person, not 25)
- **Intent routing** (which subagent / capability handles this?)
- **Permission gating** (smart lock = high tier; reply suggestion = low tier)
- **State per user** (long‑lived)

---

## 3. Architecture (OpenClaw‑style)

```
   Inbound channels (25+)
   ────────────────────────
   WhatsApp ─┐
   Telegram ─┤
   Slack    ─┤
   Discord  ─┤
   iMessage ─┼──▶ ┌─────────────────────┐
   Teams    ─┤    │  Gateway            │  ← WS control plane
   Matrix   ─┤    │  (normalize msgs    │     on localhost
   IRC      ─┤    │   to common envelope)│
   Email    ─┤    └──────────┬──────────┘
   SMS      ─┤               ▼
   (...)    ─┘    ┌─────────────────────┐
                  │  Conversation loop  │  ← 7‑step TAO
                  │  (per‑user state)   │
                  └──────────┬──────────┘
                             ▼
   ┌────────────────────────────────────────────────────────┐
   │                  Capability surfaces                   │
   │                                                        │
   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
   │  │ Pi Agent │  │ Browser  │  │ Calendar │  │  Home  │  │
   │  │  (RPC,   │  │  (CDP    │  │  + Email │  │  Auto‑ │  │
   │  │  sensors,│  │  browser)│  │   APIs   │  │ mation │  │
   │  │  camera, │  │          │  │          │  │ (matter│  │
   │  │  voice,  │  │          │  │          │  │  /     │  │
   │  │  screen) │  │          │  │          │  │ ifttt) │  │
   │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
   └────────────────────────────────────────────────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │  Outbound reply via │
                  │  same channel       │
                  │  (or escalate)      │
                  └─────────────────────┘
```

---

## 4. Core decisions

| Decision | Choice | Reasoning |
|---|---|---|
| **Thin vs thick** | Medium | Channel adapters need explicit logic; routing logic explicit; reply generation thin (model handles) |
| **Inside vs outside sandbox** | **Outside** | Multi‑user; per‑user OAuth tokens for every channel; sandbox idle most of the time |
| **Multi‑user** | Yes | Hosted SaaS pattern; some users self‑host (like OpenClaw on localhost) |
| **Memory** | Heavy: per‑user **profile**, **relationships** (other people in their life), **commitments**, **preferences per channel** |
| **State** | Per‑user, per‑channel context. Cross‑channel identity is the key consolidation primitive. |
| **Subagents** | Per‑capability specialists (scheduler, replier, home‑controller). Handoff pattern (channel‑facing agent → capability specialist) |
| **Verification** | Replies: draft → user confirms (in‑channel) before send. Automations: tier 3 confirmation. |
| **Framework fit** | OpenClaw if self‑hosted multichannel; otherwise OpenAI Agents SDK (clean handoffs) or AutoGen (conversation‑as‑protocol) |

---

## 5. Tool inventory

| Tool | Risk tier | Purpose |
|---|---|---|
| `channel_send(channel, recipient, text)` | 2 (was you, will be quoted) | Send a message on the user's behalf |
| `channel_draft(channel, recipient, text)` | 0 | Draft for user review |
| `channel_history(channel, query)` | 0 | Search past messages |
| `calendar_query` | 0 | Read calendar |
| `calendar_create_event` | 2 | Create event |
| `calendar_invite` | 2 | Send invite to others |
| `email_send` | 2 | Send email |
| `email_draft` | 0 | Draft for review |
| `home_status` | 0 | Read smart home state |
| `home_action(device, action)` | **3** | Actuate device (lock, lights, thermostat) — typed confirmation |
| `contacts_query` | 0 | Look up a contact's info |
| `notification_summarize` | 0 | Summarize new notifications across channels |
| `memory_remember(fact)` | 1 | Add to long‑term memory (with confirmation) |
| `memory_recall(query)` | 0 | Recall a fact |
| `task_create / task_update` | 1 | User's task list |

Special category: **observation tools** (Pi Agent, OpenClaw‑style):
- `camera_snapshot` — only on explicit user request
- `screen_describe` — describe what's on user's screen
- `voice_listen` — voice in
- `location_lookup` — current location

These are tier 3+ by default — they're real sensors with real privacy implications.

---

## 6. State files (per user)

```
users/<user_id>/
├── profile.md
│   # Name, pronouns, role, communication style
│   # "Don't reply on Slack after 7pm" type rules
├── relationships.md
│   # People they interact with often: name, relationship, channel, prefs
├── commitments.md
│   # Outstanding commitments: "promised Sarah a draft by Friday"
│   # Auto‑surfaced as reminders
├── channels/
│   ├── whatsapp.md      # channel‑specific prefs, signatures, etc.
│   ├── slack.md         # workspace memberships, default channels
│   └── ... (per channel)
├── automations.json
│   # Pre‑approved automations (e.g., "Mon 7am: brief me on calendar + weather")
├── memory_index.md      # tier‑1 lightweight memory index
└── memory_files/        # tier‑2 detailed memory by topic
    ├── work.md
    ├── family.md
    └── travel.md
```

---

## 7. Subagent topology

| Pattern | When |
|---|---|
| **Channel adapter agent** | Per inbound channel (handles normalization, identity binding) |
| **Intent router** | Main loop classifies: is this a reply? schedule? automation? memory? |
| **Specialist handoff** | Scheduler / replier / home‑controller take over for their domain |
| **Notification triager** | Background, fan‑out across channels → consolidated brief |
| **Memory writer** | Periodic, ingests recent activity → distills facts to long‑term memory |
| **Independent judge** | For high‑stakes replies (work email to boss), separate agent scores draft against user's style |

The **identity consolidation** is critical: one user means one set of memory + one set of preferences, even if they're talking to the agent from 5 different channels.

---

## 8. Verification strategy

Different verification per tier:

| Tier | Action | Verification |
|---|---|---|
| 0 (read) | Search past messages | Auto |
| 1 (mutate own state) | Add a memory entry | Surface confirmation; user can undo |
| 2 (send a message) | Reply on user's behalf | **Draft + user confirms** (in‑channel: "Send this?") |
| 3 (real‑world action) | Unlock door, turn off lights | **Typed confirmation**; daily/per‑device cap |
| 4 (financial / irreversible) | Send a payment, RSVP yes to expensive event | Typed confirmation + cooldown |

The dominant verification surface is **the user themselves, in‑channel.** The agent drafts; the user approves with a tap or a reply.

For automations (pre‑approved rules), verification happens **at automation creation time**, not on every fire. "Every Monday morning, brief me" is approved once; subsequent fires are autonomous.

---

## 9. Build steps

1. **Pick channels carefully.** Start with 2–3 highest‑value (often: iMessage / Slack / email). Don't try 25 channels in v1.
2. **Build the channel envelope.** Normalize: `{channel, user_external_id, recipient, body, timestamp, attachments}`. All channels feed the same loop.
3. **Build identity consolidation.** One internal user can have many `(channel, external_id)` pairs.
4. **Build the intent router.** Main loop classifies inbound: reply / schedule / automation / memory / observe.
5. **Build per‑specialist agents.** Start with replier + scheduler. Add others as users ask.
6. **Wire OAuth per channel.** Tokens live with the loop (outside sandbox).
7. **Build memory tiers.** Index always loaded; topic files on demand; raw search.
8. **Build automation creation flow.** User creates rule via natural language; agent confirms it as YAML; user approves; saved.
9. **Build the in‑channel confirmation UX.** "I'm about to reply to Sarah with: '...'. Send? (y/n)"
10. **Build the daily brief.** Triage notifications across channels; surface what matters; everything else stays in inbox.

---

## 10. Failure modes specific to multichannel assistants

| Failure | Counter |
|---|---|
| Wrong identity binding (treats two users as one) | Strict per‑channel external_id mapping; verification at first contact |
| Reply sent to wrong recipient | Send tool always shows full target in confirmation |
| Tone mismatch (formal to friend, casual to boss) | Per‑relationship style in `relationships.md`; agent reads before drafting |
| Cross‑channel leak (Slack work topic leaks to family chat) | Per‑channel context isolation by default; user explicitly allows cross‑channel |
| Smart home action while user away (false trigger) | Geofence check; tier‑3 confirmation; daily cap |
| Auto‑reply when user wanted silence | "Quiet hours" in profile; respected by default |
| Hallucinated commitment ("I promised to do X" — agent made it up) | Memory writes require explicit user confirmation or source citation |
| Memory drift (old facts wrong but still applied) | Memory entries have expiry; verification before applying |
| Prompt injection from a malicious message | Untrusted input filtering; tool calls require explicit user intent, not "extracted" from arbitrary text |
| OAuth token leak | Tokens live with loop, never in sandbox / never in prompt |
| One channel adapter crashes, kills agent | Per‑adapter isolation; circuit breakers; user reachable on other channels |
| Notification fatigue from agent's own messages | Agent‑initiated messages rate‑limited; user can mute the agent per channel |

---

## Critical: the privacy and consent surface

This blueprint touches the most sensitive data in the user's life. Mitigations:

- **Default deny:** any new channel / capability / sensor is off until explicitly enabled.
- **Per‑capability consent:** "Allow agent to read iMessage?" is a separate consent from "Allow agent to send iMessage?"
- **Audit trail:** every action the agent took, queryable by user, exportable, deletable.
- **Right to forget:** user can wipe per‑channel memory or all memory; agent loses that context cleanly.
- **No third‑party model leakage:** sensitive memory entries flagged; not included in prompts to providers without consent.

These aren't optional. A multichannel assistant without these isn't shippable.

---

## How this differs from a coding agent

| Aspect | Coding agent | Multichannel assistant |
|---|---|---|
| Surface | One repo | 25+ external services |
| State | Filesystem + git | Per‑user DB; per‑channel context |
| Verification | `make check` returns 0 | User confirms in‑channel |
| Memory | Project‑local | Per‑user, long‑lived, sensitive |
| Risk | Code break (recoverable) | Privacy leak / wrong recipient / unlock door (often irreversible) |
| Co‑training | Strong | Weak — domain isn't well covered |
| Architecture | Inside sandbox, single user | Outside sandbox, multi‑user, multi‑channel |

The blueprints share patterns (loop, hooks, subagents, observability) but diverge sharply on tenancy, risk, and verification.

---

## Reference reads

- OpenClaw philosophy + diagram: `../framework-comparison.md`
- Outside‑sandbox architecture: `../architectural-decisions.md` (Decision 2)
- Permission tiers: `../core/09-error-handling-and-guardrails.md`
- Memory hierarchy: `../core/04-context-and-memory.md`
- Long‑lived per‑user state: `../core/07-state-and-persistence.md`
