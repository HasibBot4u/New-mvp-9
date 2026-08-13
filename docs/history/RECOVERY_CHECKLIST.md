# NexusEdu — Project Recovery Checklist (Forgotten After 4-5 Months)

This is your "I forgot everything" revival guide. Follow in order.

## Step 1 — Prepare Environment

Install:
- Node.js 20.x (check `.nvmrc` = 20) — `nvm use` or `node -v`
- Python 3.11 (see `backend/.python-version` may say 3.11, `runtime.txt`) — `python3 --version`
- Supabase CLI optional for migrations: `npm install -g supabase` or via npx
- Git, Docker optional

Commands to verify:
```bash
node -v # >=20 <21
npm -v
python3 --version # 3.11 - 3.13
pip --version
```

## Step 2 — Obtain Repository

```bash
git clone https://github.com/HasibBot4u/New-mvp-9.git
cd New-mvp-9
git checkout arena/019fe490-new-mvp-9 # or main
```

## Step 3 — Install Dependencies

Frontend:
```bash
npm install
```

Backend:
```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt # for tests, bandit
cd ..
```

Optional use setup script:
```bash
python3 scripts/setup.py --skip-migrations
# Or
make setup
```

## Step 4 — Configure Environment

1. Copy `.env.example` to `.env` in root and to `backend/.env`? Actually backend reads root env via python-dotenv? Config uses env_file ".env" from backend/config.py. So create `.env` in root and also in backend? Simplest create `.env` in repo root.

2. Fill required variables per `docs/ENV_MAP.md`:
   - Supabase URL, anon, service keys (from Supabase dashboard)
   - ADMIN_TOKEN generate: `openssl rand -hex 32`
   - ALLOWED_ORIGINS: `http://localhost:5173,http://localhost:3000`
   - Telegram vars: you need to recreate per `TELEGRAM_RECOVERY_GUIDE.md` — initially leave empty to run without Telegram (app will warn but start)

3. Frontend env: create `.env.local` or set in `.env` (Vite reads `.env`):
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_API_BASE_URL=http://localhost:8000

4. Validate:
```bash
python3 scripts/validate_env.py
```

## Step 5 — Configure Database

- Supabase project: create new or use existing from `VITE_SUPABASE_URL`.
- Ensure project has tables — migrations in `supabase/migrations/` must be applied.

If using Supabase CLI linked:
```bash
npx supabase link --project-ref your-ref
npx supabase db push
```

If not, apply manually via Supabase SQL editor running each migration file in order (timestamp order). Most important is `20260502000000_complete_schema.sql` which creates most tables, then later incremental.

Check tables exist: profiles, subjects, cycles, chapters, videos, enrollment_codes, chapter_access, watch_history, activity_logs, etc.

Seed data: None provided. You must create at least:
- One subject (e.g., Physics slug physics)
- One cycle per subject
- One chapter per cycle
- Profiles: after first user signup, set role to admin via Supabase SQL: `INSERT INTO user_roles (user_id, role) VALUES ('your-user-id', 'admin')` or update profiles role if column exists.

## Step 6 — Configure External Services

- **Supabase**: Already.
- **Redis** (optional): Get Upstash free Redis URL, set REDIS_URL. If not set, app uses in-memory.
- **Cloudflare Worker** (optional): If using Drive videos, deploy worker from repo? Worker code not in repo (only env example points to `https://nexusedu-proxy...`). You need to create worker that proxies Drive file download with CORS. Can skip if not using Drive.
- **Netlify/Render**: For prod, not needed for local.

## Step 7 — Recreate Telegram Infrastructure

Follow `docs/TELEGRAM_RECOVERY_GUIDE.md` full steps.

For local dev without Telegram, you can run backend with `HAS_TELEGRAM_CREDS` false — it will log warning and run without Telegram. Streaming will return 503. That's okay for frontend dev.

To enable Telegram:
- Create bot, channels, get IDs, session strings, set env vars.
- Restart backend.

## Step 8 — Start Development Environment

Two terminals:

Terminal 1 frontend:
```bash
npm run dev
# runs Vite on http://localhost:5173
```

Terminal 2 backend:
```bash
cd backend
uvicorn backend.main:app --reload --port 8000
# or
uvicorn main:app --reload --port 8000 --app-dir backend
# Check file: actual import path is backend.main:app when running from root, or main:app when cd backend
# So from root: uvicorn backend.main:app --reload --port 8000
```

From root both at once:
```bash
make dev
# runs npm run dev & uvicorn backend.main:app --reload --port 8000
```

Check:
- http://localhost:5173 should load
- http://localhost:8000/health should return {"status":"healthy"}
- http://localhost:8000/api/health should show supabase connected?

## Step 9 — Run Tests

Frontend:
```bash
npm run typecheck
npm run lint
npm run test:ci
```

Backend:
```bash
pytest backend/tests -v
# or
python -m pytest
```

Security scan:
```bash
bandit -r backend
npm audit
```

## Step 10 — Validate Major Workflows

Checklist:

- [ ] Signup new user via UI → Supabase auth creates user, profile row created?
- [ ] Login works, session persists after refresh
- [ ] Catalog loads (if Supabase has data)
- [ ] As non-admin, try access /admin → redirects to dashboard or login
- [ ] As admin, access /admin → dashboard metrics load (may error if no Telegram)
- [ ] Content page CRUD works (create subject, cycle, chapter)
- [ ] Enrollment code generation works
- [ ] As student, chapter requiring enrollment shows lock, code redemption works via `check_chapter_access` RPC (need to test)
- [ ] Video player page loads (if videos exist) — with Telegram disabled will show error, but UI should handle
- [ ] Progress batch: watch video (or mock) → watch_history entry created?
- [ ] Activity log: actions logged to activity_logs table?
- [ ] Thumbnail endpoint returns placeholder if no Telegram
- [ ] Search works client-side
- [ ] PWA install prompt appears? Check beforeinstallprompt event
- [ ] Dark mode toggle persists?

## Step 11 — Deploy

**Backend Render:**
- Connect GitHub repo to Render web service
- Build command: `pip install -r backend/requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Add env vars in Render dashboard
- Health check path `/health`
- Deploy — watch logs for Telegram startup

**Frontend Netlify:**
- Connect repo
- Build command `npm run build`
- Publish dir `dist`
- Add VITE_ env vars in Netlify > Site settings > Environment variables
- Deploy — clear cache and deploy if env changed

**CI/CD:**
- GitHub Actions `ci.yml` runs tests on push to main, then deploys to Netlify if tests pass.
- `backend-deploy.yml` triggers Render deploy hook on backend/ changes.
- `keep-alive.yml` pings backend every 10 min to prevent Render free tier sleep (note GH disables after 60d inactivity).

## Step 12 — Verify Production

- Frontend URL loads
- Backend health `/health` and `/api/health` return healthy
- Catalog loads in prod
- Login/signup works in prod
- Streaming works (if Telegram configured)
- Bot webhook active: send `/ping` to bot in Telegram
- Monitoring: check Render logs, Prometheus metrics if protected
- SEO: check /robots.txt, sitemap.xml (generated via `npm run sitemap`)

## Troubleshooting Common Failures

- **CORS error**: Check ALLOWED_ORIGINS includes frontend URL exact, no trailing slash, comma-separated.
- **Supabase auth fails**: Check anon key correct, Supabase URL correct, RLS policies.
- **Telegram client fails to start**: Check API_ID is int, API_HASH non-empty, SESSION_STRING valid, network allowed.
- **Streaming 503**: Telegram not connected → check logs, ensure session string still valid (sessions expire if not used? Regenerate).
- **Catalog empty**: Check Supabase tables have data, RLS allows anon read for subjects? fetch_supabase uses anon key, so RLS must allow anon select where is_active true.
- **Admin check fails**: profiles table may not have role column if migration not applied, or user_roles missing. Insert admin role manually.
- **Vite build fails**: Check Node 20, check env vars.
- **Keep-alive stops**: GitHub disables scheduled workflows after 60d inactivity → manually trigger workflow_dispatch or set up external uptime robot (e.g., UptimeRobot pinging /api/ping).

## Recovery Timeline Estimate

- Env setup: 30 min
- DB migrations: 30 min
- Telegram recreation: 2-4 hours (channels + bot + session + re-upload videos potentially days if many videos)
- Testing workflows: 2 hours
- Deploy: 1 hour
- Total: 1 day for code + infra without video re-upload, 1-2 weeks if re-uploading hundreds of videos.

## Important Notes

- Development stopped 4-5 months ago, so some dependencies may have new versions. Lockfiles pinned versions, but check for security advisories `npm audit`, `pip audit`.
- The project uses unconventional Telegram as CDN — cheap but fragile (channel deletion = data loss). Consider migrating to proper object storage (S3/R2) long-term.
- No backup strategy exists — implement Supabase daily backups, and export channel IDs mapping securely.
