# iOS App Feasibility Plan — Can You Guess the Map?

*Prepared: 2026-04-07*

---

## Codebase Summary

The existing app is a FastAPI (Python) backend + Next.js frontend. Key facts relevant to iOS:

- Puzzles are stored as JSON + PNG on **AWS S3** (`puzzles/YYYY-MM-DD.json`, `puzzles/images/YYYY-MM-DD.png`)
- The backend handles all **similarity matching** via three layers: fuzzy string → OpenAI embeddings (cosine similarity) → GPT-4o-mini LLM fallback
- **Pre-computed embeddings** are stored in each puzzle's JSON (no on-device inference needed)
- Game state lives in **SQLite** on the backend, keyed by an anonymous `player_id`
- **No user accounts** — identity is a UUID cookie/header (`p_{uuid}`)
- Hints cost 1 guess; up to 6 guesses total per puzzle
- Share format is a Wordle-style emoji grid string

---

## 1. Architecture Recommendation

### Option A: iOS talks to the existing FastAPI backend (recommended)

```
iOS App ──────► FastAPI backend ──► S3 (puzzle data)
                     │
                     └──► SQLite (game state)
                     └──► OpenAI API (matching)
```

**Pros:**
- Zero duplication of business logic — similarity matching, hint cost, guess counting all stay in Python
- Game state is server-side, so streaks survive app reinstalls and carry over to web
- No S3 credentials on device (security win)
- OpenAI API key never touches the client
- Future multi-device sync comes for free
- Puzzle delivery (date overrides, endless pool) works identically

**Cons:**
- Requires backend to be reachable (already deployed)
- CORS/header config already in place (`X-Player-ID`), so minimal backend changes needed
- Offline mode not possible (acceptable for v1)

### Option B: iOS talks directly to S3

**Pros:** Zero backend dependency per request (except for guess evaluation)

**Cons:**
- Similarity matching **cannot** move to the client without shipping OpenAI credentials or running a local ML model — a non-starter
- S3 doesn't serve game state; you'd need a second persistence layer anyway
- Duplicates routing/scheduling logic

**Verdict: Use Option A.** The backend is the right seam. The iOS app is a thin client, just like the web app. The only meaningful backend work is ensuring `X-Player-ID` header flows correctly from iOS and that CORS or auth isn't blocking mobile user agents.

### Minor backend changes needed for iOS

1. Confirm all endpoints accept `X-Player-ID` header (already implemented)
2. Add a `GET /api/puzzle/{id}/state` endpoint (or extend `/attempts`) to return full serialized game state for restoring from cold launch — the web app already uses `/attempts` for this, so it may be sufficient
3. Optionally: add a `GET /api/player/streak` endpoint that computes streak from `daily_game_state` (currently not exposed)
4. Push notification token registration endpoint (for daily puzzle notifications)

---

## 2. Core Features — v1 Scope

| Feature | Priority | Notes |
|---|---|---|
| Daily puzzle with map image | P0 | Core loop |
| Text input + similarity feedback | P0 | % match + color coding |
| Progressive hints (costs a guess) | P0 | Match web behavior exactly |
| Game over / answer reveal | P0 | Show answer + source |
| Result share (emoji grid) | P0 | Native share sheet |
| Streak tracking | P1 | Via backend history |
| Persistence across launches | P0 | Restore mid-game state |
| Offline graceful error | P1 | "No connection" state |
| Push notifications (daily puzzle) | P2 | Nice to have in v1 |
| Endless mode | P2 | After daily mode stable |
| Dark mode | P1 | Follows system setting |
| iPad layout | P3 | Post-launch |

---

## 3. Technical Decisions

### 3.1 Similarity Matching — On-Device vs API Call

**Decision: API call to existing backend.**

The embedding vectors for each puzzle are 1536-dimensional float arrays (text-embedding-3-small). On-device options:

- **Core ML / Create ML**: Would require converting OpenAI's model to CoreML format — not publicly available, not feasible
- **Ship embeddings + compute cosine on device**: Puzzle JSON already contains pre-computed embeddings. Cosine similarity is trivially computed on-device (dot product + normalize). **This is viable** for the embedding layer.
- **Fuzzy matching**: `rapidfuzz` logic can be replicated with a simple Swift Levenshtein/token-sort implementation (~50 lines)
- **LLM fallback (GPT-4o-mini)**: Cannot run on-device. Must be an API call.

**Recommended hybrid approach:**
- The backend handles **all evaluation** via `POST /api/puzzle/{id}/guess` — keep it there for v1. This is a single HTTP call, fast enough (~200–400ms).
- The app gets back `{ similarity_score, is_correct, message }` and renders accordingly
- No on-device ML needed; no API keys on device

If offline support is desired later: cache the puzzle's embedding vectors locally and implement cosine similarity + fuzzy match in Swift as a fast-path, falling back to the API only for the LLM layer.

### 3.2 Image Loading and Caching

Use **`AsyncImage`** (SwiftUI native) for v1 simplicity. For better UX, use **Kingfisher** or **SDWebImageSwiftUI** which add:
- Disk cache (survives app restarts)
- Placeholder + error states
- Progressive loading

Strategy:
- On puzzle load, pre-fetch and cache the image to disk
- Cache key = puzzle ID (e.g. `2026-04-07`)
- Expire cache after 7 days to avoid storage bloat
- Images are ~500KB–2MB PNGs; fine for mobile data

S3 images are public-read with HTTPS URLs directly in the puzzle JSON — no signed URL logic needed on the app side.

### 3.3 Local Storage for Game State and Streaks

**Primary source of truth: the backend** (SQLite via `daily_game_state` + `user_attempts`).

**Local storage role (UserDefaults + FileManager):**

```
UserDefaults:
  - player_id: String              # UUID, generated once, permanent
  - last_played_date: String       # YYYY-MM-DD, for cold-launch check
  - cached_puzzle_{date}: Data     # JSON-encoded puzzle (5-min TTL)

FileManager (documents dir):
  - game_state_{date}.json         # Local mirror of in-progress game
    { guesses: [...], solved: bool, hints_revealed: int }
```

On cold launch:
1. Read `last_played_date` from UserDefaults
2. If today, load `game_state_{today}.json` and restore UI immediately
3. In background, call `GET /api/puzzle/{id}/attempts` to sync with server
4. Server state wins on conflict (browser tab may have been used)

**Streak calculation:**
- Call new `GET /api/player/streak` endpoint (needs to be built — small backend task)
- Cache result locally, refresh once per day
- Display: current streak + max streak

### 3.4 Push Notifications for Daily Puzzles

Use **Apple Push Notification Service (APNs)** via:
- **Firebase Cloud Messaging (FCM)** — cross-platform, easier to manage server-side
- Or **direct APNs** — simpler if iOS-only

Implementation:
1. App requests notification permission on first launch (or after first game)
2. App sends device token + `player_id` to new backend endpoint: `POST /api/player/push-token`
3. A scheduled job (cron, Railway scheduler, etc.) fires daily at ~8am ET and calls APNs/FCM for all registered tokens
4. Notification: "Today's map puzzle is ready. Can you guess it? 🗺️"
5. Deep link opens the app directly to today's puzzle

Backend changes needed:
- New `push_tokens` table: `(player_id, token, platform, created_at)`
- Daily cron job or webhook trigger
- APNs/FCM credentials stored as backend env vars

**Complexity: Medium.** Not blocking for v1 — can ship without and add later.

---

## 4. Estimated Complexity Per Component

| Component | Complexity | Notes |
|---|---|---|
| Project setup (Xcode, SwiftUI, networking) | Small | Standard boilerplate |
| Player ID management (generate, persist, send with requests) | Small | 20 lines in UserDefaults |
| API client layer | Small | URLSession or Alamofire wrappers for 6 endpoints |
| Puzzle fetch + caching | Small | URLSession + Codable + UserDefaults |
| Map image display + loading states | Small | Kingfisher + ZoomableScrollView |
| Guess input + submit | Small | TextField + Button |
| Similarity feedback UI (color bars, %) | Medium | Custom `AttemptRow` views with color mapping |
| Hint panel (request hint, show text, cost warning) | Medium | Modal sheet + confirmation alert |
| Timeline/history view (emoji squares) | Small | HStack of colored squares |
| Game over modal (answer, source, share) | Medium | Sheet + UIActivityViewController |
| Share text generation (emoji grid) | Small | Pure string building logic |
| Streak display | Small | Fetch + show two numbers |
| Cold launch state restoration | Medium | Async fetch + local fallback |
| Push notifications | Medium | APNs setup, permission flow, backend endpoint |
| Dark mode | Small | Follows `.colorScheme` automatically if Color assets used |
| Endless mode | Medium | Extra game mode selection UI + API variant |

**Total v1 estimate (daily mode only, no push):** ~3–4 weeks for one developer building from scratch with familiarity with SwiftUI.

---

## 5. Recommended Project Structure

```
MapGuessing/
├── MapGuessingApp.swift          # @main, app entry point
├── Config.swift                  # API base URL, constants
│
├── Models/
│   ├── Puzzle.swift              # Codable: id, imageURL, maxGuesses, hints[]
│   ├── Attempt.swift             # Codable: guess_text, similarity_score, is_hint, is_correct
│   ├── GameState.swift           # solved, total_guesses, hints_revealed, attempts[]
│   └── GuessResponse.swift       # API response for POST /guess
│
├── Services/
│   ├── APIClient.swift           # URLSession wrapper, injects X-Player-ID header
│   ├── PlayerService.swift       # UUID generation, UserDefaults persistence
│   ├── PuzzleService.swift       # fetchTodaysPuzzle(), fetchAttempts(), submitGuess()
│   ├── HintService.swift         # fetchHint(), fetchAllHints()
│   ├── ImageCacheService.swift   # Kingfisher config, prefetch
│   └── NotificationService.swift # APNs registration, permission request
│
├── ViewModels/
│   └── GameViewModel.swift       # @Observable, owns GameState, drives all views
│
├── Views/
│   ├── ContentView.swift         # Root: loading → game or error
│   ├── GameView.swift            # Main game layout
│   ├── MapImageView.swift        # AsyncImage/Kingfisher + zoom
│   ├── GuessInputView.swift      # TextField + Submit button
│   ├── AttemptHistoryView.swift  # List of AttemptRowView
│   ├── AttemptRowView.swift      # Single guess: color bar + % + text
│   ├── HintPanelView.swift       # Hint reveal button + hint text
│   ├── TimelineView.swift        # Emoji squares row
│   ├── GameOverSheet.swift       # Answer reveal + share + source link
│   ├── HelpSheet.swift           # How to play
│   ├── StreakView.swift          # Current streak / max streak display
│   └── ErrorView.swift           # Network error state
│
├── Utilities/
│   ├── ColorMapping.swift        # similarityScore → Color logic
│   ├── EmojiGrid.swift           # Build share string from attempts
│   └── DateHelper.swift          # EST date → puzzle ID
│
└── Assets.xcassets/
    ├── AppIcon
    └── Colors/                   # semantic colors (green, yellow, orange, red, purple)
```

### Key design decisions in the structure

- **Single `GameViewModel`** (using `@Observable` / iOS 17+) owns all state. Views are dumb.
- **`APIClient`** is a low-level HTTP layer; `PuzzleService` etc. are semantic wrappers.
- **`PlayerService`** generates and persists the `player_id` UUID once, then `APIClient` reads it for every request via a shared header.
- **`ColorMapping`** centralizes the similarity-to-color thresholds (matching the web: green ≥ threshold, yellow ≥ 70%, orange ≥ 45%, red < 45%, purple = hint).

---

## 6. MVP Scope

### Build first (v1.0)

- [x] Daily puzzle fetch (with 5-min cache)
- [x] Map image display with pinch-to-zoom
- [x] Guess input, submit, similarity feedback (color + %)
- [x] Up to 6 guesses with hint support (hints cost a guess)
- [x] Timeline (emoji squares) updating after each guess
- [x] Game over: reveal answer, source URL, share sheet
- [x] Share text generation (Wordle-style emoji grid)
- [x] Cold launch state restoration from server
- [x] Streak display (requires small new backend endpoint)
- [x] Dark mode (follow system)
- [x] Basic error states (no network, puzzle not found)
- [x] App Store metadata, icon, screenshots

### Can wait (v1.1+)

- Push notifications for daily puzzle
- Endless mode (pool of past puzzles)
- iPad-optimized layout
- Onboarding / how-to-play tutorial
- Stats screen (win rate, guess distribution histogram)
- Haptic feedback on correct/incorrect
- Animated transitions between guesses
- Offline support (cached embeddings + local cosine similarity)
- Localization

---

## 7. Backend Changes Required

These are the only server-side changes needed before starting iOS development:

| Change | Effort | Priority |
|---|---|---|
| `GET /api/player/streak` — return `{ current_streak, max_streak, total_played, total_solved }` computed from `daily_game_state` | Small | P1 (needed for streak display) |
| `POST /api/player/push-token` — register APNs token | Small | P2 (push notifications) |
| Verify mobile user agents aren't blocked by any middleware | Trivial | P0 |
| S3 CORS: confirm existing policy allows direct image fetching from any origin (needed for public-read image URLs in app) | Trivial | P0 |
| `GET /health` already exists — confirm it returns 200 quickly for connectivity checks | Trivial | P0 |

---

## 8. API Endpoints the iOS App Will Use

```
GET  /api/puzzle                        → today's puzzle (id, imageUrl, maxGuesses, hints count)
GET  /api/puzzle/{id}/attempts          → restore game state on cold launch
POST /api/puzzle/{id}/guess             → { guess: String } → { similarity_score, is_correct, message }
GET  /api/puzzle/{id}/hint              → next hint (costs a guess)
GET  /api/puzzle/{id}/hints             → all revealed hints
GET  /api/player/streak                 → (NEW) streak stats
POST /api/player/push-token             → (NEW, v1.1) register APNs token
GET  /health                            → connectivity check
```

All requests include header: `X-Player-ID: p_{uuid}`

---

## 9. Dependency Recommendations

| Dependency | Purpose | Version |
|---|---|---|
| **Kingfisher** | Image caching/loading | 7.x |
| (Optional) **Alamofire** | Networking | 5.x — URLSession is fine for v1 |

Avoid over-dependencing. SwiftUI + URLSession + Codable + Kingfisher is sufficient for the entire app. No need for Combine (use `async/await`), no need for RxSwift.

Minimum deployment target: **iOS 17** (enables `@Observable`, `#Preview` macros, SwiftData if needed later).

---

## 10. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| OpenAI API latency makes guess feel slow | Medium | Show spinner; typical p50 is ~300ms — acceptable |
| Player ID lost on device wipe | Low | Streaks reset; acceptable for anonymous game. Could offer iCloud Keychain backup in v1.1 |
| S3 image URLs change (bucket rename/CDN) | Low | URLs come from API response, not hardcoded |
| App Store rejection for web-first content | Low | Game is native gameplay, not a web wrapper — should pass review |
| Backend unavailable | Medium | Cache last puzzle locally; show "come back later" gracefully |
