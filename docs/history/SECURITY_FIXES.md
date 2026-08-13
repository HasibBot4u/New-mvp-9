# Security Fixes Applied — Stage 2 Recovery

## P0 Critical Fixed

### 1. Streaming Authorization Bypass (B-001)
**Before:** Any authenticated user could stream any video by guessing UUID, no enrollment check.
**Fix:**
- Extended `video_map` to include `chapter_id`
- Added global `chapter_lookup` with `requires_enrollment` flag
- New helpers `_is_user_admin()` and `_check_user_chapter_access()` querying `chapter_access` table via service key
- In `stream_video`, before serving, check if chapter requires enrollment → if yes, require entry in `chapter_access` where `is_blocked=false`, else 403
- Admins bypass enrollment
**Files:** `backend/main.py`

### 2. Public Metrics (B-002)
**Before:** `/metrics` exposed without auth.
**Fix:** Requires `X-Admin-Token` matching `ADMIN_TOKEN` OR admin JWT via profile role check. Returns 403 otherwise.
**Files:** `backend/main.py:metrics`

### 3. Webhook Setup Public (B-003)
**Before:** `/api/setup_webhook` no auth.
**Fix:** Added `await _ensure_admin(request)` dependency.

### 4. Bot Webhook No Secret (B-004)
**Before:** Open to fake updates.
**Fix:** Added `WEBHOOK_SECRET` env verification via `X-Telegram-Bot-Api-Secret-Token` header, plus rate limit 60/min. Also added env var `TELEGRAM_WEBHOOK_SECRET` to `config.py`.

## High Severity Fixed

### 5. Thumbnail Enumeration (B-005 partial)
- Changed Cache-Control from public to private
- Added optional auth extraction (does not yet enforce enrollment but logs)
- Added rate limit
- **Remaining:** Should enforce enrollment similar to stream for locked chapters — documented as future.

### 6. Bulk Update Arbitrary Fields (B-006)
- Whitelist `ALLOWED_BULK_UPDATE_FIELDS` = title, title_bn, description, description_bn, is_active, display_order, duration, size_mb, thumbnail_url
- Added size limit 2KB
- Added validation in Pydantic `model_post_init`

### 7. Admin CRUD No Whitelist (B-007)
- Introduced `_filter_allowed()` with per-table whitelists:
  - Subjects: name, name_bn, slug, description, icon, color, thumbnail_color, display_order, is_active
  - Cycles: name, name_bn, description, subject_id, display_order, is_active, telegram_channel_id
  - Chapters: name, name_bn, description, cycle_id, display_order, is_active, requires_enrollment
  - Videos: title, title_bn, description, chapter_id, source_type, source_url, telegram_channel_id, telegram_message_id, youtube_video_id, drive_file_id, thumbnail_url, duration, size_mb, file_size_bytes, mime_type, display_order, is_active
- Reject invalid field names starting with `_` or containing `$` or `__`

### 8. Frontend Admin Token Leak (B-008)
- Removed client-side HMAC computation that used `VITE_ADMIN_TOKEN` (secret) in `AdminContentPage.tsx`
- Now frontend sends only Bearer JWT, backend accepts without HMAC (`required=False`)
- Backend HMAC now optional second factor, not mandatory for content endpoints
- Added nonce replay protection in `core/security.py`

### 9. Public Cache-Control on Private Video (B-009)
- Changed `Cache-Control: public, max-age=31536000` to `private, no-store` for stream and thumbnail

### 10. HMAC Replay (B-010)
- Added `_ADMIN_NONCE_CACHE` LRU dict, deduplicates signature:timestamp combos for 70s (window 60s)
- Moved cleanup logic to `_cleanup_nonce_cache()`

## Medium Fixes

### 11. Activity Details Bloat (B-011)
- Pydantic validator + endpoint check limiting details JSON to 2KB

### 12-13. Progress & Code Gen Validation (B-012, B-013)
- `ProgressUpdateItem` now Field with pattern, ge/le, max 100 updates per batch, validates video_id exists in video_map, caps progress_percent 0-100, skips unknown videos with warning
- `GenerateChapterCodeReq` Field ge/le 1..100 for count and max_uses, pattern for type, max_length for notes/label

### 14. Concurrent Streams Leak (B-014)
- Added `incremented` flag in `_tracked_stream` to ensure decrement only if incremented, and `max(0, dec)` to prevent negative.

### 16. Audit Middleware User ID None (B-017)
- `_ensure_admin` now sets `request.state.user = user` so audit logs capture user_id

### 18. Screen Protection A11y (B-018)
- Made blocking opt-in via options, default no blocking, removed clipboard clear

### 19. IPify Privacy Leak (B-019)
- Made ipify fetch opt-in via `VITE_ENABLE_IP_FETCH`, default false, backend already logs IP from request

### 20. Insecure Code Gen (B-020)
- Replaced Math.random with crypto.getRandomValues secure

### 21. CSP Worker URL (B-021)
- Dynamic CSP parsing worker domain from env, includes in frame-src and connect-src plus api.ipify.org

### 22. Fake Metrics (B-022)
- Replaced random.randint baseline with real query to activity_logs last 5 min active users set, max with stream count

### 23. OG Image Typo (B-023)
- Changed jpg to png

### 24. Config Strictness (B-024)
- Made jwt_secret optional, added webhook secret, thumbnail_channel, cloudflare worker url

## Remaining High/Medium (Not yet fixed, documented)

- Thumbnail authz for locked chapters
- Drive redirect authz after redirect (worker should verify JWT)
- Channel health sequential calls
- Catalog no pagination
- Progress stats heavy dateutil loop
- God file split
- Tests wrong path /api/v1 vs /api
- Virtualization not used
- Docker incomplete
- etc — see BUG_INVENTORY.md full list

## Security Headers Added

- Referrer-Policy: strict-origin-when-cross-origin
- CSP updated to include worker domains
- X-Content-Type-Options, X-Frame-Options DENY, HSTS retained

## Verification

All fixes code-reviewed via diff, but require runtime tests with real Supabase and Telegram to fully verify. Unit tests should be added for:

- stream endpoint returns 403 without enrollment
- metrics returns 403 without admin token
- webhook returns 403 without secret
- bulk_update rejects invalid fields
- progress batch rejects oversized payload
