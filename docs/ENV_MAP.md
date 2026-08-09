# Environment Variable Map — NexusEdu

**Never commit real values. Use `.env.example` as template.**

## Frontend (Vite) — must start with VITE_

| Variable | Purpose | Used By | Required | Example Format | Secret? | Recovery |
|----------|---------|---------|----------|----------------|---------|----------|
| VITE_SUPABASE_URL | Supabase project URL | `src/config/env.ts`, supabase client | Yes | `https://xyz.supabase.co` | No | Get from Supabase Dashboard > Settings > API > Project URL |
| VITE_SUPABASE_ANON_KEY | Supabase anon public key | supabase client | Yes | `eyJhbG...` JWT | No (public but keep) | Supabase Dashboard > API > anon key |
| VITE_API_BASE_URL | Backend base URL | `src/lib/api.ts`, `src/config/env.ts` | Yes in dev, fallback prod hardcoded | `https://nexusedu-backend-0bjq.onrender.com` or `http://localhost:8000` | No | Render dashboard backend URL |
| VITE_CLOUDFLARE_WORKER_URL | Drive proxy worker | `src/lib/api.ts:getStreamUrl` | No but needed for drive videos | `https://nexusedu-proxy.xxx.workers.dev` | No | Cloudflare dashboard worker URL |
| VITE_ENABLE_IP_FETCH | Opt-in ipify IP fetch for enrollment (privacy) | `useChapterAccess.ts` | No | `true`/`false` | No | Set false default |
| VITE_SITE_URL | Canonical site URL for SEO | `SEO.tsx` | No | `https://nexusedu.netlify.app` | No | Netlify URL |

**Removed (SECURITY FIX):** `VITE_ADMIN_TOKEN` — previously used to compute HMAC client side, leaked secret. Do NOT set. Backend now relies on JWT admin role only. Delete from env if present.

## Backend — Python FastAPI

| Variable | Purpose | Used By | Required | Example | Secret? | Recovery |
|----------|---------|---------|----------|---------|---------|----------|
| SUPABASE_URL | Supabase URL backend | `main.py`, `config.py`, `secrets_manager` | Yes | `https://xyz.supabase.co` | No | Same as frontend |
| SUPABASE_ANON_KEY | Anon key backend (for auth verification) | `main.py:verify_supabase_token` | Yes | `eyJ...` | No | Supabase |
| SUPABASE_SERVICE_KEY | Service role key bypass RLS | All admin endpoints, catalog fetch | Yes | `eyJ...` | **Yes** | Supabase > API > service_role (never expose to frontend) |
| JWT_SECRET | Legacy, not actually used now but config requires? Made optional now | `config.py` | No (now optional) | random 32+ chars | Yes | Generate `openssl rand -hex 32` if needed |
| ADMIN_TOKEN | HMAC secret for admin signature second factor + metrics protection | `core/security.py`, `metrics` endpoint | Yes (32+ chars) | `fake_admin_token_...` but must be random 64 chars in prod | **Yes** | Generate `openssl rand -hex 32` must be >=32 chars |
| ALLOWED_ORIGINS | CORS allowed origins comma-separated no spaces | `main.py:CORSMiddleware` | Yes | `http://localhost:5173,https://your-frontend.netlify.app` | No | List your frontend URLs |
| PORT | FastAPI port (Render sets) | `main.py:__main__` | No | `8000` | No | Default 8000/8080 |
| REDIS_URL | Redis for rate limiter + cache | `core/rate_limiter.py`, `core/cache.py` | No (fallback memory) | `rediss://default:pass@host:6379` | Yes | Upstash/RedisLabs or Render Redis |
| TRUSTED_PROXY_HOPS | How many proxy hops to trust for X-Forwarded-For IP | `rate_limiter.py:get_client_ip` | No default 1 | `1` | No | 1 for Render |
| TELEGRAM_API_ID | my.telegram.org app ID | `main.py`, `bot_manager`, `config.py` | Yes for Telegram | `12345678` | No | my.telegram.org |
| TELEGRAM_API_HASH | my.telegram.org hash | same | Yes | `abcdef123...` | Yes | my.telegram.org |
| PYROGRAM_SESSION_STRING | Pyrogram user session primary | `main.py:_start_telegram_clients` | Yes | `AgA...` long string | **Yes** | Generated via Pyrogram login script |
| PYROGRAM_SESSION_STRING_2 | Secondary session load balancing | `main.py` | No | `AgB...` | Yes | Same |
| TELEGRAM_BOT_TOKEN | BotFather token | `bot_manager.py` | Yes for bot | `123:AAF...` | Yes | @BotFather |
| ADMIN_CHAT_ID | Telegram user ID for alerts | `bot_manager`, `notification_service` | Yes | `123456789` | No | @userinfobot |
| THUMBNAIL_CHANNEL_ID | Channel for thumbnails -100... | `main.py:get_thumbnail` | Yes | `-1001234567890` | No | Telegram channel ID |
| PHY_C1_CHANNEL_ID .. PHY_C6 | Physics cycle channels | `CHANNEL_MAP` | Yes | `-100...` | No | Telegram channel IDs |
| CHE_C1_CHANNEL_ID .. CHE_C6 | Chemistry | same | Yes | `-100...` | No | Same |
| HM_C1_CHANNEL_ID .. HM_C6 | Higher Math | same | Yes | `-100...` | No | Same |
| WEBHOOK_URL | Public backend URL + /api/bot_webhook | `bot_manager.config` | Yes for bot webhook | `https://...onrender.com/api/bot_webhook` | No | Your backend URL |
| TELEGRAM_WEBHOOK_SECRET | Secret token for webhook verification | `main.py:telegram_webhook` (NEW) | Recommended | random 32 hex | Yes | `openssl rand -hex 32` |
| VITE_CLOUDFLARE_WORKER_URL (backend also uses) | Worker URL for drive proxy fallback | `main.py:stream_video` redirect | No default hardcoded | `https://nexusedu-proxy...workers.dev` | No | Cloudflare |
| METRICS_TOKEN (alternative) | Could use ADMIN_TOKEN for metrics scrap via X-Admin-Token header | `main.py:metrics` | No | same as ADMIN_TOKEN | Yes | Same |

## GitHub Secrets (CI/CD)

| Secret | Purpose | Used By |
|--------|---------|---------|
| RENDER_DEPLOY_HOOK | Trigger Render deploy on backend push | `backend-deploy.yml` |
| VITE_SUPABASE_URL | Build-time frontend | `ci.yml` |
| VITE_SUPABASE_ANON_KEY | Build-time frontend | `ci.yml` |
| VITE_API_BASE_URL | Build-time frontend | `ci.yml` |
| SITE_URL | Sitemap generation maybe | `generate-sitemap.mts` |
| NETLIFY_AUTH_TOKEN | Netlify deploy | `ci.yml` |
| NETLIFY_SITE_ID | Netlify site | `ci.yml` |

## Render Dashboard (Backend service)

- Add all backend variables listed above in Environment section.
- Ensure `PYTHON_VERSION` = `3.11.0` per render.yaml.
- Health check path `/health`.

## Netlify Dashboard (Frontend)

- Add VITE_ vars only.
- Trigger Clear cache and deploy after changing VITE_ vars (Vite bakes at build time).

## Recovery Status Legend

- ✅ Recoverable from repo evidence or Supabase dashboard
- ⚠️ Requires recreation (Telegram channels, bot, session)
- ❌ Permanent loss if not stored elsewhere (old channel IDs, video files)

Most secrets are **not recoverable from repo** — must be regenerated or retrieved from password manager / Render / Supabase dashboard.
