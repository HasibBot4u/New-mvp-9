# Mobile-Only Recovery & Operations Playbook (Android)

**Constraint honored:** everything here works from an Android phone + Chrome + free-tier services. No desktop is required for any step. Where a service UI may have changed, the *target setting* is described, not just the label.

---

## 0. Your mobile development environment (decision + why)

**Primary: GitHub Codespaces (browser)** — a real Linux VM (2 cores / 8 GB RAM on free tier) running in Chrome. It gives you the terminal this repo needs (Python 3.11, Node 20, pip/npm, pytest, builds) without touching your phone's RAM/storage. Free quota: ~120 core-hours/month per account. **Cost: Free.**
**Secondary: GitHub web editor** (press `.` on any repo page, or github.dev) for quick text edits/PR review. **Cost: Free.**
**Not recommended for THIS repo:** Termux-only setups (Pyrogram+Pillow builds drain battery/RAM and fail often on ARM), paid cloud IDEs.
**What CANNOT run on mobile:** nothing blocks you — Docker is *not* needed (Render/Netlify build remotely; CI builds in Actions).

### 📱 TASK: Open a Codespace
1. Open Chrome → `github.com` → sign in.
2. Go to `HasibBot4u/New-mvp-9`.
3. Tap **Code** → switch to the **Codespaces** tab → **Create codespace on main** (or on your branch).
4. Wait ~1–2 min; a VS-Code-like editor opens in the browser with a **Terminal** (☰ menu → Terminal → New Terminal).
5. Verify: type `python3 --version` (expect 3.11.x or install: `sudo apt update && sudo apt install -y python3.11 python3.11-venv` — Ubuntu images ship 3.10+; if only 3.10 shows, use `sudo apt install python3.11 python3.11-venv` then `python3.11 -m venv .venv`).
6. **If Codespaces is unavailable on your account:** fallback = GitHub web editor for file edits + rely on **GitHub Actions** to run builds/tests for you (`.github/workflows/ci.yml` already runs typecheck/lint/tests/build on push).

**Session tips (phone):** Codespaces auto-stops after 30 min idle — your files persist; just reopen. Keep ONE tab open; Chrome on Android kills background tabs aggressively.

---

## 1. GitHub workflow from your phone

| Operation | How (mobile) |
|---|---|
| View/edit a file | Repo page → tap file → 🖉 (edit) → commit; or inside Codespace |
| Branch | Repo → branch dropdown → type new name → create |
| Commit | In editor: commit box at bottom → message → **Commit** |
| Pull request | After push: repo banner "Compare & pull request" → Create |
| Review diffs | PR → **Files changed** tab (pinch to zoom) |
| Revert | PR page → **Revert** button (if merged); or edit file back |
| Actions logs | Repo → **Actions** tab → tap workflow run → tap job → tap step |
| Secrets | Repo → **Settings** → **Secrets and variables** → **Actions** → New repository secret |
| Vars (non-secret) | Same page → **Variables** tab (used for `BACKEND_URL`) |
| GitHub Mobile app | Optional; good for PR review + Actions notifications |

---

## 2. Backup strategy (BEFORE any big change)

1. **Code:** everything is already committed on branch `arena/019fe71a-new-mvp-9`; create a tag as safety snapshot: Codespace terminal → `git tag backup/pre-stage3-$(date +%F) && git push origin --tags`.
2. **Database:** Supabase free tier has no point-in-time backup → make a SQL dump from the Codespace:
   ```bash
   sudo apt install -y postgresql-client
   # Connection string: Supabase dashboard → Settings → Database → Connection string (URI) — keep it secret!
   pg_dump "postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres" > backup_$(date +%F).sql
   ```
   Download the file: in Codespace's file explorer, right-click (long-press) the file → **Download**. Store it anywhere private (e.g., your email-to-self). ⚠️ Never paste the DB password into chats, issues, or commits.
3. **Env vars:** write down (private note app) the NAMES you configured; never the values into the repo.

---

## 3. Database setup & migrations (phone-only)

Two routes — pick A (simplest):

**Route A — Supabase SQL Editor (recommended):**
1. `supabase.com` in Chrome → sign in → select project (or **New project**: name `nexusedu`, password you save privately, region Singapore — free tier).
2. Left menu → **SQL Editor** → **New query**.
3. From the repo, open `supabase/migrations/` and run the files **in filename order** (0001…, 0002…, 2026…, ending with `20260810000000_stage2_schema_reconciliation.sql`): copy file content → paste → **Run**. Expect green "Success".
   ⚠️ If a file errors: stop, screenshot, check the message — older files assume earlier ones ran first.
4. Make yourself admin (SQL Editor):
   ```sql
   -- find your user id: Supabase → Authentication → Users → your email → copy UUID
   UPDATE profiles SET role='admin' WHERE id='<your-uuid>';
   INSERT INTO user_roles (user_id, role) VALUES ('<your-uuid>', 'admin') ON CONFLICT DO NOTHING;
   ```
5. Verify: SQL Editor → `select count(*) from profiles;` and `\d`-style check: `select column_name from information_schema.columns where table_name='videos';` must show `file_size_bytes`, `file_id`, `mime_type`.

**Route B — CLI from Codespace** (if you prefer): `npm i -g supabase` → `supabase login` (opens browser auth) → `supabase link --project-ref <ref>` (ref is in project URL) → `supabase db push` → type PUSH when asked.

---

## 4. Environment configuration (where each value goes)

| Value | Where you set it | Platform |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` | Netlify site → Site configuration → Environment variables | Netlify dashboard (mobile browser) |
| All backend vars (Step-4 table in RECOVERY_FRESH_START.md) | Render service → Environment | Render dashboard (mobile browser) |
| `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `RENDER_DEPLOY_HOOK`, `VITE_*` build vars | GitHub → repo Settings → Secrets and variables → Actions | GitHub |
| `BACKEND_URL` (keep-alive target) | Same page → **Variables** tab | GitHub |
| Local dev `.env` files | Codespace terminal: `cp .env.example .env` then edit with the built-in editor; never commit | Codespace |

Secrets discipline: Supabase **service role** key, Telegram session strings, bot token, ADMIN_TOKEN, JWT_SECRET → only into Render env / GH secrets. Never into issues, chats, or committed files.

---

## 5. API testing from your phone

Use the **Codespace terminal** (curl) — most reliable. Template per endpoint:

```
Endpoint:  GET /api/health            → expect 200 {"status":"healthy"...}
Endpoint:  GET /api/ping              → expect 200 {"status":"ok"}   (no auth)
Endpoint:  GET /api/catalog           → expect 200 {"data":...} or 503 if DB unreachable
Endpoint:  GET /api/stream/anything   → expect 401 without auth (proof authz works)
Endpoint:  GET /api/stream-ticket/x   → expect 401 without auth
Endpoint:  GET /metrics               → expect 403 without admin (proof protection works)
```
Example:
```bash
curl -s https://<your-backend>.onrender.com/api/health | head -c 300
curl -s -o /dev/null -w "%{http_code}" https://<your-backend>.onrender.com/api/stream/test   # → 401
```
**No terminal available?** Plain Chrome works for GETs: type the URL; JSON appears in the tab. POSTs need an HTTP client app (e.g., "HTTP Shortcuts" from Play Store, free) — set header `Authorization: Bearer <token>` where required.
**Failure interpretation:** 401 = auth missing/expired · 403 = authz/blocked · 503 = Supabase/Telegram not configured · CORS error in browser = N-1 fix not deployed.

---

## 6. Deployment from your phone

**Backend (Render):**
1. `render.com` → sign in (GitHub login) → **New +** → **Web Service** → pick `New-mvp-9`.
2. Settings: name `nexusedu-backend`, region Singapore, branch `main`, runtime **Python**, plan **Free** (upgrade later for no-sleep), Build `pip install -r backend/requirements.txt`, Start `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, Root Directory **leave empty** (repo root!).
3. Environment: add every backend variable from §4. Add `PYTHON_VERSION=3.11.11`.
4. **Create Web Service** → watch the **Logs** tab until `===== BACKEND READY =====` (Telegram lines may warn if not configured yet — that's fine at this stage).
5. Verify: Logs show READY + `curl https://<svc>.onrender.com/api/health`.
6. Rollback: Render → service → **Deploys** tab → tap older deploy → **Deploy** (labels may vary: look for "restore/rollback this deploy").

**Frontend (Netlify):**
1. `app.netlify.com` → **Add new site** → **Import an existing project** → GitHub → `New-mvp-9`.
2. Build command `npm run build`, publish directory `dist` → set the 3 `VITE_*` env vars (Site configuration → Environment variables) → **Deploy**.
3. Verify: open the site URL → login page renders; after backend env is set, dashboard loads subjects.

**CI path (alternative):** push to `main` with GH secrets configured → Actions tab shows `CI/CD Pipeline` → green check + Netlify auto-publish. View any failure by tapping into the step logs; paste the failing line back to me for diagnosis.

---

## 7. Telegram reconstruction (all steps on Android)

| Resource | Original | Recoverable? | Recreate? | Where | Repo changes | Verification |
|---|---|---|---|---|---|---|
| 18 storage channels PHY/CHE/HM C1–C6 | Deleted | ❌ IDs & files lost | ✅ | Telegram app | 18 env vars + `cycles.telegram_channel_id` | `/api/channels/health` all ok |
| Thumbnail channel | Deleted | ❌ | ✅ | Telegram app | `THUMBNAIL_CHANNEL_ID` | `/api/thumbnail/{id}` returns image |
| Bot | Deleted | ❌ token lost | ✅ | @BotFather in Telegram | `TELEGRAM_BOT_TOKEN`, `WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET` | `/start` + `/ping` answer |
| API id/hash | Unknown | maybe | ✅ if needed | my.telegram.org (Chrome) | `TELEGRAM_API_ID/HASH` | session connects |
| Session string | lost with context | ❌ | ✅ | Codespace terminal (see below) | `PYROGRAM_SESSION_STRING` | watchdog log "connected" |
| Video files | Deleted | ❌ **permanent loss** | re-upload sources | channels | videos rows via admin panel | stream plays |

### 📱 TASK: Create channels & bot (Telegram Android app)
1. Install/open Telegram → ☰ → **New Channel** → name `NexusEdu PHY C1` → **Private** → create. Repeat for all 18 + `NexusEdu Thumbnails`. (Tip: do 3–4 at a time; app may rate-limit rapid creation — wait a few minutes between batches.)
2. In each channel: channel header → ⋮ → **Manage Channel** → **Administrators** → add **your own account** (Owner keeps full rights) and later the bot.
3. Bot: in Telegram search **@BotFather** → send `/newbot` → follow prompts → copy the token (keep private).
4. Get your numeric ID: message **@userinfobot** → it replies with your id → that's `ADMIN_CHAT_ID`.

### 📱 TASK: Session string (Codespace terminal — replaces the old forgotten one)
```bash
pip install pyrogram tgcrypto
python3 - <<'PY'
from pyrogram import Client
Client("nexusedu_session", api_id=<YOUR_API_ID>, api_hash="<YOUR_API_HASH>").run()
PY
```
It will ask your phone number + login code (Telegram sends it to your Telegram app) → then print/save the generated `nexusedu_session.session`. Convert to string:
```bash
python3 -c "print(open('nexusedu_session.session').read())"
```
Paste the single-line output into Render env `PYROGRAM_SESSION_STRING`. ⚠️ This string = full access to your Telegram account. Treat like a password.

### 📱 TASK: Channel IDs
In Codespace (after session works):
```bash
python3 scripts/get_channel_id.py   # prompts for EXACT channel name, prints -100… id
```
Run once per channel; put each id into the matching env var (`PHY_C1_CHANNEL_ID=-100xxxxxxxxxx` …), `THUMBNAIL_CHANNEL_ID`, and update DB:
```sql
UPDATE cycles SET telegram_channel_id='-100…' WHERE name='<cycle name>';
```
(Supabase SQL Editor — see §3.)

### 📱 TASK: Wire webhook & test
1. Set `WEBHOOK_URL=https://<your-backend>.onrender.com` and a random `TELEGRAM_WEBHOOK_SECRET` in Render env → redeploy (Render auto-deploys on push, or Deploys tab → Manual Deploy).
2. As admin, open `https://<backend>/api/setup_webhook` **while logged into the app** (it needs your admin JWT; easier: send `/start` to your bot first — the bot sets the webhook at startup).
3. In Telegram: message your bot `/start` then `/ping` → expect replies. `/status` shows webhook ✅.
4. Upload a small MP4 into `PHY C1` → watch Render **Logs** for `[TelegramUploadService] Queued file …` and `UploadWorker` lines → then create the video row in Admin → Content and play it.

---

## 8. Debugging from your phone

| Need | How |
|---|---|
| Backend errors | Render → service → **Logs** tab (live) |
| Build failures | GitHub → Actions → run → step log; Netlify/Render → build log tab |
| Frontend console | Not directly available on Android Chrome. Workaround: temporarily add Eruda by editing `index.html` (`<script src="https://cdn.jsdelivr.net/npm/eruda"></script><script>eruda.init()</script>`) on a branch, deploy, open the floating green button. Remove afterwards. |
| Reproduce a bug | Use the site in Chrome; screenshot with Android's power+volume; note exact steps/time → send to me |
| DB state | Supabase dashboard → Table Editor → browse rows; SQL Editor for queries |
| Evidence to return | Screenshot + URL + timestamp + the exact error text |

## 9. Manual-Action Register (everything ONLY you can do)

| ID | Action | Why | Platform | Difficulty | Depends on | Verify |
|---|---|---|---|---|---|---|
| M-1 | Confirm/recover GitHub access | repo + CI | github.com | easy | — | open repo |
| M-2 | Create/check Supabase project + run migrations | DB | supabase.com | medium | M-1 | §3.5 |
| M-3 | Create/check Render service + env vars | backend hosting | render.com | medium | M-2 | logs READY |
| M-4 | Create/check Netlify site + env vars | frontend | netlify.com | medium | M-3 URL | site loads |
| M-5 | Set GH secrets/vars | CI/keep-alive | github.com | easy | M-3, M-4 | Actions green |
| M-6 | my.telegram.org API id/hash | MTProto | Chrome | easy | phone number | values noted |
| M-7 | Session string generation | streaming auth | Codespace | medium | M-6 | session file |
| M-8 | Create 19 channels + permissions | storage | Telegram app | medium | — | channels exist |
| M-9 | Create bot via BotFather | ops/notify | Telegram app | easy | — | token noted |
| M-10 | Fill channel IDs (env + DB) | addressing | Render + Supabase | medium | M-8 | channels/health ok |
| M-11 | Re-upload video sources | content | Telegram app | hard/long | M-8 | worker queues them |
| M-12 | Set `JWT_SECRET`, `ADMIN_TOKEN` | tickets/metrics | Render env | easy | random 32+ chars | restart clean |
| M-13 | First E2E: signup → code redeem → play | proof | phone browser | easy | all above | video plays |

## 10. "Do this now" sequence

**TODAY (≈1–2 h):** M-1 → open Codespace → tag backup → M-2 (Supabase project + all migrations incl. Stage-3 file + admin row) → M-3 (Render service + env incl. JWT_SECRET) → see `BACKEND READY` + `/api/health` connected.
**AFTER THAT:** M-4 Netlify + M-5 secrets/vars → site loads, login works, free video errors only where Telegram is missing (expected).
**THEN:** M-6→M-10 Telegram rebuild (channels, session, bot, IDs) → `/api/channels/health` green → M-11 re-upload in batches → create catalog entries via admin panel → M-13 full E2E. Finally: test one enrollment approval, one blocked user, keep-alive, and set UptimeRobot (free) as backup pinger.

## 11. Final mobile recovery checklist
☐ Repo accessible on phone · ☐ Backup tag + SQL dump saved · ☐ Codespace ready · ☐ Deps install in Codespace (`pip install -r backend/requirements-dev.txt`, `npm install`) · ☐ Env vars configured (Render+Netlify+GH) · ☐ Supabase project up · ☐ All migrations applied incl. Stage-3 reconciliation · ☐ Admin role set · ☐ Telegram API creds · ☐ Session string generated · ☐ 19 channels created · ☐ Bot created + webhook live · ☐ Channel IDs in env+DB · ☐ `/api/channels/health` ok · ☐ API smoke tests (health/ping/stream-401) · ☐ Login/signup tested · ☐ Code redemption tested · ☐ Paid approval tested · ☐ Video streams on phone · ☐ Build green in Actions · ☐ Deployed · ☐ Keep-alive + UptimeRobot active · ☐ Docs read back.
