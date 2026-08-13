# API inventory (verified 2026-08-11)

Routers live in `backend/api/*` and are wired in `backend/app_factory.py`.

**Public/operational** (`api/system/routes.py`):
`GET /health`, `GET /` (service info), `GET /api/health`, `GET /api/ping`, `GET /metrics` (admin), `GET|POST /api/warmup`, `GET /api/channels/health` (auth).

**Catalog/media** (`api/catalog/routes.py`):
`GET /api/catalog` (60s public cache), `GET /api/refresh` (5/min), `GET /api/prefetch/{id}`, `GET /api/thumbnail/{id}`.

**Streaming** (`api/streaming/routes.py`):
`GET /api/stream-ticket/{id}` (JWT → HMAC ticket), `GET|HEAD /api/stream/{id}` (JWT or ticket; Range; max 3 concurrent/user; 50MB/range).

**Progress/activity** (`api/progress/routes.py`):
`POST /api/progress/batch` (≤100, upsert `watch_history`), `POST /api/activity` (≤2KB details).

**Telegram integration** (`api/integrations/routes.py`):
`POST /api/bot_webhook` (secret-token checked when `TELEGRAM_WEBHOOK_SECRET` set), `GET /api/setup_webhook` (admin).

**Admin** (`api/admin/`, prefix `/api/admin`):
- `auth.py`: `POST /verify`, `POST /delete_user` (HMAC), `POST /generate_chapter_code` (chapter|cycle, `expires_at` honored).
- `users.py`: `GET /users/{id}/{profile|activity|watch-history|stats|notes|sessions}`.
- `content.py`: CRUD `/subjects|cycles|chapters|videos[/id]` (UUID-validated, field-whitelisted, optional HMAC; triggers catalog refresh).
- `enrollment.py`: `GET /enrollments/pending`, `POST /enrollments/{id}/approve|reject`.
- `announcements.py`: `POST/GET /announcements`.
- `operations.py`: `GET /logs` (since/limit sanitized), `GET /dashboard/metrics`.
- `bulk.py`: `/bulk_url_upload` (501), `/bulk_delete`, `/bulk_update`, `/bulk_move`.

**Auth**: JWT for `/api/*`; ticket preferred for `<video>`; `X-Admin-Token` header for `/metrics`; admin JWT + optional `X-Admin-Signature`/`X-Admin-Timestamp` for mutations. CORS: explicit `ALLOWED_ORIGINS`, methods incl. PUT/PATCH/DELETE.
