# Chat Bot Feasibility Plan: Map Guessing Game

**Date:** April 2026
**Author:** Technical Assessment for Martin
**Scope:** Telegram, WhatsApp (Cloud API), Facebook Messenger

---

## Codebase Context

Before diving into platforms, here's what we're working with:

| Concern | Detail |
|---|---|
| Backend | Python FastAPI on Railway |
| Database | SQLite via SQLAlchemy |
| Guess matching | OpenAI `text-embedding-3-small` + `rapidfuzz` fuzzy + optional GPT-4o-mini LLM fallback |
| Images | S3 at `puzzles/images/YYYY-MM-DD.(png\|jpg\|gif\|webp)` |
| Game state | `DailyGameState` + `UserAttempt` tables keyed on `(user_id, puzzle_date)` |
| Player identity | UUID stored in localStorage / `X-Player-ID` header |
| Hints | Each hint costs 1 guess; up to N progressive hints per puzzle |
| Max guesses | Configurable, default 5–6 |
| Existing API | Clean REST API already exists — bots can reuse it directly |

The existing backend is **already bot-friendly**: every game action is a REST call, player identity is just a UUID string, and the similarity logic is fully server-side. Bots don't need to reimplement anything — they're thin clients.

---

## Platform 1: Telegram Bot

### Technical Feasibility

**Images:** Full support. `sendPhoto` accepts a URL or binary upload. S3 image URLs can be sent directly — Telegram will download and display them. No special permissions needed.

**Text guesses:** Native — users reply to any message with text. No friction whatsoever.

**Progressive hints:** Telegram supports inline keyboards (buttons) so a "Get Hint 💡" button can be added to every message. Hints can be sent as follow-up messages in the same thread.

**Game state per user:** Telegram's `chat_id` (a stable integer) maps cleanly to a player UUID. Store `{telegram_chat_id → player_uuid}` in a small table or SQLite dict.

**Rate limits:**
- 30 messages/second globally
- 1 message/second per individual chat
- For daily push (sending puzzle to all subscribers): must be rate-throttled. For 1,000 subscribers → ~17 minutes to send all at 1/sec. Acceptable with queuing.
- No daily message caps for bots.

**Cost:** Telegram Bot API is **completely free**. No paid tiers, no per-message cost. Only cost is server compute.

**Webhooks vs polling:** Both work. Webhooks are better for production (Railway already has HTTPS). Polling is fine for development.

---

### Architecture

```
Telegram Bot API (webhook)
        │
        ▼
  Bot Handler Service (Python)
  ├── python-telegram-bot or aiogram library
  ├── Calls existing FastAPI endpoints internally
  │   (or imports service functions directly if co-located)
  ├── Manages telegram_user → player_uuid mapping
  └── Subscription list (SQLite table)
        │
        ▼
  Existing FastAPI backend
  ├── /api/puzzle (get today's puzzle + S3 image URL)
  ├── /api/puzzle/{id}/guess (submit guess)
  ├── /api/puzzle/{id}/hint (get next hint)
  └── OpenAI embedding calls happen here (no change needed)
```

**Deployment:** Run the bot handler as a second process on the same Railway service, or as a separate Railway service. Given Railway's $5/month hobby plan per service, a single service running both FastAPI and the bot worker via a process manager (supervisord / `&&`) is simplest for MVP.

**Daily push:** A cron job (Railway cron or APScheduler inside the process) fires at puzzle-reset time (midnight EST), fetches today's puzzle, and sends it to all subscribers.

---

### User Experience Flow

```
User: /start
Bot:  Welcome! Every day I'll send you a new map puzzle.
      Type /play to get today's puzzle, or wait for tomorrow's!

User: /play
Bot:  [Map image]
      🗺 Where in the world is this?
      You have 6 guesses. Type your answer below!
      [Get Hint 💡] [Skip ⏭]

User: Paris
Bot:  🌡 Similarity: 61% — getting warmer!
      5 guesses remaining.
      [Get Hint 💡]

User: [taps Get Hint 💡]
Bot:  💡 Hint 1: This city is the capital of a Western European country.
      (Hint used 1 guess — 4 remaining)

User: London
Bot:  🌡 Similarity: 78% — close!
      4 guesses remaining.

User: Amsterdam
Bot:  ✅ Correct! The answer is Amsterdam.
      🎉 Solved in 3 guesses!

      📊 Your result:
      🟩⬜⬜🟪⬜⬜

      Share your result → [Share Button]
```

**Inline keyboards** make hint requests, sharing, and navigation seamless without requiring the user to type commands.

**Group chat support:** Works natively. The bot tracks game state per `(chat_id, date)` — group chats get a shared game state (whole group plays together), which is actually a fun mechanic.

---

### Platform-Specific Gotchas

- **Bot must be added to group with admin rights to read messages** unless users reply directly to bot messages (which always works).
- **Message formatting:** Use Markdown V2 for rich text, but the escaping is annoying. HTML parse mode is easier.
- **Photo compression:** Telegram compresses photos > 5MB. Since map puzzles are likely under 5MB, this is fine. If needed, send as `sendDocument` instead to preserve quality.
- **Conversation state machine:** Need to track whether a user is mid-game or idle. A simple `user_state` dict or Redis key suffices.
- **Inline share:** Telegram's share mechanism opens the forward dialog. A pre-formatted text block (like Wordle's emoji grid) is the best shareable format.
- **Bot discovery:** Telegram has a bot store / search. Can also generate deep links (`t.me/YourBot?start=play`) for web referral traffic.

---

### Estimated Effort

| Task | Effort |
|---|---|
| Bot scaffolding (aiogram + webhook setup) | 0.5 days |
| User → player UUID mapping | 0.5 days |
| Game flow (puzzle send, guess handling, hints) | 1 day |
| Subscription system + daily push cron | 1 day |
| Emoji result grid (shareable output) | 0.5 days |
| Railway deployment + environment config | 0.5 days |
| **Total MVP** | **~4 days** |

---

---

## Platform 2: WhatsApp Bot (Cloud API)

### Technical Feasibility

**Images:** Supported via the `image` message type. You upload the image to Meta's media API first (or send a URL), then send a message referencing the `media_id`. The S3 URL must be publicly accessible (it is) or pre-signed. Meta downloads it and re-hosts it.

**Text guesses:** Supported. Users reply with text naturally. However, WhatsApp has no concept of "commands" — users just type freeform text, so the bot must parse intent from natural language (e.g., "get hint" vs. "Paris").

**Progressive hints:** WhatsApp supports **interactive messages** with buttons (up to 3 buttons) or list menus. A "Get Hint" button can be surfaced. After 3 buttons are used up, you fall back to text instructions ("Reply HINT for a hint").

**Game state per user:** WhatsApp phone numbers are stable identifiers. Map `wa_phone_number → player_uuid`.

**Rate limits:**
- **1,000 unique conversations/day** on the free tier of Cloud API
- Each conversation is a 24-hour window
- Business-initiated messages (you sending first) cost money per message template
- User-initiated messages are free within the 24-hour window
- Sending the daily puzzle proactively requires a **pre-approved message template**

**Cost:**
- Meta Cloud API: Free for the first 1,000 service conversations/month
- After that: ~$0.01–$0.06 per conversation (varies by country)
- Business-initiated template messages: ~$0.005–$0.08 per message
- At 1,000 users: ~$10–$80/month for daily pushes (varies heavily by user geography)
- Requires a **Meta Business Account** (free to create, but involves a verification process)

**Webhook:** Required. Must verify with a `hub.verify_token` challenge on setup.

---

### Architecture

```
WhatsApp Cloud API (webhook from Meta)
        │
        ▼
  Bot Handler Service (Python)
  ├── httpx calls to graph.facebook.com/v18.0/
  ├── Message template management
  ├── Media upload to Meta CDN (one-time per puzzle image)
  ├── 24-hour window tracking per user
  └── Phone number → player UUID mapping
        │
        ▼
  Existing FastAPI backend (reused as-is)
```

**Critical design decision:** The daily puzzle push requires a **pre-approved message template** in Meta's system. Templates are plain text with variable slots (no images in template body for free tier — you can attach a header image). The template must be approved by Meta (typically 1–24 hours). This is the biggest friction point.

**Media caching:** Once a puzzle image is uploaded to Meta's media API, cache the `media_id` for the day to avoid re-uploading for every subscriber.

---

### User Experience Flow

**Opt-in (required by WhatsApp policy):**
```
User finds bot via QR code / link
User sends: "Hi" or "START"
Bot: Welcome to Map Guessing! 🗺
     Every day I'll send you a new map puzzle to solve.
     Reply YES to subscribe to daily puzzles, or PLAY to try today's now.
```

**Daily push (requires approved template):**
```
Bot → User: [Template: "Your daily map puzzle is ready! Reply PLAY to start."]
```

**Gameplay (within 24-hour window after user messages first):**
```
User: PLAY
Bot:  [Map image]
      🗺 Where in the world is this?
      You have 6 guesses!
      Reply with your guess, or type HINT for a hint.

User: Paris
Bot:  🌡 61% similarity — you're getting warmer!
      5 guesses remaining. Type your next guess or HINT.

User: HINT
Bot:  💡 Hint: This city is the capital of a Western European country.
      (Costs 1 guess — 4 remaining)

User: Amsterdam
Bot:  ✅ Correct! The answer is Amsterdam.
      Solved in 3 guesses! 🎉

      Share your result:
      🗺 Map Guessing — Apr 7
      🟩⬜⬜🟪⬜⬜
      mapguessing.app
```

**The 24-hour window problem:** If a user doesn't message the bot that day, and the free window expires, the bot can only send them the pre-approved template again (which costs money). This creates a degraded experience for casual users.

---

### Platform-Specific Gotchas

- **Template approval is mandatory for proactive messages.** Templates must be approved by Meta before use. Any change requires re-approval. This significantly limits UX iteration speed.
- **No markdown:** WhatsApp supports `*bold*` and `_italic_` only. No tables, no code blocks.
- **Button limit:** Interactive messages support max 3 buttons. For a game with multiple actions, this requires careful UX design.
- **Business account verification:** For high-volume messaging (>1,000 conversations/day), a business verification is required. For MVP scale, unverified works.
- **No group game:** WhatsApp bots cannot read group messages (they receive webhooks only for direct messages unless added as a participant, which isn't available for Cloud API).
- **Opt-in is strictly required:** WhatsApp policy requires explicit user opt-in before the business can message them. This is law in many countries, not just policy.
- **Phone number tied to a business:** You need a dedicated phone number for the WhatsApp Business API — can't use your personal number.
- **24-hour session expiry:** Every day you need users to re-initiate or pay for template messages. This creates friction for daily engagement.

---

### Estimated Effort

| Task | Effort |
|---|---|
| Meta Business account setup + phone number | 1 day (process, not coding) |
| Message template creation + approval wait | 0.5 days (+ wait time) |
| Webhook handler + signature verification | 0.5 days |
| Media upload + caching to Meta CDN | 0.5 days |
| Game flow (text-based, no buttons) | 1 day |
| Template-based daily push + opt-in flow | 1.5 days |
| Phone number → player UUID mapping | 0.5 days |
| **Total MVP** | **~5.5 days + 1–3 days admin overhead** |

The admin overhead (Meta account setup, template approval, phone number provisioning) is real and annoying. Not technically hard, just slow.

---

---

## Platform 3: Facebook Messenger Bot

### Technical Feasibility

**Images:** Fully supported via the `attachment` message type with `type: "image"` and a URL payload. S3 URLs work directly. Rich template messages also exist (generic template with image, title, buttons).

**Text guesses:** Natural text messaging — users type, bot responds. No friction.

**Progressive hints:** Messenger supports **quick replies** (up to 13 options shown as chips) and **buttons** (up to 3 per message). Quick replies disappear after tap, making them good for "Get Hint" or "Play Again" actions.

**Game state per user:** Messenger uses a stable `sender.id` (PSID — Page Scoped ID). Map `psid → player_uuid`.

**Rate limits:**
- 200 messages/second to all users
- No per-user rate limits documented (but Meta may throttle aggressively)
- **Recurring Notifications API** (for daily push): 10 sends/user/month on standard access, unlimited on advanced access (requires review)

**Cost:** Messenger Platform API is **free**. No per-message cost for standard messaging. Costs arise only from paid promotions.

**Webhook:** Required. Same Meta webhook infrastructure as WhatsApp.

---

### Architecture

```
Facebook Messenger (webhook)
        │
        ▼
  Bot Handler Service (Python)
  ├── facebook-sdk / direct Graph API calls
  ├── PSID → player UUID mapping
  ├── Recurring Notification token management (opt-in for daily push)
  └── Page access token management
        │
        ▼
  Existing FastAPI backend (reused as-is)
```

**Deployment:** Same service as Telegram/WhatsApp handlers — all three bots can be routes in the same Python service.

---

### User Experience Flow

```
User: [clicks "Get Started" button on bot page]
Bot:  🗺 Welcome to Map Guessing!
      Every day I'll post a new mystery map. Can you identify where it is?

      [Play Today's Puzzle] [Subscribe to Daily Puzzles]

User: [taps Play Today's Puzzle]
Bot:  [Image of map]
      🗺 Where in the world is this?
      You have 6 guesses!
      [Get Hint 💡]    [Give Up 🏳]

User: Paris
Bot:  🌡 61% similarity — warmer!
      5 guesses left.
      [Get Hint 💡]

User: [taps Get Hint]
Bot:  💡 Hint 1: Capital of a Western European country.
      (−1 guess: 4 remaining)
      [Get Hint 💡]

User: Amsterdam
Bot:  ✅ Amsterdam! Correct in 3 guesses!

      🗺 Map Guessing — Apr 7
      🟩⬜⬜🟪⬜⬜

      [Share Result] [Play Yesterday's] [Subscribe 🔔]
```

**Subscribe to daily puzzles** uses the **Recurring Notifications API** — user opts in via a special button, and the bot can send them one notification per day (or per frequency they chose: daily/weekly).

---

### Platform-Specific Gotchas

- **App review is required for production.** While testing works with up to 25 whitelisted testers, going live requires Meta App Review (typically 1–5 business days). You must demonstrate your use case. Map guessing is benign so approval is likely, but the wait is real.
- **Page required:** The bot must be attached to a Facebook Page, not a personal profile. Creating a page is free.
- **Message tags for proactive messages:** Outside the 24-hour window, you can only send messages with approved tags (`CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE`) or use Recurring Notifications. The daily puzzle notification requires users to opt into Recurring Notifications explicitly — you can't just push to them.
- **Recurring Notifications rate cap:** Standard tier allows 10 messages/user/month (about one every 3 days). For a daily game, you need **Advanced Access**, which requires App Review approval and a compelling reason. This is a significant blocker for daily push to casual users.
- **No markdown:** Similar to WhatsApp — plain text only. Line breaks work. No bullet formatting.
- **Demographics:** Messenger user base skews older (35+) compared to Telegram. Strong reach in Philippines, Southeast Asia, US.
- **Quick replies disappear after use** — good for one-off actions, not persistent navigation.
- **Handover protocol:** If you also have a human support inbox on your Page, you need to handle the handover protocol to avoid conflicts.

---

### Estimated Effort

| Task | Effort |
|---|---|
| Facebook Page + App setup + webhook | 1 day |
| App review (wait time, not coding) | 1–5 days |
| Webhook handler + message dispatch | 0.5 days |
| Game flow + quick replies/buttons | 1.5 days |
| Recurring Notifications opt-in flow | 1 day |
| PSID → player UUID mapping | 0.5 days |
| **Total MVP** | **~4.5 days + 1–5 days review wait** |

---

---

## Shared Infrastructure

All three bots share the same backend logic. Here's what gets built once:

### Bot Service (new)

```
/bot-service/
├── main.py                  # FastAPI app with webhook endpoints
├── platforms/
│   ├── telegram.py          # Telegram webhook handler + send functions
│   ├── whatsapp.py          # WhatsApp webhook handler + send functions
│   └── messenger.py         # Messenger webhook handler + send functions
├── game.py                  # Shared game logic (calls existing API)
├── db.py                    # platform_user → player_uuid mapping table
├── scheduler.py             # Daily puzzle push cron (APScheduler)
└── formatters.py            # Shared emoji grid, score display helpers
```

### Shared components built once:
| Component | Used By |
|---|---|
| `platform_user` → `player_uuid` mapping table | All 3 |
| REST client for existing FastAPI backend | All 3 |
| Emoji result grid formatter (🟩⬜🟪) | All 3 |
| Similarity score → human-readable message | All 3 |
| Daily puzzle push scheduler | All 3 |
| Subscription/unsubscribe management | All 3 |

### What each platform adds:
- Its own webhook verification logic
- Its own message send functions (different API, different auth)
- Its own button/quick-reply UX (Telegram inline keyboards vs WA buttons vs Messenger quick replies)
- Its own media handling quirks

### Database additions needed

```sql
-- New table for bot users
CREATE TABLE bot_users (
    id INTEGER PRIMARY KEY,
    platform TEXT NOT NULL,          -- 'telegram', 'whatsapp', 'messenger'
    platform_user_id TEXT NOT NULL,  -- chat_id, phone, PSID
    player_uuid TEXT NOT NULL,       -- maps to existing user_id
    subscribed BOOLEAN DEFAULT TRUE,
    subscribed_at DATETIME,
    UNIQUE(platform, platform_user_id)
);
```

The existing `DailyGameState` and `UserAttempt` tables work **unchanged** — bots just use a generated `player_uuid` as the `user_id`.

### OpenAI embedding calls

No changes needed. Bots call `POST /api/puzzle/{id}/guess` which already triggers the embedding comparison server-side. The ~100ms latency for an embedding call is invisible in a chat context (users expect a second or two of response time).

---

## Comparative Summary

| Criteria | Telegram | WhatsApp | Messenger |
|---|---|---|---|
| **Image support** | ✅ Direct URL | ✅ Via media upload | ✅ Direct URL |
| **Natural text guesses** | ✅ Native | ✅ Native | ✅ Native |
| **Progressive hints (buttons)** | ✅ Inline keyboard | ⚠️ 3 buttons max | ✅ Quick replies (13) |
| **Game state tracking** | ✅ chat_id stable | ✅ phone stable | ✅ PSID stable |
| **Daily push to subscribers** | ✅ Free, unlimited | ⚠️ Costs money + template | ⚠️ Recurring Notifications (10/mo standard) |
| **API cost** | 🆓 Free | 💰 ~$10–80/mo at 1k users | 🆓 Free |
| **Setup complexity** | ✅ Low (BotFather) | ⚠️ Medium (Meta Business) | ⚠️ Medium (App Review) |
| **Time to first working bot** | 1 hour | 1–2 days | 1–2 days |
| **Group chat support** | ✅ Yes | ❌ No | ❌ Not for bots |
| **App review required** | ❌ No | ✅ Yes (business verify) | ✅ Yes (app review) |
| **User base (global)** | 950M users | 2B+ users | 1B+ users |
| **User base quality for games** | ⭐⭐⭐ Tech-savvy, engaged | ⭐⭐ Messaging-first, less game-oriented | ⭐⭐ Older demo |
| **MVP effort (coding)** | 4 days | 5.5 days | 4.5 days |
| **MVP effort (total with setup)** | 4 days | 7–8 days | 6–10 days |

---

## Recommendation

### Build Telegram First

**Telegram is the clear winner for the MVP.**

**Why:**
1. **Zero friction to start:** Register with BotFather, get a token, start coding. No business accounts, no template approval, no app review. You can have a working bot in an afternoon.
2. **Free at any scale:** No per-message cost ever. WhatsApp will charge ~$50–80/month at 1,000 users sending daily. Telegram is $0.
3. **Best UX for a game:** Inline keyboards make the hint mechanic clean. File-size image handling is generous. Markdown support (even if V2 is annoying). The interaction model fits a word/guessing game well.
4. **Group play is a unique feature:** Telegram group support is free. A friend group playing the daily puzzle together in a group chat is a compelling use case that neither WhatsApp nor Messenger offers in this context.
5. **Fastest iteration:** No approval gates. Ship changes instantly. Test with yourself via the bot token.

**The only knock on Telegram** is that it's the smallest of the three platforms (950M vs 2B+ for WhatsApp). But for a game aimed at engaged users, Telegram's demographic is arguably better — the platform skews toward people who actually use bots.

---

### Phased Rollout Plan

**Phase 1 — Telegram (Weeks 1–2)**
- Build the bot service framework (webhook, user mapping table, game client)
- Implement full game flow: daily puzzle, guesses, hints, result sharing
- Subscription system + daily push at midnight EST
- Deploy alongside existing Railway service
- Deliverable: Working Telegram bot, invite link shareable

**Phase 2 — Messenger (Weeks 3–5)**
- Add Messenger webhook route to same bot service
- Implement PSID → player UUID mapping (reuses Phase 1 infrastructure)
- Implement Recurring Notifications opt-in for daily push
- Submit for App Review (do this in Week 3, not Week 5 — review takes time)
- Deliverable: Working Messenger bot after review clears

**Phase 3 — WhatsApp (Weeks 6–9)**
- Set up Meta Business Account + phone number (can overlap with Phase 2)
- Build message templates, submit for approval
- Implement media pre-upload to Meta CDN
- Handle 24-hour window UX carefully
- Deliverable: Working WhatsApp bot with daily push capability

**Phase 4 — Shared enhancements (ongoing)**
- Cross-platform leaderboards (data already in SQLite)
- Referral links per platform
- Streak tracking (consecutive days played)
- "Play with friends" group challenge links (Telegram only for now)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WhatsApp template approval rejected | Medium | High | Draft templates carefully, align with WhatsApp guidelines; have fallback flow |
| Messenger App Review delayed (>1 week) | Medium | Medium | Submit early in Phase 2; Telegram MVP is live so no pressure |
| Daily push to WhatsApp users gets expensive at scale | High | Medium | Cap subscribers, charge for WhatsApp tier, or use WhatsApp only for on-demand play |
| SQLite contention under bot load | Low | Medium | Bot service reuses existing FastAPI API (which manages its own SQLite sessions) — no direct DB access from bot |
| Telegram rate limits hit during daily push | Low | Low | Add 1-second delay between sends; 1,000 users = ~17 min, totally fine |
| OpenAI embedding latency causes bot timeouts | Low | Low | Telegram has no timeout requirement; users expect 1–3s response time |

---

## Quick-Start: Telegram MVP

If Martin decides to proceed with Telegram, here's the concrete starting point:

```bash
pip install aiogram==3.x python-dotenv
```

```python
# bot_service/platforms/telegram.py
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart

bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def on_start(message: types.Message):
    # Create player UUID, store (chat_id, player_uuid) in bot_users table
    # Send welcome message

@dp.message()
async def on_message(message: types.Message):
    # Look up player UUID for this chat_id
    # POST /api/puzzle/{today}/guess with {guess: message.text}
    # Format response and send back
```

The core game loop is ~50 lines. The rest is subscription management and polish.

**Recommended library:** `aiogram` v3 (async, well-maintained, excellent inline keyboard support) over `python-telegram-bot` (sync-first, heavier).

---

*This assessment is based on reading the current codebase and public platform documentation as of April 2026. Platform APIs and pricing change — verify WhatsApp and Messenger costs before committing to Phase 2/3.*
