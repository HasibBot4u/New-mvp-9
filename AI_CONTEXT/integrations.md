# External integrations
Supabase: FE anon (RLS), BE service key (all writes). URLs/keys via env; project ref historically `jwwlnjcickeignkemvrj` (index.html preconnect).
Telegram: MTProto user session (PYROGRAM_SESSION_STRING[, _2]), bot (python-telegram-bot webhook), 18 storage channels (CHANNEL_MAP env), thumbnail channel; upload watcher → upload_queue → UploadWorker (thumbnails; variant pipeline stubbed).
Cloudflare Worker: Drive proxy (default URL is a personal account — supply your own via VITE_CLOUDFLARE_WORKER_URL or stop using Drive sources).
Render: backend free/starter tier, single worker, health /health. Netlify: static SPA, PR previews = staging. GitHub Actions: ci.yml (tests+deploy), backend-deploy.yml (Render hook), keep-alive.yml (uses vars.BACKEND_URL), db-backup.yml (weekly, secret-gated).
UptimeRobot: recommended /api/ping monitor (GH crons die after 60 idle days).

## Stage 18 production reality
- Historical (possibly deleted) endpoints: backend `nexusedu-backend-0bjq.onrender.com`, frontend `nexusedu.netlify.app`, Supabase ref `jwwlnjcickeignkemvrj`. Real values MUST come from env at runtime/build; index.html preconnect/canonical are now env-driven (not pinned).
- GitHub keep-alive workflow pings the historical Render URL — update `.github/workflows/keep-alive.yml` after the backend is recreated.
- Cloudflare Worker default is a personal/third-party account (`mdhosainp414.workers.dev`); set VITE_CLOUDFLARE_WORKER_URL to your own or avoid Drive sources.
- Full external dependency + env + gap inventory: `docs/PROJECT_REVIVAL_GUIDE.md` §20.
