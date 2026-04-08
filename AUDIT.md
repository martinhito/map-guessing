# Codebase Audit — Map Guessing Game

**Date:** 2026-04-07
**Auditor:** Claude Sonnet 4.6
**Scope:** `frontend/`, `backend/`, `scripts/`, `docker-compose.yml`, `DEPLOYMENT.md`

---

## 1. Architecture Overview

### Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Backend | FastAPI (Python 3.11), SQLAlchemy 2, SQLite |
| Storage | AWS S3 (puzzle metadata + images) |
| AI | OpenAI `text-embedding-3-small` (similarity), `gpt-4o-mini` (synonym gen + LLM mode) |
| String matching | RapidFuzz (fuzzy matching) |
| Deployment | Docker Compose; recommended: Vercel + Railway |

### Data Flow
1. Admin creates a puzzle via the admin dashboard: uploads an image to S3, generates embeddings for the answer and its synonyms, and saves a JSON blob (`puzzles/{id}.json`) and a master index (`puzzles/index.json`) to S3.
2. On game load, the frontend calls `GET /api/puzzle` (or `/api/puzzle/{id}`). The backend resolves today's puzzle ID (EST timezone) via the index, fetches it from S3 (with 5-minute in-process cache), and returns public metadata (no answer or embedding).
3. The user submits guesses via `POST /api/puzzle/{id}/guess`. The backend embeds the guess, runs cosine similarity against all answer variants, optionally checks fuzzy match via RapidFuzz, and optionally calls GPT-4o-mini in LLM mode.
4. Game state (guesses, hints revealed, solved flag) is stored per-player in SQLite.
5. Player identity uses a UUID in a cookie (`player_id`) with `X-Player-ID` header fallback for mobile/cross-domain.

### Deployment
- Docker Compose bundles both services; DEPLOYMENT.md covers Vercel + Railway, Render, Fly.io, DigitalOcean, and self-hosted VPS.
- Frontend is a Next.js standalone build served by Node. Backend runs under Uvicorn.

---

## 2. Code Quality

### Strengths
- Clean separation of concerns: routes, services, models all in their own modules.
- Pydantic models used consistently for request/response validation.
- Async throughout the backend; `httpx.AsyncClient` used for OpenAI calls.
- Frontend custom hook (`useGame.ts`) encapsulates game state cleanly.
- TypeScript used across the frontend with a dedicated `types.ts`.

### Issues

**`boto3` imported inside functions** (`admin.py` lines 95, 220, 260, 532)
`import boto3` appears inside request handlers rather than at the top of the file. This is a Python anti-pattern — it re-evaluates the import machinery on every request (though Python caches it, it's still unconventional and easy to overlook).

**Two duplicate "list puzzles" endpoints**
`GET /api/admin/puzzles` (line 252) and `GET /api/admin/puzzles/all` (line 337) both return puzzle lists, but by different mechanisms (S3 `list_objects_v2` vs. index). The index-backed one is the canonical version; the older one is likely dead code.

**`puzzle_id` used as the puzzle's primary key AND the date**
The ID doubles as the creation date (`puzzle_date = date or datetime.now(...).strftime("%Y-%m-%d")`). This means two puzzles created on the same day collide — the second silently overwrites the first. In the index, `dailySchedule` accepts arbitrary puzzle IDs, so this assumption is not required; IDs should be decoupled from dates.

**Inline S3 client creation in admin routes**
`S3PuzzleService` (singleton) manages its own `boto3` client, but the admin routes (`upload_image`, `create_puzzle`, `update_puzzle`, `list_puzzles`) each instantiate a fresh `boto3.client(...)` per request, bypassing the singleton. Credentials are passed redundantly and connection pooling is lost.

**`getattr(a, 'is_hint', False)` defensive access** (`puzzle.py` line 140)
This guard is a code smell: `is_hint` is defined in the SQLAlchemy model. The fallback implies the migration path is uncertain. Once `run_migrations` has run, this is always safe to access directly.

**Attempts returned newest-first** (`attempts.py` line 22: `.order_by(UserAttempt.created_at.desc())`)
The frontend renders attempts in a timeline from first to last, so the descending order forces the frontend to reverse or rely on a stable ordering it doesn't explicitly control.

---

## 3. Security

### Critical

**Hardcoded admin password** (`backend/app/routes/admin.py`, line 17)
```python
ADMIN_PASSWORD = "sydneyannerocks123"
```
The password is committed in plaintext to the repository. Anyone with read access to the code has full admin access. This must be moved to an environment variable immediately.

```python
# Fix:
ADMIN_PASSWORD = settings.admin_password  # add to config.py + .env
```

### High

**`/api/puzzle/{puzzle_id}/reset` has no localhost enforcement**
The docstring says "localhost only" but there is no check. Any client can call this endpoint and wipe any player's game state for any puzzle. This is a significant data-manipulation risk in production.

**Player ID is fully client-controlled**
`X-Player-ID` is read directly from the HTTP header without any validation or signature. A client can impersonate any player ID (including another user's) to read their attempt history or submit guesses on their behalf.

**S3 key constructed from unsanitized `puzzle_id`** (`s3.py` line 41)
```python
key = f"{self.settings.s3_puzzle_prefix}{resolved_id}.json"
```
If `puzzle_id` contains `../` sequences, the resulting S3 key could reference objects outside the puzzle prefix. FastAPI's path parameter parsing prevents literal slashes, but percent-encoded traversal (`%2F`) or carefully crafted IDs (e.g., `..`) could still produce unexpected keys. Input should be validated to match `\d{4}-\d{2}-\d{2}` or a similar safe pattern.

**Admin `verify` endpoint returns HTTP 200 on failure** (`admin.py` lines 42–47)
```python
@router.post("/verify")
async def verify_password(...):
    if x_admin_password == ADMIN_PASSWORD:
        return {"valid": True}
    return {"valid": False}  # ← HTTP 200 with valid=False
```
This leaks timing information (same code path either way is fine), but more importantly: callers that check only the status code will treat failed auth as success. Should return HTTP 401 on failure.

**No rate limiting on any endpoint**
Guess submission (`/api/puzzle/{id}/guess`) and hint requests (`/api/puzzle/{id}/hint`) each trigger an OpenAI Embeddings API call. Without rate limiting, a single automated client can exhaust the OpenAI quota or run up significant costs. No `slowapi`, `fastapi-limiter`, or reverse-proxy rate limits are configured.

### Medium

**CORS: `allow_headers=["*"]` combined with `allow_credentials=True`**
This combination is rejected by browsers (CORS spec prohibits wildcard headers with credentials). FastAPI does not enforce this, but browsers will block cross-origin credentialed requests. It currently works because frontend and backend share an explicit origin allowlist, but the `allow_headers=["*"]` should be tightened to list only what's needed (e.g., `["Content-Type", "X-Player-ID", "X-Admin-Password"]`).

**Admin password transmitted as a plain HTTP header**
`X-Admin-Password` is sent in every admin request. Even over HTTPS (which the production setup uses), the header appears in server logs and any observability tooling. Consider a session token approach.

**`sourceUrl` not validated**
`sourceUrl` is accepted from the admin form and stored in S3 without URL validation. It is later embedded as a link in the result modal. A malicious admin could inject a `javascript:` URL or an arbitrary redirect target.

---

## 4. Performance

**Embedding API call on every guess**
`await embedding_service.embed(guess_text)` is called unconditionally before checking the fuzzy score (`s3/guess.py` line 93–94). If the fuzzy score alone is ≥ 0.90, the embedding result is still used for display (line 103), so moving the embedding call after the fuzzy check wouldn't always be an optimization — but the result is thrown away when fuzzy already marks the guess correct at 100% similarity. Consider gating the embedding call on `best_fuzzy < 0.90`.

**S3 cache is in-process and unsynchronised**
`_puzzle_cache` in `S3PuzzleService` is a dict on the singleton. Multiple Uvicorn workers (common in production) each maintain their own cache with no cross-process invalidation. After a puzzle is updated via the admin panel, only the worker that processed the update evicts its cache entry; other workers serve stale data for up to 5 minutes.

**Read-modify-write on the S3 index without locking**
`add_puzzle_to_index`, `toggle_endless_pool`, and `schedule_puzzle` all do:
1. Read index from S3
2. Modify in memory
3. Write back to S3

Concurrent admin operations will cause lost updates. For a single-admin tool this is low risk, but worth documenting.

**`get_active_puzzle_id()` calls S3 on every puzzle fetch**
`_resolve_puzzle_id` always calls `get_active_puzzle_id()`, which makes an uncached `get_object` request to S3 (the key `puzzles/active.json`). This adds an S3 round-trip to every puzzle load. Should be cached alongside puzzle data.

**No database indexing documented**
`UserAttempt` and `DailyGameState` are queried by `(user_id, puzzle_date)` on every guess and hint. SQLAlchemy creates these tables with no explicit composite index. For large player counts this will degrade. Add:
```python
__table_args__ = (Index('ix_user_puzzle', 'user_id', 'puzzle_date'),)
```

---

## 5. Bugs / Logic Errors

**Hint count check uses stale `total_guesses`** (`hints.py` lines 44, 58)
```python
total_guesses = game_state.total_guesses if game_state else 0
# ...
remaining_guesses = puzzle.maxGuesses - (total_guesses + 1)
```
`total_guesses` is read before `record_hint_used` increments it. The `remaining_guesses` calculation on line 58 manually adds 1 to account for this, which is fragile. If `record_hint_used` is refactored to return the updated state (as `record_attempt` does), this manual offset becomes incorrect.

**Puzzle ID collision — overwrite without warning**
Creating two puzzles on the same day silently overwrites the first (both S3 key and index entry). There is no duplicate-ID check before `put_object`.

**`get_user_attempts` returns descending order**
The frontend's attempt history timeline will render guesses in reverse chronological order unless the frontend re-sorts. The UI should either explicitly reverse the list or the query should use `.asc()`.

**`schedule_puzzle` only removes from the puzzle's own `scheduledDate`**
The comment in `schedule_puzzle` acknowledges "puzzles can be assigned to multiple dates (reused)" but `puzzle.scheduledDate` stores only one date. If a puzzle is assigned to 3 dates and then "unscheduled," only the last assignment is removed from `dailySchedule`; the other two remain orphaned.

**Admin `create_puzzle` accepts `inEndlessPool=False` as a form default but ignores it in `add_puzzle_to_index`**
When `inEndlessPool=False`, the index update still processes the pool membership (line 161–164 in s3.py), which is correct. However, the puzzle's `inEndlessPool` field in the index entry may be set to `False` even when it was previously `True` (on re-creation by same date ID), effectively removing it from the pool without an explicit admin action.

---

## 6. Missing Error Handling

**`run_migrations` swallows all exceptions** (`main.py` lines 17–21)
```python
try:
    conn.execute(text("ALTER TABLE user_attempts ADD COLUMN is_hint BOOLEAN DEFAULT FALSE"))
    conn.commit()
except Exception:
    pass  # Column already exists
```
This catches the expected "column already exists" error, but also silently masks genuine migration failures (e.g., a locked DB, a schema mismatch, or a typo in the SQL). Should catch only `sqlalchemy.exc.OperationalError` with a message check.

**`batch embedding` falls back silently** (`admin.py` lines 179–186)
If batch embedding fails, it retries with the answer only, losing all synonym embeddings. The admin user gets no warning that synonyms were not embedded. The response still shows `success: True`.

**LLM errors in `check_guess_match` return `(False, 0.0)`** (`llm.py` line 178–181)
A transient OpenAI outage causes every guess in LLM mode to silently fail as "incorrect." The player loses their guess without a meaningful error. At minimum, log the error and surface a 503 to the frontend so the user can retry.

**`list_puzzles` (the old endpoint) returns errors inline** (`admin.py` lines 291–292)
```python
except Exception as e:
    return {"puzzles": [], "error": str(e)}
```
Returning an error message in the response body with HTTP 200 is inconsistent with the rest of the API (which uses `HTTPException`). The error string may also leak internal details to the caller.

**No handling for S3 throttling**
`s3_client.put_object` and `get_object` can raise `ClientError` with code `SlowDown` under heavy load. None of the S3 calls have retry logic (boto3 has automatic retries by default, but the retry config is not explicitly set and may not cover all cases).

---

## 7. Dead Code / Unused Dependencies

**`GET /api/admin/puzzles`** (admin.py line 252)
This endpoint lists puzzles by scanning S3 with `list_objects_v2`. It is superseded by `GET /api/admin/puzzles/all` which uses the index. The frontend admin page uses `/all`. This endpoint appears unused.

**`GET /api/admin/active-puzzle` and `POST /api/admin/active-puzzle`** (admin.py lines 295–331)
These endpoints manage an "active puzzle override" stored in `puzzles/active.json` on S3. This mechanism is not surfaced in the admin dashboard UI and may be a legacy feature predating the calendar/scheduling system. If the scheduling system is the canonical approach, these can be removed.

**`puzzle.id` vs `scheduledDate` distinction is blurred**
The puzzle `id` is set to the creation date. `scheduledDate` is a separate field for the daily schedule. Downstream, `_resolve_puzzle_id` and `get_today_puzzle_id` look up by today's date in `dailySchedule`, but the `id` field is also date-shaped, making it possible to fetch `2026-04-07` both as a direct ID and as a scheduled date — which may resolve to different puzzles. The distinction should be clarified or the direct-by-date lookup removed.

**`scripts/upload_puzzle.py`**
The CLI upload script is fully functional but bypasses the admin web UI. It creates puzzles directly on S3 without updating the index (`add_puzzle_to_index` is not called). Any puzzle uploaded via this script will not appear in the admin calendar or endless pool views until the index is rebuilt manually.

---

## 8. Recommendations

### Priority 1 — Security (fix before production traffic)

1. **Move admin password to environment variable.** Add `ADMIN_PASSWORD` to `config.py`, `.env.example`, and `docker-compose.yml`. Remove the hardcoded string.

2. **Enforce localhost-only on the reset endpoint.** Read the `Host` or `X-Forwarded-For` header and return 403 in production environments, or gate it behind an environment variable flag (`ALLOW_GAME_RESET=true` for dev).

3. **Validate `puzzle_id` path parameter.** Reject any value that doesn't match `^[\w-]{1,64}$` or the expected date pattern `^\d{4}-\d{2}-\d{2}$`.

4. **Return HTTP 401 from `POST /api/admin/verify` on failure.**

5. **Validate `sourceUrl` to allow only `http://` and `https://` schemes.**

6. **Add rate limiting.** Use `slowapi` or a reverse-proxy (nginx, Cloudflare) to limit guess and hint endpoints to a sane per-IP or per-player rate (e.g., 60 req/min).

### Priority 2 — Bugs

7. **Fix attempt ordering.** Change `order_by(UserAttempt.created_at.desc())` to `.asc()`.

8. **Decouple puzzle ID from date.** Use a UUID or random slug as the puzzle ID; store the scheduled date separately. This fixes silent overwrites and the ID/date confusion.

9. **Fix `run_migrations` to catch only the expected error**, e.g. check for "duplicate column" in the exception message.

10. **Fix `scripts/upload_puzzle.py`** to call `add_puzzle_to_index` after uploading.

### Priority 3 — Performance & Reliability

11. **Move `import boto3` to the top of `admin.py`** and reuse the `S3PuzzleService` singleton's client instead of creating new ones.

12. **Cache `get_active_puzzle_id()`** with the same TTL as puzzle data.

13. **Add composite DB indexes** on `(user_id, puzzle_date)` for both `UserAttempt` and `DailyGameState`.

14. **Gate embedding call on fuzzy score** to avoid unnecessary OpenAI API calls when fuzzy match is definitive.

15. **Surface LLM failures as 503.** In `check_guess_match`, propagate transient errors so the frontend can show "try again" instead of silently consuming a guess.

### Priority 4 — Cleanup

16. **Remove `GET /api/admin/puzzles`** (the old S3-list-based endpoint) in favour of `/all`.

17. **Remove or document the active-puzzle override endpoints** if the scheduling system is the canonical approach.

18. **Tighten CORS headers.** Replace `allow_headers=["*"]` with an explicit list.

19. **Remove `getattr(a, 'is_hint', False)`** after verifying the migration has run everywhere; access `a.is_hint` directly.

20. **Add a duplicate-ID guard** in `create_puzzle` to prevent silent overwrites (check index before writing).
