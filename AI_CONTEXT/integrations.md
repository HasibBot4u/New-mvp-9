# External integrations
Supabase: FE anon (RLS), BE service key (all writes). URLs/keys via env; project ref historically `jwwlnjcickeignkemvrj` (index.html preconnect).
Telegram: MTProto user session (PYROGRAM_SESSION_STRING[, _2]), bot (python-telegram-bot webhook), 18 storage channels (CHANNEL_MAP env), thumbnail channel; upload watcher → upload_queue → UploadWorker (thumbnails; variant pipeline stubbed).
Cloudflare Worker: Drive proxy (default URL is a personal account — supply your own via VITE_CLOUDFLARE_WORKER_URL or stop using Drive sources).
Render: backend free/starter tier, single worker, health /health. Netlify: static SPA, PR previews = staging. GitHub Actions: ci.yml (tests+deploy), backend-deploy.yml (Render hook), keep-alive.yml (uses vars.BACKEND_URL), db-backup.yml (weekly, secret-gated).
UptimeRobot: recommended /api/ping monitor (GH crons die after 60 idle days).
