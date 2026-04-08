# Audit Fix Changelog

**Date:** 2026-04-07
**Audit reference:** AUDIT.md

All 20 recommendations from the 2026-04-07 codebase audit have been addressed.

---

## Priority 1 — Security

### 1. Hardcoded admin password removed
- `backend/app/config.py`: Added `admin_password: str` field (defaults to `"change-me-in-production"`).
- `backend/.env.example`: Added `ADMIN_PASSWORD=change-me-in-production`.
- `backend/app/routes/admin.py`: `ADMIN_PASSWORD` constant replaced with `get_settings().admin_password`.

### 2. Reset endpoint gated behind env var
- `backend/app/config.py`: Added `allow_game_reset: bool = False`.
- `backend/.env.example`: Added `ALLOW_GAME_RESET=false`.
- `backend/app/routes/guess.py`: `POST /api/puzzle/{id}/reset` now returns **403** unless `ALLOW_GAME_RESET=true` is set. The docstring was previously the only guard.

### 3. puzzle_id path parameter validated
- `backend/app/routes/guess.py`, `hints.py`, `puzzle.py`: Added `_validate_puzzle_id()` helper using regex `^[\w-]{1,64}$`. Returns **400** for any path parameter that doesn't match. Applied to all routes that accept `puzzle_id`.

### 4. POST /api/admin/verify returns 401 on failure
- `backend/app/routes/admin.py`: `verify_password` now raises `HTTPException(401)` on bad password instead of returning `{"valid": False}` with HTTP 200.

### 5. sourceUrl validated to http/https only
- `backend/app/routes/admin.py`: Added `_validate_source_url()` using `urllib.parse.urlparse`. Returns **400** if the scheme is not `http` or `https`. Applied in both `create_puzzle` and `update_puzzle`.

### 6. Rate limiting on guess and hint endpoints
- `backend/requirements.txt`: Added `slowapi==0.1.9`.
- `backend/app/limiter.py`: New module — shared `Limiter` instance keyed by remote IP.
- `backend/app/main.py`: Registered `limiter` on `app.state` and added the `RateLimitExceeded` exception handler.
- `backend/app/routes/guess.py`: `@limiter.limit("60/minute")` on `submit_guess`.
- `backend/app/routes/hints.py`: `@limiter.limit("60/minute")` on `get_hint`.

---

## Priority 2 — Bugs

### 7. Attempt ordering fixed to ascending
- `backend/app/services/attempts.py`: Changed `.order_by(UserAttempt.created_at.desc())` → `.asc()`. Attempts are now returned oldest-first, matching the frontend timeline.

### 8. Duplicate-ID guard in create_puzzle
- `backend/app/routes/admin.py`: `create_puzzle` now reads the index and returns **409 Conflict** if a puzzle with the same ID already exists. Full ID/date decoupling was not done to avoid breaking the existing S3 index format (see AUDIT.md §8 note).

### 9. run_migrations catches only expected error
- `backend/app/main.py`: Changed `except Exception: pass` to `except OperationalError as e:` with a check for `"duplicate column"` / `"already exists"` in the message. Unexpected migration errors are now re-raised.

### 10. scripts/upload_puzzle.py calls add_puzzle_to_index
- `scripts/upload_puzzle.py`: Added `update_puzzle_index()` function that reads `puzzles/index.json` from S3, upserts the new puzzle entry, and writes it back. Called after uploading puzzle metadata so the puzzle appears in the admin UI immediately.

---

## Priority 3 — Performance & Reliability

### 11. boto3 import moved to top; S3PuzzleService client reused
- `backend/app/routes/admin.py`: Removed three inline `import boto3` / `boto3.client(...)` blocks in `upload_image`, `create_puzzle`, and `update_puzzle`. All S3 `put_object` calls now go through `s3_service.s3_client` (the singleton's existing connection). The `import boto3` at the top of the file is kept only because the module may be imported independently; the actual request path no longer creates fresh clients.

### 12. get_active_puzzle_id() cached with CACHE_TTL
- `backend/app/services/s3.py`: Added `_active_puzzle_cache` (a `(value, timestamp)` tuple) to `S3PuzzleService.__init__`. `get_active_puzzle_id()` now returns the cached value within `CACHE_TTL` (5 min) instead of hitting S3 on every puzzle fetch. Cache is invalidated on `set_active_puzzle_id()`.

### 13. Composite DB indexes (already present)
- `backend/app/db/models.py`: Both `UserAttempt` and `DailyGameState` already have composite indexes on `(user_id, puzzle_date)` via `__table_args__`. No change needed.

### 14. Embedding call gated on fuzzy score
- `backend/app/routes/guess.py`: The `await embedding_service.embed(guess_text)` call is now skipped when `best_fuzzy >= 0.90`. When fuzzy already gives a definitive match, the embedding API is not called. For the display similarity value, `best_fuzzy * 0.9` is used (consistent with the existing formula).

### 15. LLM failures surfaced as 503
- `backend/app/services/llm.py`: Added `LLMUnavailableError` exception class. `check_guess_match` now raises it on any exception instead of returning `(False, 0.0)`.
- `backend/app/routes/guess.py`: Catches `LLMUnavailableError` and raises `HTTPException(503)` so the player sees a retryable error rather than silently losing a guess.

---

## Priority 4 — Cleanup

### 16. Old GET /api/admin/puzzles endpoint removed
- `backend/app/routes/admin.py`: Removed the `list_puzzles` endpoint that used `list_objects_v2` S3 scanning. The canonical endpoint is `GET /api/admin/puzzles/all` (index-backed). The old endpoint also returned errors inline with HTTP 200, which was inconsistent.

### 17. Active-puzzle override endpoints removed
- `backend/app/routes/admin.py`: Removed `GET /api/admin/active-puzzle` and `POST /api/admin/active-puzzle`. These routes managed a legacy `puzzles/active.json` override that predates the scheduling system and was not surfaced in the admin UI. The underlying `get_active_puzzle_id()` / `set_active_puzzle_id()` service methods remain so existing `active.json` files continue to work as overrides.

### 18. CORS allow_headers tightened
- `backend/app/main.py`: Changed `allow_headers=["*"]` to `allow_headers=["Content-Type", "X-Player-ID", "X-Admin-Password"]`. This fixes the browser-rejected wildcard+credentials combination and makes the accepted header surface explicit.

### 19. getattr defensive access removed
- `backend/app/routes/puzzle.py`: Changed `getattr(a, 'is_hint', False)` → `a.is_hint`. The `is_hint` column is defined in the model and is always present after migrations run.

### 20. Duplicate-ID guard (covered by item 8 above)
- Addressed in Priority 2, item 8.
