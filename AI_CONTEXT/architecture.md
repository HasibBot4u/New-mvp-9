# Architecture (verified 2026-08-10)
Hybrid BaaS monolith: React 18 PWA (Vite, Netlify) + FastAPI monolith `backend/main.py` (Render, single worker) + Supabase (Postgres+GoTrue+RLS) + Telegram MTProto (pyrogram) as video storage.
- Frontend reads catalog/profile/notes directly from Supabase (anon key, RLS); writes progress via backend batch API; streams via backend.
- Backend = stream proxy + server-side authz + admin CRUD + bot webhook + upload pipeline. State: in-memory catalog cache (300s), video_map, chapter_lookup, message LRU (1h), token LRU (300s), blocked cache (60s), in-process stream counters.
- Video addressing: videos.telegram_channel_id + telegram_message_id; thumbnails in THUMBNAIL_CHANNEL_ID via videos.thumbnail_telegram_message_id.
- Drive videos 302 to a Cloudflare Worker (env VITE_CLOUDFLARE_WORKER_URL; default points at a personal account — replace or drop Drive sources).
- Dead code removed in Stages 2/7: realtime socket server, payment mocks, three.js hero, several components (see git history).
