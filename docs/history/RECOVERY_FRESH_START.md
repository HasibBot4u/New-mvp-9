# Project Recovery — Fresh-Start Checklist ("I forgot everything" edition)

**Audience:** you, 4–5 months later. Everything here is reconstructed from repository evidence; nothing requires remembering. Commands are verified against this snapshot.

## What this system is, in one paragraph
NexusEdu sells per-chapter video courses to Bangladeshi HSC students. Videos live in **private Telegram channels** (free unlimited storage). A Python **FastAPI backend** pretends to be a video CDN: the browser's `<video>` tag asks it for byte ranges, and it fetches those bytes from Telegram over MTProto (Pyrogram). **Supabase** handles login (email/password), the PostgreSQL database, and row-level security. The **React PWA** (Netlify) is what students and the admin see. Money flows manually: students pay by bKash/Nagad, submit the transaction ID, an admin clicks **Approve** in the admin panel (Stage 2 addition), and chapter access is granted. Enrollment codes are the other access route.

---

## Step 1 — Prepare your machine
| Tool | Required version | Evidence |
|---|---|---|
| Node.js | 20.x (`package.json` engines `>=20 <21`; `.nvmrc`=20) | `nvm install 20` recommended |
| Python | 3.11 (`.python-version`, `runtime.txt`=3.11.11) | 3.11–3.13 accepted by `scripts/setup.py` |
| git, Docker (optional) | any recent | local dev compose |

## Step 2 — Get the repository
```bash
git clone https://github.com/HasibBot4u/New-mvp-9.git && cd New-mvp-9
```

## Step 3 — Install dependencies (verified commands)
```bash
npm install                                # frontend (lockfile updated in Stage 2)
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements-dev.txt   # backend + test tooling
```
Or the guided script: `python3 scripts/setup.py` (checks versions, installs both, validates env, offers migrations).

## Step 4 — Configure environment
Copy `.env.example` → `.env` (root, used by Vite) and `backend/.env.example` → `backend/.env`. **Full variable map:**

| Variable | Purpose | Used by | Required | Secret? |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | FE supabase-js | ✅ | no |
| `VITE_SUPABASE_ANON_KEY` | public API key | FE supabase-js | ✅ | no (public by design) |
| `VITE_API_BASE_URL` | backend base URL | FE fetch/stream/tickets | ✅ in dev; prod falls back to the hardcoded Render URL (fix recommended) | no |
| `VITE_API_URL` | legacy alias (socket era) | unused after Stage 2 cleanup | ❌ remove | — |
| `VITE_CLOUDFLARE_WORKER_URL` | Drive-proxy worker | FE `getStreamUrl`, backend drive redirect | only for Drive videos | no |
| `VITE_ENABLE_IP_FETCH` | opt-in ipify lookup | `useChapterAccess` | ❌ (default off) | no |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | backend DB reads | main.py catalog | ✅ | anon=no |
| `SUPABASE_SERVICE_KEY` | **bypasses RLS** — all backend writes | main.py, worker, audit | ✅ | 🔒 never ship to browser |
| `JWT_SECRET` | **now signs stream tickets** (Stage 2) | main.py | ✅ set a random ≥32-char string | 🔒 |
| `ADMIN_TOKEN` | `/metrics` scrape auth (header only) | main.py | recommended ≥32 chars | 🔒 |
| `REDIS_URL` | distributed rate limiting | rate_limiter | ❌ (falls back to memory) | 🔒 |
| `ALLOWED_ORIGINS` | CORS allowlist (comma-sep) | main.py | ✅ prod | no |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | MTProto app credentials (my.telegram.org) | pyrogram | ✅ for streaming | 🔒 |
| `PYROGRAM_SESSION_STRING` (+`_2` optional) | logged-in user session | pyrogram | ✅ for streaming | 🔒 (account-level!) |
| `TELEGRAM_BOT_TOKEN` | BotFather token | bot_manager, notifications | ✅ for bot | 🔒 |
| `TELEGRAM_WEBHOOK_SECRET` | webhook origin check | main.py | recommended | 🔒 |
| `WEBHOOK_URL` | public backend URL; may be bare host **or** include `/api/bot_webhook` (both now handled) | bot_manager | ✅ for bot | no |
| `ADMIN_CHAT_ID` | your Telegram user id (comma-sep for several) | bot authZ, notifications | ✅ for bot | no |
| `THUMBNAIL_CHANNEL_ID` | private channel holding thumbnails | worker, `/api/thumbnail` | ✅ | no |
| `PHY_C1..C6 / CHE_C1..C6 / HM_C1..C6 _CHANNEL_ID` | the 18 storage channels | CHANNEL_MAP, upload watcher | ✅ for streaming | no |
| `PORT` | uvicorn port | main.py/dev | ❌ | no |

## Step 5 — Database (Supabase)
1. Create a project at supabase.com (free tier fine). Note URL + anon + **service role** key.
2. Apply migrations **in order**: `supabase db push` (or SQL editor, filename order). The Stage-2 file `20260810000000_stage2_schema_reconciliation.sql` is **mandatory** — it adds the columns the code expects (`profiles.role`, `audit_logs.user_id`, `videos.file_size_bytes/mime_type/file_id`, `enrollment_codes.cycle_id`, announcements runtime columns, `pending_enrollments.reviewed_*`).
3. Promote yourself to admin (hand-edit needed once): `UPDATE profiles SET role='admin' WHERE id='<your-auth-uid>';` and/or `INSERT INTO user_roles(user_id, role) VALUES ('<uid>', 'admin');` (backend accepts either; RLS admin uses `user_roles`).
4. Optional seed: create 3 subjects (physics/chemistry/math) → cycles → chapters via the admin panel after boot.

## Step 6 — External services checklist

| Service | Purpose | Evidence in repo | Status | Action |
|---|---|---|---|---|
| Supabase | auth+DB | env, migrations | recreate if project lost | Step 5 |
| Telegram (my.telegram.org API keys) | MTProto streaming | env | UNKNOWN if old keys still valid | re-issue if needed |
| Telegram bot (@BotFather) | ops bot + notifications | bot_manager | **Deleted externally** | recreate (§TELEGRAM_RECONSTRUCTION) |
| 18 Telegram channels | video storage | CHANNEL_MAP env | **Deleted externally; video files permanently lost** | recreate + re-upload |
| Render | backend hosting | render.yaml, keep-alive URL | old service may sleep/be deleted | recreate web service; set `vars.BACKEND_URL` in repo settings for keep-alive |
| Netlify | frontend | netlify.toml, CI secrets | account likely exists | reconnect repo; set `VITE_*` |
| GitHub Actions | CI/deploy/keep-alive | workflows | automatic | add secrets (`NETLIFY_*`, `RENDER_DEPLOY_HOOK`, `VITE_*`) |
| Cloudflare Worker (`nexusedu-proxy.*.workers.dev`) | Drive proxy | hardcoded default in main.py | UNKNOWN — personal account | recreate or remove Drive sources |
| Redis (Upstash etc.) | distributed rate limit | REDIS_URL optional | optional | add if >1 worker |
| UptimeRobot/cron-job.org | keep-alive redundancy | KEEP_ALIVE.md | recommended | point at `/api/ping` |
| bKash/Nagad | payments | manual only (no API) | n/a | nothing to configure |

## Step 7 — Recreate Telegram
Full procedure: **`docs/TELEGRAM_RECONSTRUCTION.md`** (create account assets, 18 channels + thumbnail channel, bot, webhook, env wiring, ID discovery via `scripts/get_channel_id.py`, DB backfill of `cycles.telegram_channel_id`, re-upload plan).

## Step 8 — Start development
```bash
npm run dev                                   # terminal 1 → http://localhost:5173 (proxies /api to :8000)
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000 # terminal 2 (FROM REPO ROOT)
```
Or `make dev`. Docker alternative: `docker compose up` (backend:8000 + frontend:5173).

## Step 9 — Run tests (all verified green in Stage 2)
```bash
pytest backend/tests -v     # 17 passed
npm run test:ci             # 7 passed (5 files)
npm run typecheck && npm run lint
```

## Step 10 — Validate workflows (manual checklist)
- [ ] Signup → email confirm → login → dashboard loads catalog
- [ ] Free chapter video plays (`/watch/...`), progress persists after reload
- [ ] Locked chapter shows lock; redeeming a generated code unlocks it
- [ ] Student `/enrollment` submit appears under Admin → Enrollment → **Pending Payment Approvals**; Approve grants access
- [ ] Admin content CRUD updates catalog within ~5 min (or after `/api/refresh`)
- [ ] Bot answers `/start /ping` in Telegram (after Step 7)
- [ ] `/metrics` with `X-Admin-Token` returns Prometheus text

## Step 11 — Deploy
1. **Backend:** Render → New Web Service → connect repo → Build `pip install -r backend/requirements.txt`, Start `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` (root dir!) → set all Step-4 backend vars → health check path `/health`.
2. **Frontend:** Netlify → import repo → build `npm run build`, publish `dist` → set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (your Render URL) → redeploy after any change.
3. CI alternative: push to `main` — `ci.yml` builds+publishes Netlify, `backend-deploy.yml` curls `RENDER_DEPLOY_HOOK`.
4. Set repo **Variables** `BACKEND_URL` for the keep-alive workflow.

## Step 12 — Verify production
`curl <backend>/api/health` → `{"status":"healthy",...,"supabase":{"status":"connected"}}`; open the site; play one video end-to-end; check Admin → Logs shows activity rows; confirm audit_logs rows now carry `user_id`; schedule/confirm keep-alive pings; add UptimeRobot as backup.

---

## Troubleshooting quick table
| Symptom | Likely cause | Fix |
|---|---|---|
| Backend crash `ModuleNotFoundError: telegram/prometheus_client` | old requirements deployed | deploy Stage-2 `requirements.txt` |
| Streams 503 "Telegram client is not connected" | session string invalid / channels missing | regen session, re-set channel env |
| Streams 403 on paid chapter after fresh DB | reconciliation migration not applied | run Step 5.2 |
| Bot never answers | webhook double-path on old builds, or secret mismatch | Stage-2 bot_manager handles both; verify `TELEGRAM_WEBHOOK_SECRET` matches set_webhook |
| Admin panel 401s but user is admin | `profiles.role` missing | apply migration + UPDATE statement |
| Audit logs empty | missing `audit_logs.user_id` | apply migration |
| Render sleeps despite workflow | GH disabled cron after 60d inactive | re-enable workflow or use UptimeRobot |
| `pending_enrollments` rows pile up | pre-Stage-2 build | deploy new backend; use Approve button |

## What is permanently lost (never pretend otherwise)
The original 18 channels' video files, message IDs, bot state, and any data stored only in Telegram. Channel/bot **IDs cannot be recovered** — every ID in env/DB must be re-issued. Catalog metadata survives (Supabase) if that project still exists; otherwise rebuild from migrations + admin UI.
