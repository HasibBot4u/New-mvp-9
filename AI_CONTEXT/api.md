# API inventory (backend/main.py + api/admin/upload.py)
Public: /health /api/health /api/ping /api/warmup /api/catalog (60s public cache) /api/refresh(5/min) /api/prefetch/{id} /api/thumbnail/{id}.
Auth required (JWT or ticket): /api/stream/{id} (GET/HEAD, Range; ticket param for <video>), /api/stream-ticket/{id}, /api/channels/health, /api/activity, /api/progress/batch.
Admin (JWT role): /api/admin/verify, /users/{id}/{profile|activity|watch-history|stats|notes|sessions}, CRUD /subjects|cycles|chapters|videos (UUID-validated), /announcements, /logs (since/limit sanitized), /dashboard/metrics, /enrollments/pending|{id}/approve|reject, /generate_chapter_code (expires_at honored), /setup_webhook, bulk_* (upload.py), delete_user (+HMAC).
Scrape: /metrics via X-Admin-Token header or admin JWT.
Webhook: POST /api/bot_webhook (secret-token checked when TELEGRAM_WEBHOOK_SECRET set — startup warns when unset).
CORS: explicit origins env; methods incl. PUT/PATCH (Stage-3 fix N-1).
