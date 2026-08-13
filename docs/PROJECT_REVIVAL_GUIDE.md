# PROJECT REVIVAL GUIDE — NexusEdu

> **Single authoritative operational guide.** Start here if you are
> reviving, operating, or rebuilding this project. Everything below is
> derived from the current repository (Stage 16, 2026-08-11). Where code
> and prose disagree, **trust the code** and update this file.

---

## 1. Project identity

**NexusEdu** — a mobile-first, PWA-enabled online video-streaming platform
for HSC (Bangladesh higher-secondary) students covering **Physics,
Chemistry and Higher Math**.

- Product: browse a catalog of subjects → cycles → chapters → videos,
  redeem enrollment codes for paid chapters, stream video, track progress,
  take notes, receive announcements, and (admin side) manage content and
  approve manual payments.
- Users are **students** and **admins**. Authentication is handled by
  **Supabase Auth**; the backend enforces role and chapter access.
- Frontend: React 18 + TypeScript + Vite (SPA/PWA).
- Backend: Python 3.11 + FastAPI (async).
- Primary data store: **Supabase** (Postgres + Auth + PostgREST + RLS).
- Video storage/streaming: **Telegram private channels** via Pyrogram
  (MTProto). Google Drive sources are proxied through a Cloudflare Worker;
  YouTube is embedded client-side.
- Hosting model: backend on **Render**, frontend on **Netlify**, database
  on **Supabase**, CI/CD on **GitHub Actions**.

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5, React Router 6, TanStack Query 5, Zustand 5, Tailwind 3, Radix UI / shadcn, Recharts, Framer Motion |
| PWA | Vite PWA-style `public/sw.js`, web-vitals, IndexedDB (idb-keyval) |
| Backend | FastAPI 0.115, Uvicorn, Pydantic v2 / pydantic-settings, httpx |
| DB / Auth | Supabase (Postgres, Auth, PostgREST, RLS, Storage) |
| Telegram | Pyrogram 2 (MTProto streaming), python-telegram-bot 21 (Bot webhook) |
| Cache/Rate-limit | Redis (optional; in-memory fallback) |
| Observability | Prometheus metrics, Grafana dashboard, audit/activity logs |
| Infra | Docker, docker-compose, Render (`render.yaml`), Netlify (`netlify.toml`), GitHub Actions |

---

## 3. Repository map

```
.
├── src/                       # Frontend (React + TS)
│   ├── app/                   # composition: main.tsx, App.tsx (router), components
│   ├── features/              # feature-owned code (auth, catalog, video, live)
│   ├── infrastructure/        # api client, supabase, analytics, storage
│   ├── shared/                # cross-feature hooks, a11y, seo
│   ├── components/ui/         # design-system primitives (Radix/shadcn)
│   ├── components/{layout,public,brand,shared}/
│   ├── pages/                 # route pages (auth/public/student/admin)
│   └── types/                 # shared TS types
├── backend/                   # FastAPI backend
│   ├── main.py                # ASGI entry point (thin; legacy re-exports)
│   ├── app_factory.py         # app construction, middleware, lifespan
│   ├── config.py              # validated settings (pydantic-settings)
│   ├── state.py               # process-global state/caches
│   ├── runtime.py             # runtime callables + test seams
│   ├── api/                   # HTTP routers (system/catalog/streaming/progress/integrations/admin)
│   ├── domains/               # business logic (auth, catalog) — no FastAPI/Telegram
│   ├── integrations/          # Supabase, Telegram MTProto, Telegram Bot
│   ├── services/              # activity, notifications, telegram-upload, video processor
│   ├── workers/               # background upload worker
│   ├── core/                  # security, rate limiter, cache, metrics, exceptions
│   ├── middleware/            # audit + HTTP transport middleware
│   └── tests/                 # pytest suite
├── supabase/migrations/       # SQL migrations (never edit applied files)
├── scripts/                   # setup, env validation, sitemap, bot diagnosis
├── public/                    # PWA manifest, service worker, icons, robots
├── docs/                      # operational docs + history/ + operations/ + architecture-decisions/
├── AI_CONTEXT/                # compact machine-oriented knowledge layer
├── .github/workflows/         # CI, backend deploy, keep-alive
├── Dockerfile, docker-compose.yml, render.yaml, netlify.toml
└── .env.example               # full environment template
```

---

## 4. Current architecture

### 4.1 Request flow (student streaming)
1. Browser → Supabase Auth login → JWT stored in Supabase session.
2. SPA fetches catalog directly from Supabase (RLS-protected) **and** via
   backend `GET /api/catalog` (includes Telegram streaming coordinates).
3. To watch a video the SPA calls `GET /api/stream-ticket/{video_id}` with
   the JWT; backend returns a 6-hour HMAC ticket bound to `(user, video)`.
4. The `<video>` element requests `GET /api/stream/{video_id}?ticket=...`.
   Backend verifies the ticket, checks block status + chapter enrollment,
   then streams byte ranges from Telegram via Pyrogram (`stream_media`).
5. Watch progress is batched to `POST /api/progress/batch`.

### 4.2 Backend layering
- `api/*` — thin routers: validate input, enforce auth, coordinate.
- `domains/auth.py` — JWT verify, block/admin checks, chapter-access authz
  (fail-closed), HMAC stream tickets.
- `domains/catalog.py` — builds the subject/cycle/chapter/video tree and
  streaming-coordinate indexes.
- `integrations/supabase_integration.py` — the **only** module that builds
  Supabase REST/Auth URLs and holds service/anon headers.
- `integrations/telegram_client.py` — the **only** Pyrogram module.
- `integrations/telegram_bot.py` — Bot API webhook + admin commands.
- `core/` — security primitives, Redis/in-memory rate limiter, cache,
  Prometheus, error types.
- `state.py` — mutable process state (caches, clients, counters).
- `runtime.py` — callables routers import; also the legacy monkeypatch seam.

### 4.3 Frontend layering
- `app/` wires providers and the router.
- `features/auth`, `features/catalog`, `features/video`, `features/live`
  own their contexts/hooks/components and colocated tests.
- `infrastructure/` owns the API client, Supabase client, analytics and
  storage helpers.
- `components/ui/` is the design system; `shared/` is genuinely cross-cutting.

---

## 5. Accounts & external services

| Service | Purpose | Where configured |
|---|---|---|
| Supabase project | Postgres + Auth + PostgREST | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `VITE_SUPABASE_*` |
| Telegram my.telegram.org | API ID/Hash for MTProto | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` |
| Telegram session strings | Pyrogram user sessions (primary + fallback) | `PYROGRAM_SESSION_STRING[_2]` |
| @BotFather | Admin bot token | `TELEGRAM_BOT_TOKEN` |
| Private Telegram channels | Video storage + thumbnails | `*_CHANNEL_ID`, `THUMBNAIL_CHANNEL_ID` |
| Render | Backend hosting | `render.yaml`, `WEBHOOK_URL`, `PORT` |
| Netlify | Frontend hosting | `netlify.toml`, `VITE_*` build vars |
| Cloudflare Worker | Drive-file proxy | `VITE_CLOUDFLARE_WORKER_URL` |
| Redis (optional) | Distributed rate limit/cache | `REDIS_URL` |

To (re)generate a Pyrogram session string, see
`docs/TELEGRAM_RECONSTRUCTION.md`.

---

## 6. Environment variables

See **`.env.example`** (canonical, commented). Backend required variables
(the app fails fast without these):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

Backend optional:
- `JWT_SECRET` — also signs stream tickets (falls back to `ADMIN_TOKEN`,
  then an ephemeral per-boot secret).
- `ADMIN_TOKEN` — HMAC second factor for admin mutations; ≥32 chars.
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `PYROGRAM_SESSION_STRING`
  (required for streaming); `PYROGRAM_SESSION_STRING_2` fallback.
- `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`, `WEBHOOK_URL`,
  `TELEGRAM_WEBHOOK_SECRET`, `THUMBNAIL_CHANNEL_ID`.
- `REDIS_URL`, `ALLOWED_ORIGINS`, `PORT`, `TRUSTED_PROXY_HOPS`,
  `VITE_CLOUDFLARE_WORKER_URL`, `*_CHANNEL_ID`, `RENDER`, `IS_FREE_TIER`.

Frontend (`VITE_`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`,
  `VITE_CLOUDFLARE_WORKER_URL`.

> **Security:** never commit `.env`. The service key bypasses RLS and must
> never reach the frontend. Rotate any exposed credential immediately.

---

## 7. Database

- Postgres via Supabase. Schema lives in `supabase/migrations/`.
- **Migration rule:** applied migrations are immutable; schema changes go
  in a new timestamped file. Do not run ad-hoc SQL in production.
- Key tables: `profiles`, `user_roles`, `subjects`, `cycles`, `chapters`,
  `videos`, `enrollment_codes`, `chapter_access`, `pending_enrollments`,
  `watch_history`, `video_notes`, `notifications`, `announcements`,
  `activity_logs`, `audit_logs`, `system_settings`, `upload_queue`,
  `live_classes`, plus quiz/Q&A tables.
- RLS is enabled on all tenant tables. Public read for active catalog;
  users access only their own rows; admins (via `is_admin()` SQL helper)
  have full access. See `AI_CONTEXT/database.md` and the migrations in `supabase/migrations/`.

---

## 8. Authentication & authorization

- **Auth:** Supabase JWT (email/password, OAuth providers as configured).
  The backend validates the token against `/auth/v1/user` (cached 5 min).
- **Admin:** `profiles.role = 'admin'` (with a `user_roles` fallback),
  plus optional HMAC signature headers (`X-Admin-Signature`,
  `X-Admin-Timestamp`) on sensitive mutations.
- **Chapter access:** a chapter may `requires_enrollment`. Access requires
  an active `chapter_access` row (granted by code redemption or admin
  approval), admin override, or the chapter being open. Authz is
  **fail-closed** on unknown chapters.
- **Blocked users:** `profiles.is_blocked` is enforced server-side on
  streaming/ticket endpoints (cached 60 s), not just client-side.
- **Stream tickets:** short-lived HMAC tickets keep the long-lived JWT out
  of media URLs; raw `?token=` remains as a deprecated fallback.

---

## 9. APIs

- Backend base: `VITE_API_BASE_URL`. Interactive docs at `/docs` (FastAPI).
- Groups: system (`/health`, `/metrics`, `/api/warmup`, `/api/ping`),
  catalog (`/api/catalog`, `/api/refresh`, `/api/prefetch/{id}`,
  `/api/thumbnail/{id}`), streaming (`/api/stream-ticket/{id}`,
  `/api/stream/{id}`), progress/activity (`/api/progress/batch`,
  `/api/activity`), admin (`/api/admin/*`), Telegram bot
  (`/api/bot_webhook`, `/api/setup_webhook`).
- Full endpoint inventory: `AI_CONTEXT/api.md` and
  `AI_CONTEXT/api.md`.

---

## 10. Telegram

Two independent subsystems:

1. **MTProto streaming client** (`integrations/telegram_client.py`):
   primary + optional fallback session; non-blocking startup; watchdog
   reconnect; channel resolution; message LRU cache; ranged streaming;
   thumbnails. Missing credentials ⇒ backend runs but streaming returns
   503 / placeholder.
2. **Bot** (`integrations/telegram_bot.py`): webhook at `/api/bot_webhook`
   (optionally verified by `TELEGRAM_WEBHOOK_SECRET`). Commands: `/start`,
   `/help`, `/ping` (public) and `/status`, `/stats`, `/notify`, `/scan`,
   `/scan_cancel` (admin).

See `docs/TELEGRAM_RECONSTRUCTION.md`, `docs/TELEGRAM_UPLOAD_PIPELINE.md`,
`docs/TELEGRAM_STORAGE.md`. Upload pipeline: new videos in watched channels
are queued in `upload_queue`, processed by `workers/upload_worker.py`
(thumbnail extraction/variants on non-free tiers).

---

## 11. Local development

Prerequisites: Node 20, Python 3.11.

```bash
# 1. One-shot setup (installs deps, validates env, can run migrations)
python3 scripts/setup.py
# or: make setup

# 2. Configure environment
cp .env.example .env   # fill values

# 3. Run both
make dev
# frontend: http://localhost:5173 (npm run dev)
# backend:  http://localhost:8000 (uvicorn backend.main:app --reload)
```

Backend runs **without Telegram creds** (catalog/health still work);
streaming requires a valid Pyrogram session. Frontend requires
`VITE_API_BASE_URL` in dev.

---

## 12. Mobile-only development (Android)

You maintain this from a phone/tablet. Practical tasks by surface:

- **Browser-based:** GitHub code editing/PRs, Netlify & Render dashboards,
  Supabase dashboard, Telegram BotFather, Grafana/Prometheus UIs.
- **Terminal (Termux or a cloud shell):** `git`, `pytest`, `npm test`,
  `npx tsc --noEmit`, `npx eslint .`, `npx vite build`, `uvicorn`.
- **Cloud execution:** Render builds/deploys on push; GitHub Actions runs
  the full CI matrix. You do not need a local desktop to ship.
- Tips: keep changes small and per-feature; rely on CI for the full
  build/test; use `scripts/validate_env.py` before deploys. See
  `docs/operations/MOBILE_ONLY_RECOVERY.md`.

---

## 13. Testing

- Backend: `pytest backend/tests` (34 tests) — auth, catalog, streaming
  authz matrix, tickets, progress rules, upload, admin validation.
- Frontend: `npm test` (Vitest, 14 tests) — API client, enrollment codes,
  chapter-access hook, player, error boundary.
- CI runs: `typecheck`, `lint`, `test:ci`, `build` (frontend) and
  `pytest` + CodeQL (backend). See `docs/TESTING_MATRIX.md`.
- Tests live next to the code they cover (e.g. `features/video/*.test.ts`,
  `backend/tests/`).

---

## 14. Deployment

- **Frontend (Netlify):** `netlify.toml`; `npm run build` → `dist/`. Build
  requires `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_API_BASE_URL`, `SITE_URL`. GitHub Actions deploys on merge to main.
- **Backend (Render):** `render.yaml` / `Dockerfile`. Start command
  `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`. Health check
  `/health`. Redis optional.
- **Keep-alive:** `.github/workflows/keep-alive.md` workflow +
  `docs/operations/KEEP_ALIVE.md` to avoid free-tier sleep.
- Full pipeline/rollback: `docs/DEPLOYMENT_PIPELINE.md`, `docs/DEPLOYMENT.md`.

---

## 15. Monitoring & backup

- Prometheus metrics at `/metrics` (admin-token or admin JWT protected):
  request count/latency, `telegram_connected` gauge. Use `prometheus.yml`,
  `alert.rules`, `grafana-dashboard.json`.
- Structured logs; `activity_logs` (user actions) and `audit_logs`
  (admin/auth HTTP calls) in Postgres.
- Backups: managed Supabase backups; `docs/operations/db-backup.workflow.yml`
  is a scheduled pg_dump GitHub Action. See `docs/DISASTER_RECOVERY.md`.

---

## 16. Disaster recovery / rebuild from zero

If the infrastructure is lost, rebuild in this order (full details in
`docs/DISASTER_RECOVERY.md`):

1. Provision a new Supabase project; run all `supabase/migrations/` in
   timestamp order.
2. Create a Telegram bot via @BotFather; generate Pyrogram session strings;
   create/identify storage channels and record their IDs.
3. Set all env vars on Render + Netlify from `.env.example`.
4. Deploy backend (`render.yaml`/Docker) and frontend (`netlify.toml`).
5. Point the bot webhook to `https://<backend>/api/bot_webhook` (use
   `GET /api/setup_webhook` with admin auth).
6. Seed an admin: set `profiles.role='admin'` for your user.
7. Verify: `/health`, `/api/catalog`, login, stream a free video, redeem
   an enrollment code, check `/metrics`.

---

## 17. Troubleshooting

| Symptom | Check |
|---|---|
| Videos won't play / 503 | Telegram credentials/session; logs for "Telegram client is not connected"; regenerate session |
| 401 on stream | Expired/invalid JWT; blocked user; ticket expired; clock skew for HMAC |
| 403 on chapter | No `chapter_access`; chapter requires enrollment; unknown chapter (fail-closed) |
| Catalog empty/503 | `SUPABASE_URL`/service key; run `GET /api/refresh`; check migrations |
| Bot not responding | `TELEGRAM_BOT_TOKEN`, `WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET`; `/api/setup_webhook` |
| Admin actions 401 | `profiles.role='admin'`; `ADMIN_TOKEN` for HMAC endpoints |
| Rate limiting aggressive | Set `REDIS_URL`; tune `RATE_LIMIT_PER_MINUTE`; check `TRUSTED_PROXY_HOPS` |
| CORS errors | Add origin to `ALLOWED_ORIGINS` |

More: `AI_CONTEXT/troubleshooting.md`, `AI_CONTEXT/known-issues.md`.

---

## 18. Future development workflow

1. Identify the **bounded area** (auth, catalog, video, enrollment, admin,
   telegram). Change files in that area only.
2. Backend: put business rules in `domains/`, I/O in `integrations/`,
   HTTP coordination in `api/`. Add a test in `backend/tests/`.
3. Frontend: put feature code in `features/<x>/`, I/O in
   `infrastructure/`, shared primitives in `shared/`/`components/ui/`.
   Add a colocated test.
4. Run: `pytest backend/tests`, `npm run typecheck`, `npm run lint`,
   `npm test`, `npm run build`.
5. Schema changes: new migration in `supabase/migrations/`.
6. Push to a branch; CI gates the merge. Keep PRs focused.

---

## 19. Production launch checklist

- [ ] All `.env`/build vars set in Render and Netlify (no fake values).
- [ ] `JWT_SECRET` and `ADMIN_TOKEN` are strong (≥32 chars) and secret.
- [ ] `ADMIN_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` configured.
- [ ] RLS verified; admin account provisioned; test student accounts.
- [ ] Telegram sessions valid; channels resolved; thumbnails rendering.
- [ ] `/health`, `/metrics`, `/api/catalog` return expected responses.
- [ ] Free chapter streams; paid chapter returns 403 without enrollment.
- [ ] Enrollment code redemption + admin approval flow verified end-to-end.
- [ ] Backups (Supabase PITR + scheduled dump) enabled.
- [ ] Monitoring/alerts (Prometheus/Grafana or free alternative) live.
- [ ] CORS/security headers reviewed; service key not exposed to frontend.
- [ ] Run the post-deploy smoke script in `docs/TESTING_MATRIX.md` (section D).

---

# 20. PROduction Reality & External Infrastructure Reconstruction (Stage 18)

> This section reconstructs the **real-world production ecosystem** around
> the repository from code/config evidence only. It does not invent
> credentials, URLs, channels, or accounts. Status labels:
> 🟢 Known from evidence · 🟡 Unknown/needs your verification ·
> 🔴 Deleted/missing and must be recreated · 📱 doable from a phone.
> Arena cannot perform account-level actions — those are marked 🔐.

## 20.1 External dependency inventory

| Service | Category | Purpose | Evidence | Required? | Status |
|---|---|---|---|---|---|
| **Supabase** | Postgres + Auth + PostgREST + RLS | All app data, login, direct FE reads | `VITE_SUPABASE_URL`, backend `SUPABASE_*`, migrations | ✅ Required | 🟡 Project ref `jwwlnjcickeignkemvrj` is **historical**; verify it still exists or create new |
| **Render** | Backend hosting (Python web service) | Runs `uvicorn backend.main:app` | `render.yaml`, Dockerfile, `backend-deploy.yml`, last URL `nexusedu-backend-0bjq.onrender.com` | ✅ Required | 🟡 Service likely dormant/deleted after 4–5 months; recreate |
| **Netlify** | Frontend static hosting | Builds & serves the React SPA | `netlify.toml`, last URL `nexusedu.netlify.app` | ✅ Required | 🟡 Site may still exist; verify/reconnect repo |
| **Telegram (MTProto)** | Video storage/CDN + streaming | Private channels hold video bytes; Pyrogram streams ranges | `PYROGRAM_SESSION_STRING[_2]`, `*_CHANNEL_ID`, `telegram_client.py` | ✅ Required for video | 🔴 Channels/session **deleted by owner**; recreate |
| **Telegram Bot API** | Admin bot (`/status`, `/stats`, `/notify`, `/scan`) | Webhook bot via python-telegram-bot | `TELEGRAM_BOT_TOKEN`, `WEBHOOK_URL`, `telegram_bot.py` | ✅ Required (admin) | 🔴 Bot **deleted by owner**; recreate via @BotFather |
| **Cloudflare Worker** | Optional Google Drive proxy | 302-redirects Drive sources | `VITE_CLOUDFLARE_WORKER_URL`; default points at a personal account (`mdhosainp414`) | ⚪ Optional | 🟡 Only needed if you use Drive videos; supply your own or drop Drive sources |
| **GitHub Actions** | CI/CD + keep-alive | `.github/workflows/*.yml` | ci.yml, backend-deploy.yml, keep-alive.yml | ✅ Required | 🟢 In repo; needs secrets (below) |
| **Redis (Upstash/Render)** | Distributed rate-limit/cache | `REDIS_URL`; app falls back to in-memory | `core/rate_limiter.py`, `core/cache.py` | ⚪ Optional | 🟢 App runs without it (single instance) |
| **UptimeRobot (or similar)** | External uptime pings | Recommended `/api/ping` monitor (GH cron dies after 60 days idle) | docs only | ⚪ Optional | 🟡 Set up for production alerting |
| **FFmpeg binaries** | Video thumbnails/transcoding | Native subprocess in `video_processor.py` | `workers/upload_worker.py` | ⚪ Optional | 🟢 Free tier skips it; Docker image includes it only with `INSTALL_FFMPEG=1` |

## 20.2 Domain / URL map

| Role | Value found in repo | Status |
|---|---|---|
| Frontend (canonical/OG) | `https://nexusedu.netlify.app` | 🟡 last known Netlify URL — confirm in Netlify dashboard |
| Brand domain | `https://nexusedu.com` | 🟡 referenced in SEO defaults; **unknown if owned** — verify registrar/DNS |
| Backend API | `https://nexusedu-backend-0bjq.onrender.com` | 🟡 last known Render URL — confirm/recreate service |
| Database | `https://jwwlnjcickeignkemvrj.supabase.co` | 🔴/🟡 historical ref; the **real** URL comes from `VITE_SUPABASE_URL` at build and `SUPABASE_URL` at runtime |
| Telegram webhook | `<backend>/api/bot_webhook` | derived from `WEBHOOK_URL` |
| Drive proxy | `https://nexusedu-proxy.mdhosainp414.workers.dev` | 🟡 **third-party/personal account** — replace or stop using Drive |
| Sitemap | `<SITE_URL>/sitemap.xml` | set `SITE_URL` in CI |

**Important:** `robots.txt` still contains a placeholder
`https://YOUR_PRODUCTION_DOMAIN_HERE.com/sitemap.xml` and `index.html`
SEO/OG tags default to the Netlify URL. After you confirm the real domain,
set `VITE_SITE_URL` in Netlify (it drives canonical/preconnect/sitemap) and
update `public/robots.txt`. Do **not** invent a domain here.

## 20.3 Master environment-variable inventory

🔐 = secret (never commit). All backend vars go in **Render → Environment**;
all `VITE_*` go in **Netlify → Site settings → Environment variables**.

### Frontend (Netlify, build-time)
| Var | Required | Purpose | Sensitive? | How to obtain |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL | No (public) | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon public key | No (public, RLS-protected) | Supabase → API → anon public key |
| `VITE_API_BASE_URL` | ✅ | Backend base URL (e.g. `https://<your-backend>.onrender.com`) | No | Render service URL |
| `VITE_SITE_URL` | recommended | Canonical site URL for SEO/canonical/sitemap | No | Your real frontend URL (Netlify or custom domain) |
| `VITE_CLOUDFLARE_WORKER_URL` | ⚪ optional | Drive proxy | No | Your own Worker URL, only if using Drive videos |
| `SITE_URL` | for CI | Used by `npm run sitemap` | No | Same as VITE_SITE_URL (set in GitHub secrets for deploy) |

### Backend (Render, runtime)
| Var | Required | Purpose | Sensitive? | How to obtain |
|---|---|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL | No | Same as VITE_SUPABASE_URL |
| `SUPABASE_ANON_KEY` | ✅ | Anon key | No (public) | Same as VITE_SUPABASE_ANON_KEY |
| `SUPABASE_SERVICE_KEY` | ✅ | Service-role key (bypasses RLS) | 🔐 YES | Supabase → API → service_role key (NEVER expose to frontend) |
| `JWT_SECRET` | ✅ | Signs stream tickets; ≥32 chars | 🔐 | Generate (e.g. password manager / `openssl rand -hex 32`) |
| `ADMIN_TOKEN` | ✅ for HMAC admin ops | Signs admin mutations; ≥32 chars | 🔐 | Generate |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins | No | Your Netlify URL (+ custom domain) |
| `PORT` | auto | Render sets this | No | Render provides it |
| `TELEGRAM_API_ID` | ✅ for video | MTProto API ID | No (treat as sensitive) | https://my.telegram.org → API development tools 📱 |
| `TELEGRAM_API_HASH` | ✅ for video | MTProto API hash | 🔐 | my.telegram.org |
| `PYROGRAM_SESSION_STRING` | ✅ for video | Primary session string (video access) | 🔐 | Generate with `scripts/get_channel_id.py` flow or Pyrogram login |
| `PYROGRAM_SESSION_STRING_2` | ⚪ optional | Fallback session | 🔐 | Same |
| `TELEGRAM_BOT_TOKEN` | ✅ for admin bot | Bot token from @BotFather | 🔐 | @BotFather → /newbot or existing token |
| `TELEGRAM_WEBHOOK_SECRET` | recommended | Verifies webhook origin | 🔐 | Generate random string; set in bot & Render |
| `ADMIN_CHAT_ID` | ✅ for bot admin | Your numeric Telegram ID(s), comma-separated | No | Message @userinfobot to see your ID 📱 |
| `WEBHOOK_URL` | ✅ for bot | Public bot webhook: `https://<backend>/api/bot_webhook` | No | Render backend URL + path |
| `THUMBNAIL_CHANNEL_ID` | recommended | Private channel for thumbnails (starts `-100`) | No | Create channel; get ID via `scripts/get_channel_id.py` |
| `PHY_C1..C6`, `CHE_C1..C6`, `HM_C1..C6` | ✅ for video | 18 storage channel IDs (Physics/Chemistry/Math cycles) | No | Create channels; get IDs; map to cycles in DB |
| `REDIS_URL` | ⚪ optional | Redis for rate limiting/cache | 🔐 | Upstash/Render Redis; omit for in-memory |
| `TRUSTED_PROXY_HOPS` | ⚪ optional | For real client IP behind Render proxy (default 1) | No | Leave default |
| `RENDER` / `IS_FREE_TIER` | auto | Free tier skips ffmpeg | No | Render sets `RENDER=true`; set `IS_FREE_TIER=false` only on paid + ffmpeg image |

> Note: `VITE_API_URL` appears in the root `.env.example` but is **not read**
> by current code (only `VITE_API_BASE_URL` is). It is harmless/legacy.

## 20.4 Telegram reconstruction (mobile-friendly)

The previous 18 storage channels and the bot were deleted and **cannot be
recovered**. You must recreate them. Full detail also lives in
`docs/TELEGRAM_RECONSTRUCTION.md`.

1. **Get API credentials (phone):** open https://my.telegram.org in your
   phone browser → log in with your Telegram account number → "API
   development tools" → create an app → copy `api_id` and `api_hash`.
   🔐 Keep the hash private.
2. **Create the bot (phone/Telegram app):** open @BotFather in Telegram →
   `/newbot` → follow prompts → copy the **bot token**. Optionally
   `/setcommands` and turn on privacy mode off if needed.
3. **Find your admin ID:** message @userinfobot; it replies with your
   numeric ID — that is `ADMIN_CHAT_ID`.
4. **Create channels:** In Telegram, "New Channel" for each storage
   location: one **thumbnail channel** + up to **18 storage channels**
   (`PHY_C1..6`, `CHE_C1..6`, `HM_C1..6`). Make them **private**. Add
   your **MTProto user account** (the account that will generate the
   session string) as an admin with posting rights, and add the **bot** as
   admin where it needs to post (notifications channel).
5. **Get channel IDs:** run `python scripts/get_channel_id.py` (a
   terminal/cloud environment with TELEGRAM_API_ID/HASH set) and enter each
   channel's `@username` or invite link; it prints the negative `-100...`
   ID. Record each → the matching `*_CHANNEL_ID` variable.
6. **Generate a session string:** in a terminal/cloud shell run the Pyrogram
   login (the `get_channel_id.py` script will also create a session). It
   asks for your phone number and login code; output is the
   `PYROGRAM_SESSION_STRING`. 🔐 Treat it like a password — it grants full
   access to that Telegram account.
7. **Configure Render:** add every Telegram variable above to the Render
   backend service environment.
8. **Set the webhook:** after the backend is deployed, open
   `https://<backend>/api/setup_webhook` while logged in as an admin (or
   the bot sets it automatically on startup). Verify with `/start` to the
   bot in Telegram.
9. **Upload a test video:** post a video directly into one storage channel;
   the `telegram_upload_service` queues it; the worker links metadata.
   Then create a `videos` row (admin panel) with the matching
   `telegram_channel_id` + `telegram_message_id`.
10. **Verify streaming:** open the app, navigate to that video, press play,
    seek (tests Range requests). `/status` and `/stats` in the bot should
    show the client connected.

**Failure recovery:** if streaming returns 503, the session string is
invalid/expired or the account is not a member of the channel — regenerate
the string and re-add the account. If the bot doesn't respond, verify
`WEBHOOK_URL` is public and `TELEGRAM_WEBHOOK_SECRET` matches.

## 20.5 Database reality

- **Schema source of truth:** `supabase/migrations/` applied in filename
  order. **`20260810000000_stage2_schema_reconciliation.sql` is mandatory**
  on a fresh database (it adds columns the code reads, e.g.
  `profiles.role`, `videos.file_size_bytes`, `audit_logs.user_id`,
  `enrollment_codes.cycle_id`).
- **Required extensions:** `uuid-ossp`, `pg_trgm` (auto-created by
  migrations).
- **Critical RPC used by the app:** `use_chapter_enrollment_code(...)`
  (atomic code redemption, cycle-aware). Also `is_admin()`,
  `check_chapter_access(...)`.
- **RLS** is enabled on all tenant tables; never disable it. The
  service-role key bypasses RLS and must stay server-only.
- **Initial data needed:** an admin row — after signup, set
  `profiles.role = 'admin'` for your user (Supabase SQL editor, phone).
- **Data categories:**
  - *Schema*: reproducible from migrations (recoverable).
  - *User data* (profiles, watch_history, notes, enrollments): **only in
    the database** — enable Supabase backups + set `SUPABASE_DB_URI` for
    the weekly dump workflow.
  - *Video bytes*: **only in Telegram channels** — Telegram is **not**
    durable backup. Keep original source files on at least one external
    drive/cloud; the 2026 deletion proved this risk.
  - *Secrets/env*: not stored anywhere in the repo by design; you must
    keep a private offline record.

## 20.6 CI/CD reality (GitHub Actions)

| Workflow | Runs | Deploys? | Secrets needed |
|---|---|---|---|
| `.github/workflows/ci.yml` | every push/PR | ✅ to Netlify on `main` | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, `SITE_URL` |
| `.github/workflows/backend-deploy.yml` | push to `main` touching `backend/**` | triggers Render via hook | `RENDER_DEPLOY_HOOK` (or Render auto-deploy) |
| `.github/workflows/keep-alive.yml` | every 10 min | pings backend to avoid free-tier sleep | none (hardcoded last URL — update if backend URL changes) |

⚠️ The keep-alive workflow pings the **historical**
`nexusedu-backend-0bjq.onrender.com`. After recreating the Render service,
update the URL in `.github/workflows/keep-alive.yml` (or set a
`BACKEND_URL` variable). GitHub disables scheduled workflows after 60 days
of repo inactivity — re-enable manually in the Actions tab after a break.

## 20.7 Production gap analysis (ranked)

- **P0 — blocks startup:** `SUPABASE_URL/ANON/SERVICE` for backend;
  `VITE_SUPABASE_*` + `VITE_API_BASE_URL` for frontend; `JWT_SECRET`,
  `ADMIN_TOKEN`. (Code refuses to boot without the required Supabase vars.)
- **P0 — blocks video:** Telegram API creds + valid session string +
  storage channel IDs (recreate deleted Telegram infra).
- **P1 — blocks admin:** `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`,
  `WEBHOOK_URL`; an admin profile row.
- **P1 — fresh database:** run all migrations incl. the Stage-2
  reconciliation file.
- **P2 — operational risk:** set `SUPABASE_DB_URI` (backups), external
  uptime monitor, verify real domain/SEO URLs, update keep-alive URL,
  set `TELEGRAM_WEBHOOK_SECRET`.
- **P3 — improvements:** `REDIS_URL` for multi-instance rate limiting;
  custom domain + HTTPS; replace personal Cloudflare Worker if using Drive.

## 20.8 Human action matrix

| Action | Who | Phone? | Priority |
|---|---|---|---|
| Create/verify Supabase project, run migrations, set admin role | 🔐 owner | 📱 Supabase web app | P0 |
| Create Render backend service + add env vars | 🔐 owner | 📱 Render dashboard | P0 |
| Create/connect Netlify site + add build env vars + GitHub secrets | 🔐 owner | 📱 | P0 |
| Generate Telegram API ID/hash, bot token, session string | 🔐 owner | 📱 + optional cloud shell | P0 |
| Create 18 storage + thumbnail channels and record IDs | 🔐 owner | 📱 Telegram app | P0 |
| Set `SUPABASE_DB_URI` secret to enable backups | 🔐 owner | 📱 GitHub settings | P2 |
| Update keep-alive workflow URL after backend is known | can be done in Arena (code) once URL known | — | P2 |

## 20.9 Production reconstruction checklist (do in order)

- [ ] **ACCOUNTS:** confirm access to GitHub, Supabase, Render, Netlify, Telegram.
- [ ] **SUPABASE:** create/open project → run all `supabase/migrations/` in order → copy URL + anon + service keys.
- [ ] **RENDER:** create web service from repo (`pip install -r backend/requirements.txt`, `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`) → add all backend env vars → deploy.
- [ ] **NETLIFY:** connect repo → set build `npm run build`, publish `dist` → add all `VITE_*` vars.
- [ ] **GITHUB SECRETS:** add Netlify token/site id + VITE vars so CI deploys.
- [ ] **TELEGRAM:** API creds → create bot → create channels → IDs → session string → set Render vars → set webhook.
- [ ] **ENVIRONMENT VARIABLES:** cross-check every row in §20.3 is set.
- [ ] **DATABASE MIGRATIONS:** confirm Stage-2 reconciliation migration applied; set your user `role='admin'`.
- [ ] **DEPLOY:** push to `main` (or trigger); confirm frontend + backend boot.
- [ ] **MONITORING:** open `/health`, `/metrics`, `/api/catalog`; set up UptimeRobot `/api/ping`.
- [ ] **BACKUPS:** enable Supabase PITR; set `SUPABASE_DB_URI`; schedule weekly dump.
- [ ] **TEST DATA:** upload one video to a channel, link it, verify streaming + seeking; create a test enrollment.
- [ ] **END-TO-END:** run the post-deploy smoke script in `docs/TESTING_MATRIX.md` §D from your phone.

## 20.10 Current status (honest)

- ✅ **Code-complete and locally validated:** 39 backend tests, 14 frontend
  tests, typecheck/lint/build pass, GZip/streaming proven safe.
- 🟡 **Infrastructure unknown:** the exact state of the 4–5-month-old
  Supabase/Render/Netlify resources cannot be determined from the repo and
  must be verified by you in each provider's dashboard.
- 🔴 **Telegram must be rebuilt** (channels + bot were intentionally deleted).
- 🔴 **No running production is assumed** — treat as a reconstruction.
- ⏸️ Not production-ready until the P0/P1 items above are completed; this
  stage makes those requirements explicit, it does not launch production.

---

# 21. ZERO-TO-PRODUCTION REBUILD (definitive runbook)

> This section is the **single ordered procedure** for rebuilding NexusEdu
> from an empty account state using only a phone, a browser, GitHub, Arena,
> and the provider dashboards. You do **not** need to remember anything
> from old sessions. Follow the checkpoints in order — **do not skip
> ahead**, because later steps depend on values created in earlier ones.
>
> Legend: 📱 phone-only · 📱💻 phone + cloud terminal · 🔐 only you can do
> it (account access) · 🤖 Arena/CI can prepare · ❌ Arena cannot do it.
>
> **Keep all secrets in a password manager. Never type them into GitHub,
> Arena chat, or email.**

## 21.1 The real dependency graph (and why this order)

```
You (accounts)
  └─▶ GitHub repo (code + CI)
        └─▶ Supabase project (database + auth)  ← backend & frontend need URL/keys
              └─▶ Render backend service        ← needs Supabase URL/keys
        └─▶ Netlify frontend site               ← needs Supabase + backend URLs
        └─▶ Telegram (API creds, bot, channels, session)  ← backend needs these
              └─▶ Render env vars (Telegram values) → redeploy backend
                    └─▶ End-to-end smoke test → backups/monitoring
```

Database exists **before** backend because the backend refuses to boot
without `SUPABASE_URL/ANON/SERVICE`. Backend exists **before** Telegram
webhook (the webhook must point at a live URL). Telegram values go into
Render **before** the final restart so streaming works on first boot.
Netlify needs both the Supabase and backend URLs at build time.

## 21.2 Accounts you need (CHECKPOINT A — accounts ready)

| Account | Purpose | Required | Billing |
|---|---|---|---|
| GitHub | Code + CI/CD | ✅ | Free |
| Supabase | Postgres + Auth | ✅ | Free tier to start |
| Render | Backend hosting | ✅ | Smallest paid instance (free web tier discontinued; do not use a sleeping plan for streaming) |
| Netlify | Frontend hosting | ✅ | Free |
| Telegram | Video storage + admin bot | ✅ | Free |
| UptimeRobot (optional) | Uptime alerts | ⚪ | Free |
| Domain registrar (optional) | Custom domain | ⚪ | Paid |

**Mobile steps (each provider):** open the site in your phone browser →
sign up / log in (use a strong password + 2FA where available) → confirm
your email. **Verification:** you can see the dashboard of each service.
**Stop condition:** do not continue until you can log in to GitHub,
Supabase, Render, Netlify, and Telegram. **If 2FA recovery codes are
shown, save them in your password manager.**

## 21.3 GitHub (CHECKPOINT B — code ready)

- **Objective:** have your copy of the repository and let Actions run CI.
- **Where:** GitHub (📱) and Arena.
1. In Arena/GitHub, create or open the repository containing this code.
2. GitHub → repo → **Settings → Actions → General** → ensure Actions are
   allowed. Note the default branch is `main`.
3. Settings → Secrets and variables → Actions → **Variables** → add
   `BACKEND_URL` later (after Render exists, §21.7).
- **Verification:** you can open the repo in the phone browser and see the
  file list; the Actions tab exists.
- **Stop condition:** don't configure deploy secrets yet (they don't exist
  until later steps).

## 21.4 Supabase — database & auth (CHECKPOINT C — database ready)

- **Objective:** a live Postgres with the schema, RLS, and RPCs; obtain
  the URL + anon + service key.
- **Where:** Supabase dashboard (📱 for project/SQL; a wide screen helps).

**Step 1 — create project:** New project → pick a name/region (choose the
region closest to your audience, e.g. Singapore/Asia) → set a strong
**database password** (save it). Wait ~2 minutes for provisioning.

**Step 2 — copy credentials:** Project → **Settings → API**. Copy, into
your password manager:
- **Project URL** (looks like `https://<ref>.supabase.co`) → `SUPABASE_URL` / `VITE_SUPABASE_URL`
- **anon public** key → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
- **service_role** key (🔐 SECRET) → `SUPABASE_SERVICE_KEY` (backend only)

**Step 3 — apply schema (run migrations in order):** Project → **SQL
Editor → New query**. Migrations are in `supabase/migrations/`. You run
them in filename order (see note below about ordering). The easiest
mobile path:
1. Open each `.sql` file in the GitHub repo (or Arena) in order.
2. Copy its contents, paste into the Supabase SQL editor, click **Run**.
3. Wait for "Success" before the next file.

Apply these **in this exact order** (filenames start with a sortable
timestamp; `0001_*` and `0002_*` run first because they begin with `0`):
`0001_secure_quiz_attempts` → `0002_drop_old_quiz_attempts` →
`20260501161500...` → `20260502000000_complete_schema` →
`20260502161709_add_resources_table` → `20260502163201_add_pending_enrollments` →
`20260502185606_add_thumbnail_to_videos` → `20260503000000_audit_security` →
`20260503000000_security_and_optimization` → `20260503000001_upload_pipeline` →
`20260504000000_subscriptions` → `20260505000000_add_thumbnail_message_id` →
`20260505000001_db_optimizations` → `20260515000000_dashboard_additions` →
`20260729230600_restore_is_admin_policies` → `20260729230601_fix_quiz_attempts_definer` →
`20260810000000_stage2_schema_reconciliation` (**mandatory**).

> 💡 Easier (if you can use a cloud shell / Arena terminal): run
> `npx supabase login` then `npx supabase link --project-ref <ref>` then
> `npx supabase db push`. The SQL-editor method requires no computer.

**Step 4 — verify schema:** In **Table Editor** you should see tables
including `profiles`, `subjects`, `cycles`, `chapters`, `videos`,
`enrollment_codes`, `chapter_access`, `watch_history`, `notifications`,
`activity_logs`, `audit_logs`, `pending_enrollments`. In SQL Editor run:
```sql
select extname from pg_extension where extname in ('uuid-ossp','pg_trgm');
select proname from pg_proc where proname in ('is_admin','use_chapter_enrollment_code','check_chapter_access');
```
**Expected:** both extensions listed; all three functions listed.

**Step 5 — create your admin (after you sign up in §21.10):** once your
user exists, run:
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```
**If it fails:** the user hasn't signed up yet (do it after first login);
check the email is correct.

**Stop condition:** backend cannot be deployed until Steps 1–3 succeed and
you have the three credentials saved. Do **not** disable RLS. Do **not**
share the service key.

## 21.5 Render — backend (CHECKPOINT D — backend ready)

- **Objective:** backend running at a public `*.onrender.com` URL.
- **Where:** Render dashboard (📱).

1. **New → Blueprint** → connect your GitHub repo → Render reads
   `render.yaml` and creates `nexusedu-backend`. (If Blueprint isn't
   available on mobile, use **New → Web Service → Python** and set Build
   `pip install -r backend/requirements.txt`, Start
   `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, health `/health`.)
2. **Environment → add variables** from §20.3 (required now):
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`,
   `JWT_SECRET` (≥32 chars — generate one), `ADMIN_TOKEN` (≥32 chars),
   `ALLOWED_ORIGINS` (your Netlify URL once known; you can come back).
   Telegram values are added in §21.8.
3. Deploy. Open **Logs**. Wait for "===== BACKEND READY =====".
4. Visit `https://<your-backend>.onrender.com/health` in the browser.
   **Expected:** `{"status":"healthy"}`.
5. Visit `/api/health` — expected JSON with
   `"telegram_configured": false or true` and `"supabase": "connected"`.

**If `/health` fails:** check Logs. `FATAL ERROR: Missing required
environment variables` → add the missing SUPABASE vars. Database
connection error → verify URL/key and that migrations ran. App crashed on
boot → confirm `startCommand` is exactly `uvicorn backend.main:app ...`.
**Stop condition:** don't proceed until `/health` returns healthy. Note
the backend URL → you'll use it as `VITE_API_BASE_URL`, `WEBHOOK_URL`,
and `BACKEND_URL`.

## 21.6 Netlify — frontend (CHECKPOINT E — frontend ready)

- **Objective:** the live PWA, talking to Supabase + backend.
- **Where:** Netlify dashboard (📱).

1. **Add new site → Import from Git** → choose your repo → branch `main`.
2. Build command `npm run build`; publish directory `dist` (these are also
   in `netlify.toml`).
3. **Site settings → Environment variables** add:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same as Supabase),
   `VITE_API_BASE_URL` = your Render backend URL (no trailing slash),
   `VITE_SITE_URL` = this Netlify URL (e.g. `https://<name>.netlify.app`),
   optionally `VITE_CLOUDFLARE_WORKER_URL`.
4. Trigger a deploy. When it's live, open the site URL on your phone.
5. **Verify:** the app loads, you see the login screen, no blank screen.
   Browser console (if available) shouldn't show Supabase connection
   errors. Create an account and confirm you land on the dashboard.

**If the site is blank:** check Netlify deploy logs; confirm
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set and redeploy (Vite
bakes them in at build time). If API calls fail, confirm
`VITE_API_BASE_URL` is the HTTPS Render URL.
**Stop condition:** don't continue until the site loads and signup works.

## 21.7 GitHub CI/CD secrets (connect automatic deploys)

In GitHub → Settings → Secrets and variables → Actions → **Secrets**, add:
`NETLIFY_AUTH_TOKEN` (Netlify → User → Applications → New token),
`NETLIFY_SITE_ID` (Netlify → Site settings → Site ID),
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`,
`SITE_URL`. Under **Variables** add `BACKEND_URL` = Render backend URL.
Optionally add `RENDER_DEPLOY_HOOK` (Render → Deploy hook) to auto-deploy
the backend on `backend/**` pushes.
**Verification:** push a tiny change (or run the `ci.yml` workflow
manually via Actions → Run workflow); the deploy job should reach Netlify.

## 21.8 Telegram from zero (CHECKPOINT F — Telegram ready)

You need: API credentials, a bot, storage channels, a thumbnail channel,
and a session string. The backend uses 18 *possible* channel slots
(`PHY_C1..C6`, `CHE_C1..C6`, `HM_C1..C6`) for auto-queueing uploads;
actual streaming reads channel IDs from each `videos` row, so you may start
with **one** storage channel and add more later.

1. **API credentials (🔐 my.telegram.org, 📱):** log in with the phone
   number of the Telegram account that will own the videos → API
   development tools → create app → save `api_id` (`TELEGRAM_API_ID`) and
   `api_hash` (🔐 `TELEGRAM_API_HASH`). Use your **real** account (not a
   disposable one); you must be a member/owner of the storage channels.
2. **Bot (📱 Telegram app → @BotFather):** `/newbot` → name/username →
   copy the token (🔐 `TELEGRAM_BOT_TOKEN`). Then `/setsecret` → choose
   the bot → enter a random string (this is `TELEGRAM_WEBHOOK_SECRET`).
   Optionally `/setcommands`, `/setdescription`.
3. **Your admin ID (📱):** message **@userinfobot**; copy the numeric ID →
   `ADMIN_CHAT_ID` (supports comma-separated IDs for multiple admins).
4. **Create channels (📱 Telegram app):** "New Channel" → **private**.
   Create: (a) one **thumbnail** channel, and (b) one or more **storage**
   channels (up to 18). For each channel: add your **user account** (the
   one used for the session string) as admin with **Post messages**, and
   add the **bot** as admin (needed for /notify and scanning). Use a clear
   naming convention, e.g. `NexusEdu — Physics C1`, `… — Thumbnails`.
5. **Get channel IDs (📱💻):** post any message in each channel, then run
   in a cloud/Arena shell (with `TELEGRAM_API_ID`/`TELEGRAM_API_HASH`
   exported): `python scripts/get_channel_id.py` and paste the channel
   `@username` or invite link; it prints the `-100…` ID. Record each:
   thumbnail → `THUMBNAIL_CHANNEL_ID`; storage channels →
   `PHY_C1_CHANNEL_ID`, `CHE_C1_CHANNEL_ID`, etc. (Unused slots can be
   left at `0`).
6. **Generate the session string (📱💻):** run
   `python scripts/get_channel_id.py` (or any Pyrogram login) without a
   `PYROGRAM_SESSION_STRING` — it prompts for your phone + login code
   (and 2FA password if enabled) and prints a **session string**. 🔐 Copy
   it → `PYROGRAM_SESSION_STRING`. This string grants full access to that
   Telegram account — protect it like a password.
7. **Put values in Render:** add `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`,
   `PYROGRAM_SESSION_STRING`, `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_CHAT_ID`, `THUMBNAIL_CHANNEL_ID`,
   `WEBHOOK_URL` = `https://<backend>/api/bot_webhook`, the
   `*_CHANNEL_ID`s, and `BOT_NOTIFY_ON_START=true`. Save → Render
   redeploys.

**Verification after restart:**
- Backend logs show "primary client started" / "Bot manager initialized".
- Open `https://<backend>/api/channels/health` (while logged in as admin
  or with the admin token) → channels resolve without errors.
- In Telegram, send `/start` to your bot → it replies. Send `/status` →
  it shows "Webhook: ✅ Set".
**If the bot doesn't respond:** verify `WEBHOOK_URL` is public HTTPS,
`TELEGRAM_WEBHOOK_SECRET` matches what you set in BotFather, and the bot
token is correct. **If streaming shows 503:** the session string is
invalid/expired or the account isn't in the channel — regenerate it.

## 21.9 Upload a test video & map it (CHECKPOINT G — integrated)

1. Post a short video directly into a storage channel (as your user
   account). The upload service queues it automatically; the worker links
   metadata (thumbnails are processed only if ffmpeg is installed — on
   free tier they're skipped, which is fine).
2. Note the **message id** of that post (open the post, copy link; the
   trailing number is the message id) and the channel's `-100…` ID.
3. In the app's **Admin → Content**, add a Subject/Cycle/Chapter and a
   Video with `source_type = telegram`, `telegram_channel_id` = the
   channel ID, `telegram_message_id` = the message id.
4. Open the video as a student and press play.
**Verification:** video starts; seeking works (Range requests); the bot
`/stats` shows the connected client.

## 21.10 Master smoke test (CHECKPOINT H — production verified)

Do these on your phone after full deploy. "Blocks launch?" = yes means it
must pass before going live.

| # | Action | Expected | If it fails | Blocks? |
|---|---|---|---|---|
| 1 | Open frontend URL | Login screen loads | Check Netlify deploy + VITE vars | ✅ |
| 2 | Create account / log in | Dashboard loads | Check Supabase URL/anon; verify email | ✅ |
| 3 | Browse catalog | Subjects/chapters list appears | Check `is_active` rows / migrations | ✅ |
| 4 | Open a free video | Plays, seek works | Check backend health + Telegram session | ✅ |
| 5 | Open a locked chapter | Shows locked/enrollment prompt | `requires_enrollment` flag correct | ⚪ |
| 6 | Redeem a valid enrollment code | Chapter unlocks | Code exists/unused; RPC applied | ⚪ |
| 7 | Submit invalid code | Error shown | (expected) | ❌ |
| 8 | Watch progress, reopen | Position resumes | `watch_history` RLS/upsert | ⚪ |
| 9 | Log out / log back in | Session persists | Supabase auth config | ⚪ |
| 10 | Promote your user admin (`role='admin'`) | Admin panel appears | Run the SQL in §21.4 step 5 | ✅ |
| 11 | Admin dashboard loads | Metrics render | `get_admin_stats` RPC exists | ⚪ |
| 12 | Bot `/start`, `/status`, `/stats` | Replies correctly | Webhook/secret/bot token | ⚪ |
| 13 | `GET /health`, `/metrics` | healthy; metrics (admin) | Backend logs | ✅ |
| 14 | Block a test user (`is_blocked=true`) | Streaming returns 403 within 60s | Backend block cache | ⚪ |
| 15 | Stop Telegram (bad session) | Streams 503 gracefully, site stays up | Expected isolation | ❌ |

The complete script lives in `docs/TESTING_MATRIX.md` §D.

## 21.11 Monitoring, backups & durability (CHECKPOINT I — complete)

- **Uptime (📱):** create a free UptimeRobot monitor → HTTP(s) →
  `https://<backend>/api/ping` every 5 min, and one for the frontend URL.
  (GitHub's keep-alive cron disables after 60 days idle — don't rely on it
  alone; you set `BACKEND_URL` in §21.7 to enable it.)
- **Database backups:** enable Supabase Point-in-Time-Returns on a paid
  plan if possible; either way, add GitHub secret `SUPABASE_DB_URI` and
  copy `docs/operations/db-backup.workflow.yml` to
  `.github/workflows/db-backup.yml` (GitHub web UI) to get weekly dumps.
- **Video durability (CRITICAL):** Telegram is the *only* place video
  bytes live. **Keep the original source files** on at least one external
  drive/cloud. The 2026 channel deletion proved this is necessary.
- **Secrets durability:** maintain an offline copy (password manager) of:
  Supabase service key, DB password, `JWT_SECRET`, `ADMIN_TOKEN`,
  Telegram API hash, bot token, and `PYROGRAM_SESSION_STRING`.

## 21.12 Production failure recovery (symptom → action)

| Symptom | First check | Then | Safe action |
|---|---|---|---|
| Frontend blank/down | Netlify deploy status | `VITE_*` build vars | Redeploy with correct vars |
| Backend 503 / asleep | Render service state | `/health` and logs | Wake via UptimeRobot/Actions; verify env vars |
| Login broken | Supabase project status | URL/anon key, Auth providers | Re-check `VITE_SUPABASE_*`; do not reset the DB |
| Videos won't play | Telegram session/channels | `/api/channels/health`, logs | Regenerate session string; confirm account is in channel |
| Bot stops responding | Render logs, webhook | `WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET` | Re-set secret in BotFather + Render; `GET /api/setup_webhook` |
| Migration fails | SQL error message | Which file/order | Re-run after fixing syntax; do **not** edit applied migrations |
| Missing env var (boot crash) | Render logs | FATAL ERROR names the var | Add the named variable; redeploy |
| Domain/SSL issue | Netlify domain settings | DNS records | Re-point DNS to Netlify; don't change code |
| GitHub deploy fails | Actions run log | Failing step | Fix the reported test/build; don't bypass CI |
| Rate-limit false positives | `TRUSTED_PROXY_HOPS` | Render proxy count | Leave at 1 unless behind extra proxies |

**Escalation:** if a safe action doesn't restore service in ~15 minutes,
restore from the latest DB backup (Supabase dashboard / weekly artifact)
and roll back the last deploy (Render/Netlify → Deploys → previous), then
investigate. Never run ad-hoc DELETE/UPDATE SQL without a backup.

## 21.13 ⛔ DO NOT TOUCH (non-technical owner)

- **Supabase service key & `PYROGRAM_SESSION_STRING`**: grant total access;
  never put them in the frontend, GitHub files, Arena chat, or email.
- **`JWT_SECRET` / `ADMIN_TOKEN`**: changing `JWT_SECRET` invalidates all
  existing stream tickets/sessions; only rotate during scheduled
  maintenance.
- **Migrations**: never edit a file already applied to the database.
  Schema changes go in a **new** timestamped file in
  `supabase/migrations/`.
- **RLS policies**: don't disable RLS "to fix access" — it exposes all
  user data.
- **Channel↔video mapping**: changing a channel ID or moving videos
  breaks `videos.telegram_channel_id`/`telegram_message_id`; update the DB
  rows deliberately.
- **Render start command**: must stay `uvicorn backend.main:app ...`;
  changing it can stop the service from booting.

## 21.14 Production readiness gap matrix

| Area | Repository ready? | External setup needed | Owner action | Blocker? |
|---|---|---|---|---|
| GitHub | ✅ | enable Actions, add secrets | 📱🔐 | Until secrets set |
| Supabase | ✅ (migrations) | create project, run SQL, save keys | 📱🔐 | P0 |
| Render | ✅ (render.yaml/Dockerfile) | create service, add env | 📱🔐 | P0 |
| Netlify | ✅ (netlify.toml) | create site, add build vars | 📱🔐 | P0 |
| Telegram | 🔴 code only | API creds, bot, channels, session | 📱💻🔐 | P0 for video |
| Domain | ⚪ optional | buy/configure DNS | 🔐 | P3 |
| Secrets/backups | code present | offline copy + `SUPABASE_DB_URI` | 📱🔐 | P2 |
| Monitoring | `/health`, `/metrics`, bot | UptimeRobot | 📱 | P2 |

**No code blockers remain.** Going live requires only the external/account
actions above (P0 items). The repository cannot perform them for you.

## 21.15 What Stage 20 should address

After the infrastructure exists and the §21.10 smoke test passes against a
real deployment, Stage 20 would be the natural point for: (1) first
paid-enrollment end-to-end verification on the live stack, (2) performance
verification under real concurrency (the Stage 17 triggers), (3) backup
restore drill, and (4) — only if still desired later — the future
centralized admin/control plane (not built in these stages).

---

# 22. STAGE 20 — LIVE-READINESS VERIFICATION & SECURITY HARDENING

Independent pre-launch audit performed against the actual code/config (not
previous reports). This section records concrete fixes and the final
go/no-go items. Automated tests cannot verify external infrastructure;
items requiring your real accounts are marked 👤 EXTERNAL VERIFICATION.

## 22.1 Code/config fixes applied in Stage 20

1. **RLS hardening (NEW MIGRATION — apply it):**
   `supabase/migrations/20260811120000_stage20_rls_hardening.sql`
   enables RLS on `audit_logs`, `error_logs`, `user_sessions`,
   `videos_temp` (backend-only, no public access) and adds an owner-only
   policy on `push_subscriptions`. **You MUST run this migration after
   the others** in the Supabase SQL editor. It is additive and idempotent.
2. **Admin user endpoints UUID validation:** `/api/admin/users/{id}/*` now
   type `user_id` as a UUID, so non-UUID values are rejected (422) before
   any query is built (defense against PostgREST filter injection).
3. **Removed hardcoded deleted-service fallback:** the frontend no longer
   defaults `VITE_API_BASE_URL` to the old `nexusedu-backend-0bjq.onrender.com`.
   If the variable is missing in production, the app logs a clear error
   instead of calling a dead/foreign host.
4. **Complete `.env.example`:** now lists all 18 `*_CHANNEL_ID` slots,
   `VITE_SITE_URL`, `TELEGRAM_WEBHOOK_SECRET`, `TRUSTED_PROXY_HOPS`,
   `RENDER`, `IS_FREE_TIER`, `BOT_NOTIFY_ON_START` (several were
   previously undocumented). `backend/.env.example` is synced to it.
5. **`robots.txt`** sitemap reference is now relative (no invented domain).
6. **`render.yaml`** is backend-only (the previous conflicting static
   frontend service was removed — the frontend is on Netlify).

## 22.2 Security audit results (evidence-based)

| Area | Result |
|---|---|
| Authentication (Supabase JWT) | 🟢 verified — token validated/cached; tickets HMAC-signed |
| Authorization (chapter access) | 🟢 fail-closed on unknown chapters; test matrix covers it |
| Admin access | 🟢 role check + optional HMAC; UUID validation added |
| Telegram webhook | 🟢 secret compared with `hmac.compare_digest` when set |
| SQL injection | 🟢 no raw SQL string interpolation from user input; UUID whitelists |
| Command injection | 🟢 no `shell=True`; ffmpeg uses argv (not user-controlled) |
| SSRF | 🟢 outbound calls only to configured Supabase/Telegram/Cloudflare |
| Secrets in repo | 🟢 only fake placeholders in `.env.example`; no real JWTs |
| RLS | 🟡 fixed in code/migration — **you must apply the new migration** |
| CORS | 🟢 explicit origins; PUT/PATCH/DELETE allowed |
| Rate limiting | 🟢 in-memory + optional Redis; per-route limits |
| Service-key exposure | 🟢 backend-only; never sent to frontend |

## 22.3 Final live-readiness matrix

| Area | Repository ready? | External / owner action |
|---|---|---|
| Code (builds, tests pass) | ✅ 40 backend + 14 frontend tests | — |
| Supabase schema | ✅ migrations complete | 👤 create project, run all 18 migrations incl. Stage 20 RLS |
| Backend deploy | ✅ render.yaml/Dockerfile | 👤 create Render service + env vars |
| Frontend deploy | ✅ netlify.toml | 👤 create Netlify site + VITE_* vars |
| Telegram | 🔴 code only | 👤 recreate bot + channels + session string |
| Secrets | code present | 👤 generate JWT_SECRET/ADMIN_TOKEN/WEBHOOK_SECRET; offline copy |
| Monitoring | `/health`, `/metrics`, bot commands | 👤 add UptimeRobot + set `BACKEND_URL` |
| Backups | workflow provided | 👤 set `SUPABASE_DB_URI`; enable PITR |
| Domain/DNS | optional | 👤 confirm `nexusedu.com` ownership if used |

## 22.4 3 AM failure detection
If the backend goes down at 3 AM, **UptimeRobot** (once configured) emails/alerts
you because it pings `/api/ping` every 5 minutes. GitHub's keep-alive cron is
a secondary measure but disables after 60 days of repo inactivity. From your
phone: Render → your service → **Logs** to see the crash; check that
`SUPABASE_*` and Telegram variables are present; follow §21.12.

## 22.5 Rollback summary (phone-friendly)
- **Frontend broken:** Netlify → Deploys → previous deploy → Publish.
- **Backend broken:** Render → Deploys → previous deploy → rollback; or
  revert the last commit and push (CI redeploys).
- **Migration issue:** migrations are additive; never edit an applied
  file. Restore the latest `db-backup` artifact into a fresh Supabase
  project if needed (see §21.11).
- **Bad env var:** Render/Netlify → Environment → correct value → redeploy.
- **Telegram down:** site/catalog stay up; only streaming is affected;
  regenerate session string and update `PYROGRAM_SESSION_STRING`.

## 22.6 Remaining risks (honest)
- 🔴 **No running production is assumed** — external infrastructure must be
  (re)created; automated tests prove code correctness, not live operation.
- 🟡 Video bytes live only in Telegram — keep original source files offline.
- 🟡 First paid-enrollment end-to-end must be verified on the live stack.
- 🟡 `nexusedu.netlify.app` / `nexusedu.com` / old Supabase ref are
  historical references — confirm what actually exists before relying on them.

---

# 23. STAGE 21 — FINAL PRE-PRODUCTION FOUNDATION & ARCHITECTURAL FREEZE

Independent final audit. No new infrastructure was deployed. This records
the last code hardening before launch and freezes the architecture as the
baseline for the future Admin Control Plane.

## 23.1 Additional Stage 21 fixes (code-verified)
1. **`get_admin_stats()` RPC hardened** (NEW MIGRATION
   `20260811180000_stage21_function_hardening.sql` — run after earlier
   migrations): the function was `SECURITY DEFINER` with no admin check
   and default PUBLIC execute, exposing aggregate counts to anon. It now
   returns `NULL` unless `is_admin()`, sets `search_path = public`, and
   EXECUTE is revoked from PUBLIC and granted only to `authenticated`.
2. **Streaming 500 errors no longer leak internals:** the catch-all
   previously returned the raw exception to clients; now returns a generic
   "Internal server error" while logging details server-side.
3. **Shared httpx client is closed on shutdown** (clean resource cleanup).
4. **`CLOUDFLARE_WORKER_URL` documented** as the backend-side env var (in
   addition to `VITE_CLOUDFLARE_WORKER_URL` for the frontend); only needed
   for Drive-source videos.

## 23.2 Security status (final)
- All 38 real tables have RLS; backend-only tables have no public policies.
- Runtime authz functions (`is_admin`, `use_chapter_enrollment_code`) are
  `SECURITY DEFINER ... SET search_path = public`; admin-gated.
- No SQLi/command injection/SSRF; no real secrets in the repo; webhook
  secret verified with constant-time compare.
- Residual known items (CSP `unsafe-inline`, no MFA/captcha, single worker,
  Telegram-only video durability) are accepted and tracked in
  `AI_CONTEXT/known-issues.md`.

## 23.3 Future Admin Control Plane — architectural requirement (NOT BUILT)
A future centralized admin/control plane is a **planned, separate
project**. It must NOT become an unrestricted "execute anything" backdoor.
When built, it must layer, in this dependency order:

```
FOUNDATION (current repo, frozen here)
  → CONTROL-PLANE ARCHITECTURE & THREAT MODEL
  → CONFIGURATION SYSTEM (typed, validated, audited settings)
  → FEATURE FLAGS (safe on/off toggles)
  → CONTENT CONTROL (pages, announcements, catalog)
  → USER/ROLE CONTROL (granular permissions; never weaken security)
  → BUSINESS CONFIG (enrollment/access rules, limits)
  → FRONTEND CONTROL → BACKEND CONTROL → API CONTROL
  → DATABASE CONTROL (approval-gated, backup-first migrations only)
  → SECURITY CONTROLS (confirmation gates, least privilege)
  → DEVOPS/DEPLOYMENT CONTROLS (versioned, reversible)
  → OBSERVABILITY → IMMUTABLE AUDIT LOG → APPROVAL WORKFLOW
  → VERSIONING/ROLLBACK → ADVANCED AUTOMATION → FINAL HARDENING
```

Control categories must be separated: (1) safe runtime config, (2) feature
flags, (3) content, (4) business config, (5) operational controls,
(6) carefully controlled deployment ops, (7) infra ops only where safe,
(8) repository controls via GitHub/API workflows — never direct production
code edits from a browser, (9) database administration with strong
safeguards/migrations/approvals/backups, (10) security controls that no
ordinary admin can silently weaken. Every dangerous action needs
granular roles, confirmation gates, immutable audit records, safe
defaults, and reversibility.

## 23.4 Release gate (final)
- Code: 🟢 all tests pass (40 backend, 14 frontend), builds/boot validated.
- Infrastructure: 🟡 OWNER MUST set up Supabase (run ALL 19 migrations
  including the Stage 20 + Stage 21 hardening migrations), Render, Netlify,
  and Telegram; see §21 for the full procedure.
- The repository is **READY FOR OWNER INFRASTRUCTURE SETUP**, not yet
  live-verified. Live-verified status can only be reached after the owner
  completes external setup and the §21.10 smoke test passes against real
  URLs.

---

# 24. STAGE 22 — LIVE CUTOVER STATUS (environment verification)

This section records what was verified in-repo vs. what only you can verify
against the real services. Arena has **no credentials and restricted
outbound network access** (only GitHub was reachable at audit time), so it
could not log into Supabase/Render/Netlify/Telegram. Live checks below are
therefore **OWNER VERIFICATION REQUIRED**, not failures of the code.

## 24.1 Verification matrix
| Item | Code-ready? | Live status | How you verify |
|---|---|---|---|
| GitHub repo + Actions | ✅ | 👤 verify | Open repo → Actions tab; confirm CI runs on PRs |
| Supabase DB/migrations/RPC/RLS | ✅ | 👤 verify | SQL editor: run all 19 migrations; see §21.6 |
| Render backend `/health` | ✅ | 👤 verify | Open `https://<backend>/health` → `{"status":"healthy"}` |
| Netlify frontend | ✅ | 👤 verify | Open the site URL; login screen loads over HTTPS |
| Telegram bot/channels/session | code-ready | 🔴 recreate | §21.8 (bot, channels, session string) |
| Redis | optional | ⚪ N/A | App works without it (in-memory) |
| Cloudflare Worker | optional | ⚪ only if Drive videos | Set `CLOUDFLARE_WORKER_URL` if used |
| Uptime monitoring | docs ready | 👤 set up | UptimeRobot → `/api/ping` |
| Backups | workflow ready | 👤 activate | Set `SUPABASE_DB_URI` GitHub secret |

## 24.2 Enrollment/payment reality (verified in code)
- **IMPLEMENTED:** enrollment-code redemption via the atomic SQL RPC
  `use_chapter_enrollment_code` (chapter/cycle-scoped, prevents
  over-redemption); manual bKash/Nagad payment submissions to
  `pending_enrollments` with admin approval granting `chapter_access`.
- **NOT IMPLEMENTED (placeholder):** online/automated payment gateway.
  The Pricing page says "Coming Soon" and direct payments are disabled.
- **Fixed in Stage 22:** the Pricing "Redeem code" button previously
  posted to a non-existent `/api/v1/payments/enroll` endpoint. It now
  saves the code and sends the logged-in user to the dashboard to redeem
  it against a locked chapter (the real, chapter-scoped flow).

## 24.3 Live smoke test (run with your real services)
After setup, walk through §21.10 on your phone: site loads → signup/login
→ free video plays & seeks → locked chapter shows lock → redeem a code →
plays → progress saves → admin sees metrics → bot `/status` works. Each
row is PASS only if you actually saw it happen on the live site.

## 24.4 Release classification after Stage 22
- Repository/code: remains **B — READY FOR OWNER INFRASTRUCTURE SETUP**.
- It can only become **C — LIVE DEPLOYED** once you create the external
  services and deploy, and **D — LIVE VERIFIED** once the §21.10 smoke
  test passes on real URLs. Arena cannot advance this classification.

---

# 25. MASTER PROVISIONING GATES — OWNER SETUP SYSTEM (Stage 23)

This is the **single ordered checklist** for going from empty accounts to a
running system. It references the detailed steps in §21 where needed, so you
do not have to read everything first. Work top to bottom. Do **not** skip a
gate if its verification fails.

Secret legend: 🔐 = secret (never put in GitHub, chat, screenshots, or the
frontend). 🌐 = public value (safe in the frontend bundle / Netlify).

## GATE 0 — Preparation
- **Objective:** have all accounts ready.
- **Action:** confirm you can log in to GitHub, Supabase, Render, Netlify,
  and Telegram (the phone number that owns the video channels). Have a
  password manager ready for secrets.
- **Continue?** Yes once you are logged into all five.
- **Secret?** No.

## GATE 1 — GitHub
- **Objective:** the code is available for CI/CD.
- **Action:** open your repo on GitHub (the one containing this code).
  Settings → Actions → General → enable workflows. Note the default branch
  (`main`).
- **Verify:** Actions tab is visible; no red "workflows disabled" banner.
- **Failure:** if you don't have the repo, push/clone it first (outside
  Arena). No code changes needed.
- **Continue?** Yes when Actions are enabled.

## GATE 2 — Supabase project
- **Objective:** create the database + auth.
- **Action (phone):** Supabase → New project → pick region closest to your
  students (e.g. Singapore) → set a strong database password (save it).
  Wait ~2 min for provisioning. Settings → API: copy **Project URL** (🌐),
  **anon public** key (🌐), and **service_role** key (🔐).
- **Verify:** project dashboard opens; API page shows the three values.
- **Failure:** region/password issues → retry; do not proceed without the
  service key.
- **Continue?** Yes when you have URL + anon + service key saved.

## GATE 3 — Database migrations (CRITICAL ORDER)
- **Objective:** create every table, RLS policy and function.
- **Prereq:** Gate 2 done.
- **Phone path:** Supabase → SQL Editor → New query. Open each file in
  `supabase/migrations/` **in the order below**, copy its contents, paste,
  Run. Wait for "Success" after each:
  1. `0001_secure_quiz_attempts.sql`
  2. `0002_drop_old_quiz_attempts.sql`
  3. `20260501161500_add_quiz_attempts_and_indexes.sql`
  4. `20260502000000_complete_schema.sql`
  5. `20260502161709_add_resources_table.sql`
  6. `20260502163201_add_pending_enrollments.sql`
  7. `20260502185606_add_thumbnail_to_videos.sql`
  8. `20260503000000_audit_security.sql`
  9. `20260503000000_security_and_optimization.sql`
  10. `20260503000001_upload_pipeline.sql`
  11. `20260504000000_subscriptions.sql`
  12. `20260505000000_add_thumbnail_message_id.sql`
  13. `20260505000001_db_optimizations.sql`
  14. `20260515000000_dashboard_additions.sql`
  15. `20260729230600_restore_is_admin_policies.sql`
  16. `20260729230601_fix_quiz_attempts_definer.sql`
  17. `20260810000000_stage2_schema_reconciliation.sql`
  18. `20260811120000_stage20_rls_hardening.sql`
  19. `20260811180000_stage21_function_hardening.sql`
- **Verify (run in SQL Editor):**
  - `select count(*) from pg_tables where schemaname='public';` → expect ~38.
  - `select count(*) from pg_tables where schemaname='public' and rowsecurity=true;` → should equal the table count (RLS on all).
  - `select proname from pg_proc where proname in ('is_admin','use_chapter_enrollment_code','check_chapter_access','get_admin_stats');` → all 4 listed.
- **Rules:** never edit an applied file; if something fails, **stop** and
  fix that statement (do not skip files). Do not DROP or TRUNCATE.
- **Continue?** Yes only when all 19 succeed and the checks return the
  expected counts.

## GATE 4 — Render backend
- **Objective:** backend running at an `https://*.onrender.com` URL.
- **Prereq:** Gates 2–3.
- **Action (phone):** Render → New → Blueprint → connect repo (it reads
  `render.yaml`). If Blueprint isn't available: New → Web Service → Python,
  Build `pip install -r backend/requirements.txt`, Start
  `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, Health `/health`.
- **Environment variables (Render → Environment):** set every row in the
  matrix in §25.1 marked "Backend" — minimally `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` 🔐, `JWT_SECRET` 🔐,
  `ADMIN_TOKEN` 🔐, `ALLOWED_ORIGINS`. Telegram values can wait until
  Gate 7.
- **Verify:** open `https://<your-backend>/health` → `{"status":"healthy"}`.
  `/api/health` shows `"supabase": "connected"`.
- **Failure:** read Render → Logs. "Missing required environment variables"
  → add the named var. Boot crash → confirm start command exactly.
- **Continue?** Yes when `/health` is healthy.

## GATE 5 — Netlify frontend
- **Objective:** the app loads at an `https://*.netlify.app` URL.
- **Prereq:** Gate 4 (backend URL known).
- **Action (phone):** Netlify → Add new site → Import from Git → pick repo,
  build `npm run build`, publish `dist`. Site settings → Environment:
  `VITE_SUPABASE_URL` 🌐, `VITE_SUPABASE_ANON_KEY` 🌐,
  `VITE_API_BASE_URL` = your Render backend URL (no trailing slash) 🌐,
  `VITE_SITE_URL` = this Netlify URL 🌐. Trigger deploy.
- **Verify:** open the site over HTTPS → login/signup screen appears, no
  blank page.
- **Failure:** Netlify → Deploys → log; 99% of failures are a missing/typo'd
  `VITE_*` variable (they are baked at build time — redeploy after fixing).
- **Never:** put `SUPABASE_SERVICE_KEY` or any 🔐 into Netlify/`VITE_*`.
- **Continue?** Yes when the site loads.

## GATE 6 — GitHub Actions
- **Objective:** automatic deploy + keep-alive.
- **Prereq:** Gates 4–5.
- **Action:** GitHub → repo → Settings → Secrets and variables → Actions:
  - **Secrets:** `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`,
    `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`,
    `SITE_URL`; optional `RENDER_DEPLOY_HOOK`, `SUPABASE_DB_URI`.
  - **Variables:** `BACKEND_URL` = your Render backend URL (no trailing slash).
- **Verify:** Actions tab → a CI run completes green on push to `main`.
- **Failure:** a red X → open the failing step; Netlify deploy failures are
  usually a missing token/site id.
- **Continue?** Yes once CI is green.

## GATE 7 — Telegram
- **Objective:** videos can stream and the admin bot works.
- **Prereq:** Gate 4 (so you can add env vars and restart).
- **Action:** follow the full mobile procedure in §21.8: get API ID/hash
  from my.telegram.org 🔐, create bot via @BotFather and set a webhook
  secret 🔐, find your admin ID via @userinfobot, create the thumbnail +
  storage channels (you may start with **one** storage channel; 18 is the
  maximum auto-watched set), get their `-100…` IDs, generate a
  `PYROGRAM_SESSION_STRING` 🔐, then set all Telegram variables in Render
  and redeploy.
- **Variables to add to Render:** `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` 🔐,
  `PYROGRAM_SESSION_STRING` 🔐, `TELEGRAM_BOT_TOKEN` 🔐,
  `TELEGRAM_WEBHOOK_SECRET` 🔐, `ADMIN_CHAT_ID`, `WEBHOOK_URL` =
  `https://<backend>/api/bot_webhook`, `THUMBNAIL_CHANNEL_ID`, and the
  `PHY/CHE/HM_C*_CHANNEL_ID` you use.
- **Verify:** send `/start` to the bot → it replies; `/status` shows webhook
  set; backend logs show "primary client started"; `GET /api/channels/health`
  (as admin) lists channels.
- **Minimum viable config:** ONE storage channel is enough to prove
  streaming. Add the remaining channels as your content grows.
- **Continue?** Yes when the bot responds and channels resolve.

## GATE 8 — Domain/DNS (optional)
- **Objective:** use a custom domain (otherwise skip and use the Netlify URL).
- **Prereq:** Gates 4–5.
- **Action:** add the domain in Netlify → Domain management; follow its DNS
  instructions at your registrar; enable HTTPS (automatic). Then set
  `VITE_SITE_URL` to the custom domain in Netlify and redeploy. Optionally
  point a backend subdomain at Render. Update CORS `ALLOWED_ORIGINS`.
- **Verify:** `https://yourdomain` loads with a valid certificate.
- **Continue?** Skip if you don't own a domain yet.

## GATE 9 — Monitoring
- **Objective:** know at 3 AM if something breaks.
- **Action (phone):** create a free UptimeRobot monitor (HTTP(s)) for
  `https://<backend>/api/ping` every 5 min, and one for the frontend URL.
  Add your email/phone for alerts.
- **Verify:** monitor shows "Up".
- **Continue?** Recommended before launch.

## GATE 10 — Backups
- **Objective:** recover the database if disaster strikes.
- **Action:** enable Supabase Point-in-Time-Returns if on a paid plan;
  either way add GitHub secret `SUPABASE_DB_URI` (Supabase → Settings →
  Database → connection string) and copy
  `docs/operations/db-backup.workflow.yml` to `.github/workflows/db-backup.yml`
  via the GitHub web UI to activate weekly dumps.
- **Verify:** run the workflow manually (Actions → DB Backup → Run); a
  private artifact appears.
- **Reminder:** this backs up the **database only**, not Telegram video
  bytes. Keep original video files on a separate drive/cloud.
- **Continue?** Required before accepting real users.

## GATE 11 — First admin user
- **Objective:** you control the admin panel.
- **Action:** open your site → Sign up with your email → confirm → log in.
  Then in Supabase → SQL Editor run:
  `update profiles set role='admin' where id=(select id from auth.users where email='YOUR_EMAIL');`
- **Verify:** refresh the site; the Admin section appears. You see the
  dashboard metrics.
- **Continue?** Yes when admin panel is visible.

## GATE 12 — First video
- **Objective:** prove the streaming architecture end to end.
- **Prereq:** Gates 7, 11.
- **Action:** post a short test video into one storage channel (as the
  session account). Copy its Telegram message id and channel id. In Admin →
  Content, create a Subject/Cycle/Chapter and a Video with `source_type` =
  telegram, pasting those two ids.
- **Verify:** open the chapter as a user; press play; video starts; drag the
  seek bar (Range requests work); pause/resume works.
- **Failure:** 503 → session invalid/expired or account not in the channel;
  403 → chapter requires enrollment or your user is blocked; 404 → the
  message/channel ids are wrong.
- **Continue?** Yes when a test video plays AND seeks.

## GATE 13 — Enrollment
- **Objective:** paid/locked content gating works.
- **Action:** in Admin, generate an enrollment code for the chapter. Log in
  as a normal (non-admin) user, open the locked chapter, enter the code.
  Also test a manual payment: submit a pending enrollment from
  `/enrollment`, then Approve it in Admin → Enrollment.
- **Verify:** the chapter unlocks after redemption/approval; a second code
  use is rejected; an invalid code is rejected.
- **Continue?** Yes when both paths work.

## GATE 14 — Complete smoke test
Run every row of the matrix in §21.10 on your phone. Also run:
`python scripts/verify_deploy.py --backend https://<backend> --frontend https://<frontend>`
from any terminal/cloud shell (it needs no secrets).
- **Continue?** Yes only if every critical row passes.

## GATE 15 — GO / NO-GO
Fill the table in §25.3. **GO** requires every Required item "Verified".
If anything is unverified or failing, you are **NO-GO** — fix it or
knowingly accept the risk in writing.

## 25.1 Canonical environment-variable matrix
🌐 public (may be in frontend bundle) · 🔐 secret (server only)

| Variable | Used by | Required? | Secret? | Where obtained | Where set | Format/example |
|---|---|---|---|---|---|---|
| `SUPABASE_URL` | Backend | Yes | 🌐 | Supabase → Settings → API | Render | `https://xx.supabase.co` |
| `SUPABASE_ANON_KEY` | Backend | Yes | 🌐 | Supabase → API (anon) | Render | JWT string |
| `SUPABASE_SERVICE_KEY` | Backend | Yes | 🔐 | Supabase → API (service_role) | Render | JWT string |
| `VITE_SUPABASE_URL` | Frontend | Yes | 🌐 | same as SUPABASE_URL | Netlify | URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Yes | 🌐 | same as anon | Netlify | JWT |
| `VITE_API_BASE_URL` | Frontend | Yes | 🌐 | your Render URL | Netlify/GitHub | `https://x.onrender.com` |
| `VITE_SITE_URL` | Frontend/SEO | Recommended | 🌐 | your site URL | Netlify/GitHub | `https://…` |
| `JWT_SECRET` | Backend | Yes | 🔐 | generate ≥32 chars | Render | random string |
| `ADMIN_TOKEN` | Backend | for HMAC admin ops | 🔐 | generate ≥32 chars | Render | random string |
| `ALLOWED_ORIGINS` | Backend | Yes | 🌐 | your frontend URL(s), comma-separated | Render | `https://a.netlify.app,https://…` |
| `PORT` | Backend | auto | No | Render provides it | (set by Render) | `10000` |
| `TELEGRAM_API_ID` | Backend/Telegram | for video | No* | my.telegram.org | Render | digits |
| `TELEGRAM_API_HASH` | Backend/Telegram | for video | 🔐 | my.telegram.org | Render | hex string |
| `PYROGRAM_SESSION_STRING` | Backend/Telegram | for video | 🔐 | generated via script | Render | session string |
| `PYROGRAM_SESSION_STRING_2` | Backend | optional fallback | 🔐 | generated | Render | session string |
| `TELEGRAM_BOT_TOKEN` | Backend/bot | for admin bot | No* | @BotFather | Render | `123:ABC…` |
| `TELEGRAM_WEBHOOK_SECRET` | Backend/bot | recommended | 🔐 | random, set in BotFather too | Render | random string |
| `ADMIN_CHAT_ID` | Backend/bot | for bot admin | No* | @userinfobot | Render | numeric, comma-separated |
| `WEBHOOK_URL` | Backend/bot | for bot | No* | `https://<backend>/api/bot_webhook` | Render | URL |
| `THUMBNAIL_CHANNEL_ID` | Backend/uploads | recommended | No | channel id (Telegram) | Render | `-100…` |
| `PHY_C1_CHANNEL_ID`…`HM_C6_CHANNEL_ID` | Backend uploads/scan | optional slots | No | channel ids | Render | `-100…` or `0` |
| `CLOUDFLARE_WORKER_URL` | Backend (Drive) | only Drive videos | 🌐 | your Worker URL | Render | `https://…workers.dev` |
| `VITE_CLOUDFLARE_WORKER_URL` | Frontend (Drive) | only Drive videos | 🌐 | same | Netlify | URL |
| `REDIS_URL` | Backend cache/rate | optional | 🔐 | Upstash/Render Redis | Render | `rediss://…` |
| `TRUSTED_PROXY_HOPS` | Backend | optional | No | Render=1 (default) | Render | `1` |
| `RENDER` | Backend | auto | No | Render sets `true` | Render | `true` |
| `IS_FREE_TIER` | Backend | optional | No | `true` skips ffmpeg | Render | `true`/`false` |
| `BOT_NOTIFY_ON_START` | Backend/bot | optional | No | notify admin on boot | Render | `true`/`false` |
| `BACKEND_URL` | GitHub keep-alive | for CI | 🌐 | your Render URL | GitHub → Variables | URL |
| `SUPABASE_DB_URI` | GitHub backup | for backups | 🔐 | Supabase DB connection | GitHub → Secrets | `postgres://…` |
| `NETLIFY_AUTH_TOKEN`/`NETLIFY_SITE_ID` | GitHub CI deploys | for CI | 🔐/🌐 | Netlify account | GitHub → Secrets | token/id |
| `RENDER_DEPLOY_HOOK` | GitHub CI | optional | 🔐 | Render deploy hook URL | GitHub → Secrets | URL |

\* "No" for boot, but **required** if you want video streaming/bot features.
The backend boots without Telegram values (catalog/auth work); streaming
returns 503 until they are set.

## 25.2 Minimum viable launch
You do NOT need all 18 channels, Redis, ffmpeg, a custom domain, or
Cloudflare to launch. The smallest working production system is:
Supabase (all 19 migrations) + Render (core env) + Netlify (VITE_* env) +
ONE Telegram storage channel + bot + session string + one admin user +
one test video. Add channels, monitoring and backups before public launch.

## 25.3 Production GO / NO-GO matrix
| Requirement | Required | Verified? | Owner action / evidence |
|---|---|---|---|
| GitHub repo + Actions enabled | Yes | ☐ | Actions tab visible |
| Supabase project | Yes | ☐ | Project URL saved |
| All 19 migrations applied | Yes | ☐ | table/RLS/function checks |
| RLS on all tables | Yes | ☐ | rowsecurity count |
| Admin account promoted | Yes | ☐ | Admin panel visible |
| Render backend deployed | Yes | ☐ | `/health` healthy |
| Backend connected to DB | Yes | ☐ | `/api/health` supabase connected |
| Netlify frontend deployed | Yes | ☐ | site loads over HTTPS |
| Login/signup works | Yes | ☐ | create test user |
| Telegram bot + session + ≥1 channel | Yes (for video) | ☐ | `/status` + channel health |
| A test video plays & seeks | Yes | ☐ | Range/206 in action |
| Enrollment lock/redeem works | Yes | ☐ | code + admin approval |
| Backups configured | Yes | ☐ | workflow artifact produced |
| Restore drill understood | Yes | ☐ | owner has followed §21.11 |
| Uptime monitoring | Yes | ☐ | UptimeRobot Up |
| Custom domain/HTTPS | Conditional | ☐ | DNS + cert (if used) |
| SEO/canonical/sitemap | Conditional | ☐ | `VITE_SITE_URL` correct |
| `verify_deploy.py` passes | Yes | ☐ | exit code 0 |

**NO-GO** if any "Yes" row is unverified. **CONDITIONAL GO** only if you
explicitly accept an unverified conditional item. **GO** when all required
rows are verified.

## 25.4 Owner verification script
After deploying, run (any terminal/cloud shell, no secrets):
`python scripts/verify_deploy.py --backend https://<backend> --frontend https://<frontend>`
It checks `/health`, `/api/health`, security headers, error-leakage and
frontend reachability. Exit 0 = those checks pass (you still must do the
video/enrollment/backup rows manually).

---

# 26. STAGE 24 — LIVE CUTOVER STATUS & RELEASE GATE

## 26.1 What was verified live
- **GitHub repo exists and is public:** `HasibBot4u/New-mvp-9`, default
  branch `main`. ✅
- **Remote `main` is at the OLD code** (commit `b070d277`, before
  Stages 16–24). All Stage 16–24 work is committed *locally* in Arena and
  has **not been pushed** (correct, per the no-PR/no-push rule). When you
  are ready, the accumulated work is pushed/merged once at the end.
- **The old keep-alive workflow runs every 10 min and reports "success"
  even when the backend is unreachable**, because its curl was wrapped in
  `|| echo`. It also still hardcoded the deleted
  `nexusedu-backend-0bjq.onrender.com`. Fixed locally in Stage 24:
  it now uses the `BACKEND_URL` variable, retries on cold start, and
  **fails the run** if the backend is down (so you actually get alerted).
- Supabase, Render, Netlify, and Telegram cannot be reached from the
  Arena sandbox (network is restricted to GitHub). These remain
  **OWNER VERIFICATION REQUIRED** — not broken, just not visible here.

## 26.2 Release classification
- **Repository code:** remains **B — READY FOR OWNER INFRASTRUCTURE SETUP**,
  now with a stronger verifier and a hardened keep-alive.
- It can only become **C (deployed)** once you push the accumulated work
  and create the external services, and **D (live-verified)** once the
  §25 smoke test and `scripts/verify_deploy.py` pass against real URLs.
- Nothing was deployed and no live service was modified in this stage.

## 26.3 Exact GO / NO-GO before public launch
GO requires every §25.3 "Required" row checked by you against the real
services: migrations (19) applied, RLS on all tables, `/health` healthy,
frontend loads over HTTPS, login works, a Telegram test video plays and
seeks, enrollment locks/unlocks, backups produced, and uptime monitoring
is green. If any row is unverified, you are NO-GO.

---

# 27. FINAL AI HANDOFF & REPOSITORY FREEZE (Stage 27)

The AI-doable portion of this project is **COMPLETE**. This section is the
single starting point for manual infrastructure provisioning.

## 27.1 What AI verified (repository-side)
- Backend: 40 automated tests pass; 53 routes; 8 middleware; clean boot/shutdown.
- Frontend: 14 tests pass; TypeScript/ESLint clean; production build succeeds.
- Database: 19 migrations in correct order, including the Stage 20 RLS and
  Stage 21 function-hardening migrations; RLS on every real table;
  admin-gated `get_admin_stats()`.
- Security: no SQLi/command injection/SSRF; no real secrets in the repo;
  streaming requires auth/tickets and is never gzipped; UUID validation on
  admin endpoints; generic (non-leaking) error responses.
- Deployment configs (`render.yaml`, `netlify.toml`, GitHub workflows) are
  valid and internally consistent; `scripts/verify_deploy.py` passes against
  a healthy backend and fails cleanly when unreachable.

## 27.2 What is NOT verified (by design)
No live Supabase, Render, Netlify, or Telegram service has been created,
deployed, or tested — the AI sandbox cannot reach those hosts. Do not treat
"tests pass" as "production works". Live status is OWNER VERIFICATION
REQUIRED until you complete the gates below.

## 27.3 Your exact next action
**Stop the AI coding stages. Open this guide at GATE 0 and follow the gates
in order.** Do not skip ahead; each gate's verification must pass before
continuing. At a high level the manual sequence is:

1. **Supabase** — create project; run all 19 migrations in order (GATE 2–3).
2. **Render** — create the backend service; set core environment variables;
   confirm `/health` and `/api/health` (GATE 4).
3. **Netlify** — create the frontend site; set the four `VITE_*` variables;
   confirm the site loads over HTTPS (GATE 5).
4. **GitHub Actions** — add the required secrets and the `BACKEND_URL`
   variable (GATE 6).
5. **Telegram** — create the API creds, bot, webhook secret, at least one
   storage + thumbnail channel, and the session string; set them in Render
   (GATE 7).
6. **Domain/DNS** (optional) and **Backups/Monitoring** (GATE 8–10).
7. **First admin + first video + enrollment** (GATE 11–13).
8. Run `python scripts/verify_deploy.py --backend <url> --frontend <url>`
   and the full phone smoke test (GATE 14).

## 27.4 Final GO / NO-GO
Production is **GO** only when every "Required" row in the §25.3 matrix is
checked against your REAL services: all migrations applied, `/health`
healthy, the site loads, login works, a Telegram video plays and seeks,
enrollment locks/unlocks, a backup artifact exists, monitoring is green,
and `verify_deploy.py` exits 0. If any required item is unverified, you are
**NO-GO**. The future centralized Admin Control Plane remains deferred and
is not part of this launch.
