# NexusEdu — Full-Spectrum Forensic Repository Analysis

**Date:** 2026-08-09 · **Repo:** `HasibBot4u/New-mvp-9` · **Branch analyzed:** `arena/019fe71a-new-mvp-9` (base `5028066`)
**Method:** Static forensic analysis of all 327 tracked files (backend Python, frontend TS/React, SQL migrations, CI/CD, infra, docs). Every claim below carries an evidence reference. Confidence labels: **[HIGH]** directly verified in file, **[MED]** strongly inferred from evidence, **[LOW]** possible but unverified.

---

## 1. Executive Summary

NexusEdu is a **Bangladeshi HSC exam-prep video platform** (Bengali: "তোমার শিক্ষার নতুন দিগন্ত") streaming ~1,400 lecture videos (≈1.4 TB) for Physics, Chemistry and Higher Math. Its defining architectural decision: **Telegram private channels are used as free video storage/CDN**, streamed to browsers through a FastAPI MTProto proxy (`pyrogram`). Supabase (Postgres + Auth) is the database and identity provider; the frontend is a React 18 + Vite PWA deployed to Netlify; the backend runs on Render free tier with a GitHub-Actions keep-alive ping.

The repository is a **post-mortem snapshot**: the docs (`PROJECT_REVIVAL_ROADMAP.md`, `TELEGRAM_RECOVERY_GUIDE.md`) state the external Telegram infrastructure (18 channels + bot) was **deleted externally**, and a prior analysis session already produced a 68-item bug inventory and applied security patches (streaming authz, metrics protection, webhook secret, field whitelists). This report independently re-verifies those claims against the code and adds new findings the prior pass missed — notably:

- 🔴 **The backend cannot start from `requirements.txt` alone**: `main.py` imports `prometheus_client` at module level and `bot_manager.py` imports `python-telegram-bot`; neither is in `requirements.txt`/`pyproject.toml` (also missing: `psutil`, `python-dateutil`). Deployments relying on the pinned files **crash at import time**. (§6.9)
- 🔴 **Database schema drifted from migrations**: `profiles.role`, `videos.file_size_bytes`, `videos.mime_type`, `audit_logs.user_id`, `enrollment_codes.cycle_id` are all used by code but **created by no migration**. Audit-log writes and cycle-scoped enrollment codes are therefore broken against a migrations-only database. (§9)
- 🟠 **The payment-approval loop has no admin UI**: students insert into `pending_enrollments`, but nothing in the codebase ever reads/approves it. (§13.2)
- 🟠 **JWT bearer tokens travel in video URLs** (`/api/stream/{id}?token=…`), leaking credentials to history, Referer headers and any intermediary logs. (§12)
- 🟠 **Supabase service-role key usage with `ALLOWED_ORIGINS` from env** + CORS `allow_credentials=True`; misconfiguration risk is high. (§12)
- 🟡 Large amounts of **dead/mock code**: socket.io realtime (never mounted server-side), mocked bKash/Stripe checkouts, hardcoded mock admin-dashboard metrics, 3-line stub modules, orphaned pages (`BillingPage`, `Index`), duplicate components. (§31)

**Overall verdict:** a clever zero-budget architecture with a working core loop (auth → catalog → enroll-by-code → stream-from-Telegram), wrapped in heavy technical debt, several broken integrations, an unreliable migration history, and testing that is close to decorative. Production readiness is limited: it can serve a small cohort of students on paid Render tier, but not before fixing dependencies, schema drift, and the enrollment/payment loop.

---

## 2. Repository Discovery

| Attribute | Finding | Evidence |
|---|---|---|
| Name | `nexusedu` | `package.json` |
| Purpose | HSC (Bangladesh 12th-grade) video-course platform | `README.md`, `index.html` meta |
| Type | Two-app polyrepo layout in one repo: `src/` SPA + `backend/` Python API | directory tree |
| Languages | TypeScript (frontend), Python 3.11 (backend), SQL (migrations) | `.nvmrc`=20, `runtime.txt`=python-3.11.11 |
| Database | Supabase Postgres (16 migrations, ~37 tables, RLS) | `supabase/migrations/` |
| Video storage | **Telegram MTProto** via `pyrogram` — 18 private channels (3 subjects × 6 cycles) | `main.py:CHANNEL_MAP`, `docs/TELEGRAM_STORAGE.md` |
| Auth provider | Supabase Auth (JWT, email/password, magic-link redirect for reset) | `src/integrations/supabase/client.ts`, `AuthContext.tsx` |
| Payments | **Manual** bKash/Nagad "Send Money" + trxID submission; Stripe/bKash components are mocked and unwired | `EnrollmentPage.tsx`, `components/payment/*` |
| Hosting | Frontend: Netlify (`netlify.toml`); Backend: Render free tier (`render.yaml`, `Procfile`); Docker/Terraform present but unused/broken | §20 |
| CI/CD | GitHub Actions: CI (typecheck/lint/test/build + pytest + CodeQL + Netlify deploy), backend deploy hook, keep-alive cron | `.github/workflows/*` |
| Monitoring | Prometheus/Grafana/alert configs present but **metric names don't match the backend's actual metrics** (§22) | `prometheus.yml`, `alert.rules` |
| External services | Supabase, Telegram, Render, Netlify, GitHub Actions, Cloudflare Worker (drive proxy, referenced), ipify (opt-in), UptimeRobot (doc suggestion) | various |
| Entry points | FE: `src/main.tsx` → `App.tsx`; BE: `backend/main.py:app` (uvicorn) | verified |

**Git history:** exactly one squashed import commit (`5028066 "Clean .gitignore"`, 327 files) plus a merge of the prior arena session. **No development history is recoverable** — this is a snapshot, so §24 (git analysis) is necessarily shallow. [HIGH]

---

## 3. Repository Topology

```
New-mvp-9/
├── src/                      # React 18 SPA (Vite) — the student+admin app
│   ├── main.tsx              # entry: web-vitals, SW registration, PWA prompt
│   ├── App.tsx               # router + providers (lazy routes, 3 route groups)
│   ├── config/env.ts         # env validation; hardcodes prod backend fallback URL
│   ├── integrations/supabase # supabase-js client + generated types
│   ├── contexts/             # Auth, Catalog, SystemSettings (React Context)
│   ├── store/                # zustand: catalog(IDB-persisted), progress, player, download, ui
│   ├── hooks/                # 20 hooks (access, fingerprint, progress batching, ws…)
│   ├── lib/                  # api client, analytics, activityLogger, push, thumbnails
│   ├── components/           # ~50 app components + 45 shadcn/ui primitives + a11y/live/payment/seo/video/virtual/three
│   └── pages/                # auth(4), public(7), student(14), admin(9) + Index/NotFound/Maintenance
├── backend/                  # FastAPI monolith (Python 3.11)
│   ├── main.py               # 2,455 lines — ALL routing, streaming, admin CRUD
│   ├── bot_manager.py        # python-telegram-bot webhook bot (669 lines)
│   ├── config.py             # pydantic-settings (mostly BYPASSED by main.py's os.environ reads)
│   ├── dependencies.py       # FastAPI Depends auth (used ONLY by api/admin/upload.py)
│   ├── core/                 # security (secrets+HMAC+bcrypt), rate_limiter, cache(dead), exceptions(unused)
│   ├── middleware/           # audit_middleware (writes audit_logs)
│   ├── realtime/             # socket.io server + events — NEVER MOUNTED in main.py
│   ├── services/             # cdn(mock), watermark(mock), stream_service(unused), notification, telegram_upload, video_processor
│   ├── workers/              # upload_worker (active), email/report workers (3-line stubs)
│   ├── api/admin/upload.py   # bulk ops router (only real APIRouter)
│   ├── models|schemas|utils/ # 3-line stubs (UserModel, validators, formatters…)
│   └── tests/                # 4 tiny pytest files, 2 target nonexistent routes
├── supabase/migrations/      # 16 SQL files, chronologically inconsistent (§9)
├── docs/                     # 21 docs incl. prior forensic pass (BUG_INVENTORY 68 items)
├── scripts/                  # setup.py, validate_env.py, deploy.sh(broken), sitemap, get_channel_id.py
├── .github/workflows/        # ci.yml, backend-deploy.yml, keep-alive.yml
├── public/                   # manifest, sw.js (3-cache PWA), robots, og-image
└── infra configs             # Dockerfile(root), docker-compose, render.yaml, Procfile, netlify.toml, terraform/, prometheus, grafana, alert.rules, Makefile
```

**Actively used:** `src/`, `backend/main.py`, `bot_manager.py`, `core/{security,rate_limiter}`, `middleware/audit`, `workers/upload_worker`, `services/{notification,telegram_upload,video_processor}`, `api/admin/upload.py`, migrations, CI.
**Obsolete/dead (evidence in §31):** `backend/core/cache.py`, `core/exceptions.py`, `core/events.py`, `realtime/*`, `services/{cdn,watermark,stream_service}`, `workers/{email,report}`, `models/*`, `schemas/*`, `utils/*`, several frontend components/pages.


---

## 4. Complete Tech Stack Forensics (evidence-based, not manifest-based)

### Frontend
| Concern | Technology | Evidence |
|---|---|---|
| Framework | React 18.3 + react-dom | `package.json`, `main.tsx` |
| Bundler | Vite 5 (`vite.config.ts`) with manual chunk splitting (`three`, `charts`, `pdf`, `radix`, `vendor`, `react`) | `vite.config.ts` |
| Language | TypeScript 5.8, `strict:true`, `noUnusedLocals` | `tsconfig.json` |
| Routing | react-router-dom 6.30, all routes `React.lazy` in `App.tsx` | `App.tsx` |
| Server state | TanStack Query 5 (5-min staleTime, retry 1) | `App.tsx:queryClient` |
| Client state | Zustand 5 × 5 stores; `catalogStore` persisted to **IndexedDB** via `idb-keyval` | `src/store/*` |
| Also state | React Context ×3 (Auth, Catalog, SystemSettings) — overlaps with stores (§28) | `src/contexts/*` |
| UI kit | shadcn/ui (Radix 24 primitives + CVA + tailwind-merge), `components.json` | `src/components/ui/*` |
| Styling | Tailwind 3.4 + typography plugin + custom dark theme, glass utilities | `tailwind.config.ts`, `index.css` |
| Forms | react-hook-form + zod resolvers (declared; actual pages mostly hand-rolled forms) | `package.json`, `EnrollmentPage.tsx` |
| Video | native `<video>` + Range streaming; `react-pdf`/`pdfjs-dist` for resources; three.js hero | `PlayerPage.tsx`, `PDFViewer.tsx` |
| Animation | framer-motion 12 | `package.json` |
| Realtime client | socket.io-client 4 — pointed at `VITE_API_URL` (default `http://localhost:8080`); **server never serves socket.io** (§12.7) | `useWebSocket.ts` |
| Data clients | `@supabase/supabase-js` **and** raw `fetch` to FastAPI **and** axios (declared, only bundled into vendor chunk) | `lib/api.ts`, `vite.config.ts` |
| PWA | hand-written `public/sw.js` (3 caches: static/catalog/thumbnails), `manifest.json`, install prompt handling | `main.tsx`, `sw.js` |
| SEO | react-helmet-async, JSON-LD in `index.html`, sitemap generator script, robots.txt | `components/SEO.tsx`, `scripts/generate-sitemap.mts` |
| Perf telemetry | web-vitals → batched → `sendBeacon`/fetch to `/api/activity` | `main.tsx` |
| Virtualization | react-window + @tanstack/react-virtual + react-virtualized-auto-sizer declared; only `VirtualVideoList` used once | `components/virtual/*` |

### Backend
| Concern | Technology | Evidence |
|---|---|---|
| Runtime | Python 3.11.11 (`runtime.txt`, `.python-version`, `pyproject.toml ^3.11`) | files |
| Framework | FastAPI 0.115.5 + uvicorn 0.32, **single worker** (`Procfile`) | `requirements.txt`, `Procfile` |
| Telegram (streaming) | `pyrogram 2.0.106` + `tgcrypto` (MTProto user session via session string) | `main.py` |
| Telegram (bot) | `python-telegram-bot` v21 API style — **not in requirements** 🔴 | `bot_manager.py` imports |
| HTTP | `httpx` (per-request clients in ~20 places; one unused shared helper `get_http_client()`) | `main.py` |
| Cache | in-process `LRUDict` (messages, tokens), dict catalog cache 300s; Redis code paths exist (`rate_limiter` uses redis.asyncio if `REDIS_URL`) but `core/cache.py` (aioredis) is dead/broken | `main.py`, `core/*` |
| Auth verify | calls Supabase GoTrue `GET /auth/v1/user` per token (cached 60–300s) | `main.py:verify_supabase_token`, `dependencies.py` |
| Crypto | bcrypt (`core/security.py`), HMAC-SHA256 admin signatures with nonce cache, `secrets.token_hex` codes | `core/security.py` |
| Metrics | `prometheus_client` Counter/Histogram middleware — **not in requirements** 🔴 | `main.py:870` |
| Sysinfo | `psutil` — **not in requirements** 🔴 | `main.py` lifespan/metrics |
| Date parsing | `python-dateutil` — **not in requirements** 🔴 | `main.py:admin_get_user_stats` |
| Socket.io | `python-socketio[asyncio]` installed but **never attached to the ASGI app** | `realtime/socket_server.py`, no `init_socket_app` call anywhere |
| Image | Pillow 10.3 (thumbnails in `video_processor.py`) | requirements |
| DB access | raw PostgREST over httpx with **service-role key**; plus `supabase==2.4.0` AsyncClient used in 2 places | `main.py` |

### Database
PostgreSQL via Supabase (PostgREST + GoTrue + RLS). 16 migrations, ~37 tables, SECURITY DEFINER RPC functions, dynamic "Admins have full access" policy loops. Details §9.

### Infrastructure
Netlify (static FE), Render (free tier BE, 1 worker), GitHub Actions (CI/deploy/keep-alive), Docker Compose for local dev, unused Terraform/Prometheus/Grafana artifacts. Details §20.

---

## 5. Architecture Reconstruction

**Pattern:** a **monolithic FastAPI streaming proxy + BaaS hybrid**.
- Supabase is simultaneously: identity provider (GoTrue JWT), primary DB (PostgREST + RLS), and **direct frontend data layer** (the SPA talks to Supabase directly for catalog, notes, progress reads, enrollment codes, admin CRUD fallbacks).
- The FastAPI backend exists for the things Supabase can't do: **MTProto video streaming**, server-side authorization of streams, admin HMAC endpoints, activity logging, bot webhook hosting, upload pipeline.
- Telegram is the blob store: `videos.telegram_channel_id/message_id` address bytes; the backend proxies byte-ranges to browsers.

**Layering reality:** not clean/hexagonal. `main.py` is a 2,455-line god module containing config reading, Telegram lifecycle, catalog building, streaming, auth helpers, activity logging, and all admin endpoints. The `core/`, `services/`, `workers/`, `schemas/`, `models/` packages create the *appearance* of layered architecture, but most are stubs or unused (verified in §31). Only `bot_manager`, `upload_worker`, `telegram_upload_service`, `notification_service`, `video_processor`, `audit_middleware`, `core.security`, `core.rate_limiter`, `dependencies` are live.

**Two parallel admin-auth systems coexist** [HIGH]:
1. `main.py:_ensure_admin` — inline `await` helper checking `profiles.role` then `user_roles` (used by 20+ endpoints in main.py).
2. `dependencies.py:get_current_admin` — proper FastAPI `Depends()` checking `profiles.role` only (used solely by `api/admin/upload.py`).
They diverge (different tables consulted, different error codes 401 vs 403).

**Two parallel catalog pipelines coexist** [HIGH]:
1. Frontend `CatalogContext` queries Supabase directly (4 parallel `select`s, respects RLS) → used by all student pages.
2. Backend `/api/catalog` builds a nested JSON from the same tables with the service key → consumed only by the service worker cache and `api.getCatalogWithCache` (which no page uses).
Result: duplicate work, divergent shapes (`CatalogContext` has no `description` on cycles etc.), and two caches (React Query 5min + IndexedDB store + backend 300s + SW 1h).

**Two token-verification implementations** [HIGH]: `main.py:verify_supabase_token` (LRU 5000/300s, raw token key) and `dependencies.py:verify_token` (TTL 1000/60s, SHA-256 of token as key — the safer one, used only by upload router). The main.py version caches **raw JWTs as dict keys** in memory.

**Contradictions with README/docs** (§29): `docs/ARCHITECTURE.md` honestly lists socket.io/Celery/Redis-caching as NOT IMPLEMENTED, yet `requirements.txt` installs python-socketio and the code contains a socket server; `docs/API.md` documents `/api/v1/...` routes that don't exist; `RENDER_DEPLOYMENT_INSTRUCTIONS.md` points to a non-existent `backend/Dockerfile` (the Dockerfile is at repo root); `README` says backend starts with `uvicorn main:app` from `backend/`, but `main.py` uses absolute imports `from backend.core...` which only work from repo root.

### Master system map (as actually implemented)

```
                        ┌──────────────────────────────────────────────┐
                        │               STUDENT / ADMIN BROWSER        │
                        │   React PWA (Netlify) — lazy routes, SW      │
                        └───────┬──────────────────────────┬───────────┘
              supabase-js (anon key, RLS)          fetch (Bearer JWT; ?token= for <video>)
                                │                                  │
                 ┌──────────────▼───────────────┐     ┌────────────▼─────────────────┐
                 │  SUPABASE (Postgres+GoTrue)  │◄────┤  FASTAPI on Render (1 worker)│
                 │  profiles, subjects, cycles, │ svc │  main.py god-module          │
                 │  chapters, videos, codes,    │ key │  ├ middleware: CORS→BodySize →│
                 │  chapter_access, watch_hist, │     │  │  Audit→SecHeaders→Timeout→ │
                 │  activity/audit logs, …      │     │  │  GlobalExc→Prometheus      │
                 └──────────────▲───────────────┘     │  ├ /api/stream/{id} ─────────────┐
                                │                     │  ├ /api/catalog,/refresh,/warmup │
             bot HTTP API       │                     │  ├ /api/admin/* (CRUD, users,    │
                                │                     │  │   metrics, codes, announces)  │
                 ┌──────────────┴──────────┐          │  ├ /api/progress/batch,/activity │
                 │ TELEGRAM (MTProto +     │◄─────────┤  ├ /api/bot_webhook,/setup_webhook│
                 │ 18 private channels,    │ pyrogram │  └ upload_worker poll loop ──┐   │
                 │ thumbnail channel, bot) │ stream/  │        ▲                     │   │
                 └─────────────────────────┘ upload   │  upload_queue (Supabase) ◄───┘   │
                                                      └──────────────────────────────────┘
                    [DEAD] socket.io realtime, Redis multilayer cache, CDN/watermark mocks
```

---

## 6. Backend Forensics — `backend/main.py` anatomy

### 6.1 Startup (`lifespan`, main.py:641-737)
1. `rate_limiter.connect()` — pings Redis; on failure logs warning and degrades to in-memory limiting.
2. Creates `supabase.AsyncClient` if URL+service key present.
3. Starts Telegram clients **as background task** (non-blocking fix from prior pass), waits ≤10s.
4. `bot_manager.initialize()` — builds python-telegram-bot Application, sets webhook, notifies admin chat.
5. If primary TG client up: `init_notification_service`, `init_telegram_upload_service(tg)` (registers an `on_message` handler for video/document messages in the 18 channels → inserts `upload_queue` rows), starts `UploadWorker` (polls `upload_queue` every 10s).
6. `refresh_catalog()` — loads subjects/cycles/chapters/videos (+telegram secrets via service key) into three globals: `catalog_cache` (nested JSON, 300s TTL), `video_map` (video→{channel,message,source,…}), `chapter_lookup` (chapter→{requires_enrollment,…}).
7. Spawns `telegram_watchdog()` (60s reconnect loop with exponential backoff) and `memory_monitor()` (psutil RSS log every 5min).

**Failure behavior:** every external dependency is wrapped in try/except; app boots with Telegram disabled and logs "videos will not stream" [HIGH].

### 6.2 Middleware pipeline (order of `add_middleware` = reverse execution)
Request flow: **CORS → BodySizeLimit(50MB) → AuditMiddleware → SecurityHeaders → Timeout(30s) → GlobalExceptionHandler → Prometheus → route** [HIGH, main.py:809-868].

| Middleware | Role | Issues |
|---|---|---|
| CORS | origins from `ALLOWED_ORIGINS` env, `allow_credentials=True`, exposes Range headers | Wildcard misconfig + credentials would be dangerous; env-driven list is the only guard |
| BodySizeLimit | 413 if `Content-Length` > 50MB | Header-only check (chunked bodies bypass) [MED] |
| AuditMiddleware | logs `/api/admin/*` + `/api/auth/*` to `audit_logs` via BackgroundTask | writes `user_id` column that **does not exist in any migration** → every audit write 400s and is swallowed by try/except [HIGH] |
| SecurityHeaders | HSTS, XFO=DENY, dynamic CSP incl. worker domain | CSP on API responses has near-zero effect (no HTML served); fine but cosmetic |
| Timeout | hard 30s `wait_for` | **Breaks long video range requests**: a single 50MB range under slow Telegram can exceed 30s → 504 mid-stream [MED] |
| GlobalExceptionHandler | catches unhandled → generic 500 JSON | Good; but also masks root causes in prod logs |
| Prometheus | Counter/Histogram per path | `request.url.path` untemplated label → per-video cardinality (`/api/stream/{uuid}`) **unbounded metric cardinality** [MED] |

### 6.3 Endpoint inventory (43 routes; auth = Supabase JWT via GoTrue lookup unless noted)

| Method | Path | Auth | Purpose | Notes/Risk |
|---|---|---|---|---|
| GET | `/`, `/health`, `/api/ping`, `/api/health` | none | health probes | keep-alive targets `/api/ping`,`/api/warmup` |
| GET | `/metrics` | ADMIN_TOKEN header **or** admin JWT | Prometheus scrape | fixed in prior pass [HIGH] |
| GET | `/api/thumbnail/{video_id}` | optional (not enforced) | streams Telegram photo/thumb | unauth enumeration remains; rate-limited; placeholder redirect |
| POST | `/api/bot_webhook` | webhook secret (if set) + RL 60/min | Telegram updates → bot_manager | returns 200 on errors (Telegram retry semantics) |
| GET | `/api/setup_webhook` | admin | (re)set bot webhook | fixed in prior pass |
| GET | `/api/catalog` | optional | nested catalog JSON, 300s cache | no pagination; full-catalog egress |
| GET | `/api/refresh` | none (RL 5/min) | force catalog rebuild | DoS lever; per-process throttle only |
| GET/POST | `/api/warmup` | none (RL 10/min) | keep-alive + cache warm | used by GH cron |
| GET | `/api/prefetch/{video_id}` | none (RL 50/min) | pre-fetch TG message into LRU | unauthenticated; leaks size_mb |
| GET/HEAD | `/api/stream/{video_id}` | **JWT required** (header or `?token=`) | Range-capable MTProto byte proxy; ≤3 concurrent streams/user; RL 120/min; 50MB per-range cap; enrollment check via `chapter_access` | core product endpoint (§6.4) |
| GET | `/api/channels/health` | JWT | per-channel get_chat + usage counters | sequential N Telegram calls; leaks member counts |
| POST | `/api/activity` | JWT | client telemetry → `activity_logs` | 2KB payload cap [HIGH] |
| POST | `/api/progress/batch` | JWT | batch upsert `watch_history` (≤100 rows, validated ids, ≥95% ⇒ completed) | business rule §13.4 |
| POST | `/api/admin/verify` | JWT | `{is_admin}` probe | uses anon key + user JWT to read own role — fine |
| POST | `/api/admin/delete_user` | admin JWT **+ required HMAC sig** | GoTrue admin DELETE `/auth/v1/admin/users/{id}` with `DELETE-{id}` confirmation | the only endpoint where HMAC is mandatory |
| POST | `/api/admin/generate_chapter_code` | admin JWT | inserts enrollment codes (`secrets.token_hex`) | inserts `cycle_id` column that **no migration creates** → cycle codes fail [HIGH]; ignores client `expires_at` silently |
| GET | `/api/admin/users/{id}/profile|activity|watch-history|stats|notes|sessions` | admin JWT (RL 20/min) | user surveillance panel | service-key reads; `stats` parses every activity row client-side (O(N)) |
| POST/PUT/DELETE | `/api/admin/{subjects,cycles,chapters,videos}` | admin JWT (HMAC optional) | CRUD via PostgREST with **field whitelists** + `asyncio.create_task(refresh_catalog())` | DELETE is hard delete (soft-delete column exists but unused) |
| POST/GET | `/api/admin/announcements` | admin JWT | insert/list announcements | **schema conflict**: writes `message,target,priority,sent_at` but the first migration's `announcements` table has `title,body,type,…`; whichever table exists first wins (§9.6) |
| GET | `/api/admin/logs` | admin JWT | activity logs + profile join | raw PostgREST URL string concat (`since` param unescaped into URL → PostgREST injection surface, though low impact) [MED] |
| GET | `/api/admin/dashboard/metrics` | admin JWT | live users, streams, psutil, TG channel health, signups, errors, popular videos | 6+ sequential Supabase queries + N Telegram `get_chat` calls, no cache |
| POST | `/api/admin/bulk_url_upload` | admin (Depends) | **501 Not Implemented** | dead route |
| POST | `/api/admin/bulk_delete` / `bulk_move` / PATCH `bulk_update` | admin (Depends) | UUID4-validated filters + whitelists | prior-pass hardening verified [HIGH] |

### 6.4 The streaming chain (product core) — full trace
```
<video src="{API}/api/stream/{uuid}?token=JWT">   (PlayerPage.tsx:421 videoSrc)
  → browser GET with Range: bytes=N-M
  → CORS/Body/Audit/Sec/Timeout/Prometheus middlewares
  → stream_video():
     1. verify_supabase_token(auth) → GoTrue GET /auth/v1/user (LRU-cached 300s) → 401
     2. concurrent_user_streams[user_id] >= 3 → 429                      (in-process only)
     3. regex id validation (+UUID parse if 36 chars) → 400
     4. check_rate_limit(ip, 120/min, "stream") → 429                    (Redis or memory)
     5. internal_log_activity("stream_start") → activity_logs            (fire-and-forget task)
     6. video_map lookup; miss → refresh_catalog() once → 404 if still missing
     7. _check_user_chapter_access():
          chapter_lookup[chapter].requires_enrollment? →
            GET chapter_access?user_id&chapter_id&is_blocked=false (service key) →
            allow if row exists OR user is admin (profiles.role OR user_roles)
          miss in chapter_lookup → permissive (fail-open) + log          🔴 fail-open window
     8. source_type dispatch:
          drive  → 302 to {CLOUDFLARE_WORKER}/drive/{file_id}            (worker authz unknown/absent)
          youtube→ 400 "client handles"
          telegram→ continue
     9. ensure_telegram_connected() (20s-cached health, lock-protected reconnect)
    10. resolve_channel(cid) → get_message (LRU 300/1h) → media.file_size/mime
    11. _parse_range → clamp to 50MB per response
    12. StreamingResponse(_tracked_stream()) → pyrogram stream_media(offset=chunk, limit=needed)
        - increments/decrements concurrent counter around generator (finally-guarded)
        - headers: 206, Content-Range, Accept-Ranges, Cache-Control: private, no-store
```
**Weaknesses verified:** fail-open on `chapter_lookup` miss (§12 A-3); token-in-URL (§12 A-2); 30s timeout middleware vs long ranges (§6.2); per-process concurrency counter bypassed by multi-worker or multiple Render instances (§18).

### 6.5 Bot manager (`bot_manager.py`, 669 lines)
Webhook-mode python-telegram-bot app. Public commands: `/start /help /ping`. Admin (by `ADMIN_CHAT_ID` match): `/status /stats /notify /scan /scan_cancel`.
- `/scan` walks `get_chat_history(limit=100)` over every `*_CHANNEL_ID` env var counting videos/documents — content inventory recovery tool.
- `/notify` broadcasts to all channels (1s pacing, RetryAfter handling).
- `/stats` imports globals from `backend.main` (circular import at call time, works because deferred).
- Webhook path bug [HIGH]: `_set_webhook` computes `webhook_path = f"{self.config.WEBHOOK_URL}/api/bot_webhook"` but `WEBHOOK_URL` is documented as **already including** `/api/bot_webhook` (`.env.example`: `WEBHOOK_URL=https://fake-backend.onrender.com/api/bot_webhook`) → double-suffix `…/api/bot_webhook/api/bot_webhook` unless the operator sets the bare host. Config trap.

### 6.6 Upload pipeline (`telegram_upload_service.py` → `upload_queue` → `upload_worker.py` → `video_processor.py`)
- Pyrogram handler detects new video/document in watched channels → inserts `upload_queue` row (pending).
- Worker polls every 10s: downloads file to disk (progress every 5%), extracts metadata, generates thumbnails (skipped on Render free tier), uploads best thumb to `THUMBNAIL_CHANNEL_ID`, patches `videos.thumbnail_telegram_message_id` (filter `file_id=eq.{file_id}` — **but `videos` has no `file_id` column** → patch matches nothing [HIGH]), notifies admin via bot token HTTP API, cleans up temp files (good: finally-blocks everywhere).
- Variant generation (HLS-ish 360/720/1080) exists but **re-upload is stubbed out** ("In a real workflow you'd upload…") — `video_variants` never populated [HIGH].

### 6.7 `dependencies.py` (parallel auth system)
`verify_token` → GoTrue check, SHA-256-keyed 60s cache, proper 503 on timeout; `get_current_admin` → reads `profiles.role` **only** (no `user_roles` fallback, unlike main.py's `_ensure_admin`). Inconsistency: admin stored only in `user_roles` can bulk-delete via upload router? No — upload router requires `profiles.role=admin`, while main.py admin endpoints accept either. Divergent privilege evaluation [HIGH].

### 6.8 `config.py` vs reality
`Settings` (pydantic-settings) defines the "official" config incl. `jwt_secret`, `rate_limit_per_minute`, `telegram_webhook_secret`, `cloudflare_worker_url`. **But `main.py` reads `os.environ` directly for everything** and only imports `settings.allowed_origins` at line 812. `jwt_secret` and `rate_limit_per_minute` are therefore **inert** [HIGH]. `core/cache.py` imports `get_settings` which doesn't exist → module would crash on import, proof it's never imported [HIGH].

### 6.9 Dependency manifest contradiction 🔴
`main.py` line 870 (module scope): `from prometheus_client import …`; `bot_manager.py` line ~19: `from telegram import …`; `main.py` lifespan/metrics: `import psutil`; admin stats: `from dateutil import parser`. **None of** `prometheus-client`, `python-telegram-bot`, `psutil`, `python-dateutil` appear in `backend/requirements.txt`, `requirements-dev.txt`, or `pyproject.toml` [HIGH — verified by grep]. Docker (`Dockerfile`) and Render (`render.yaml`) both install *only* `requirements.txt`. ⇒ A clean build of this repo **fails at import time**. The running production instance (if any) must have extra packages installed outside the repo — or is running stale code. CI (`ci.yml`) runs `pytest backend/tests` which imports `backend.main` → **CI backend job must also fail**. Confidence: High — verified in files.

---

## 7. Frontend Forensics

### 7.1 Boot & providers (`main.tsx`, `App.tsx`)
`main.tsx`: registers web-vitals (LCP/INP/CLS/TTFB/FCP → 5s-batched → `sendBeacon('/api/activity')`; beacon payload is `{action:'web_vital', details}` — **matches backend `ActivityLogReq` shape**, but `sendBeacon` sends **without Authorization** so backend returns 401 and the vitals are lost [HIGH — cross-verified main.py `/api/activity` requires JWT]. Also registers `/sw.js`, captures `beforeinstallprompt`.
`App.tsx`: `QueryClientProvider → SystemSettingsProvider → TooltipProvider → (OfflineBanner, UpdateToast, dual Toasters) → BrowserRouter → RouteAnalytics/SkipLink/LiveRegion → AuthProvider → CatalogProvider → Routes`. Route groups:
- **Public** (inside `PublicShell`): `/about /pricing /contact /privacy /terms /refund-policy /success-stories`; `/` redirects to `/dashboard` or `/login` by auth state.
- **Auth**: `/login /signup /forgot-password /reset-password /maintenance`.
- **Student** (ProtectedRoute + StudentLayout): `/dashboard /courses /subject/:slug /cycle/:cycleId /chapter/:chapterId /watch/:videoId /search /notifications /live /progress /profile /notes /resources /enrollment`.
- **Admin** (ProtectedRoute requireAdmin + AdminLayout): `/admin[+ /dashboard] /users[/:userId] /content /announcements /live /logs /system /enrollment`.
**Dead routes/pages:** `pages/Index.tsx` and `pages/student/BillingPage.tsx` are imported nowhere; `/billing` not routed [HIGH].

### 7.2 Auth lifecycle (`AuthContext.tsx`) — trace
`onAuthStateChange` + `getSession()` (both 10s `withTimeout`) → `fetchProfile` (`profiles.select('*').eq(id).maybeSingle()`, 10s timeout) → profile fallback synthesizes `{role:'user'}` if row missing → **if `profile.is_blocked` → forced signOut** (client-enforced; no server-side session revocation). Proactive token refresh scheduled 5 min before `expires_at`. `signIn` logs activity via backend `/api/activity`; `signUp` sets `emailRedirectTo=/dashboard` and passes `display_name` metadata. `isAdmin = profile?.role === 'admin'`.
**Issue:** `profiles` row schema in migrations has **no `role` column**; `integrations/supabase/types.ts` profiles row lacks `role` too. The app only works if the live DB was hand-altered. [HIGH]

### 7.3 Catalog pipeline (student data backbone)
`CatalogContext` (React Query 5min) → 4 parallel Supabase selects (subjects/cycles/chapters/videos, `is_active=true`, ordered) → maps rows → builds nested tree + `videoMap` → persists raw rows to `useCatalogStore` (IndexedDB) for **offline restore** (`!navigator.onLine` path serves cache <24h old).
Duplication: backend `/api/catalog` + SW cache + `api.getCatalogWithCache` form a second, unused-by-pages pipeline [HIGH].

### 7.4 Video playback chain (telegram) — UI → bytes
`VideoListPage` → navigate `/watch/:id` → `PlayerPage`:
1. resolve video/chapter from `useCatalog()` (nested loop; O(catalog)).
2. `getVideoSource()`: youtube → embed iframe; drive → `drive.google.com/.../preview` iframe; telegram → `${API}/api/stream/{id}` + poster `${API}/api/thumbnail/{id}`.
3. session token via `getSession()` + `onAuthStateChange` → `videoSrc = url + '?token=' + JWT` → plain `<video src>` (native range requests).
4. Resume: reads `watch_history.progress_seconds` (direct Supabase select) → sets `currentTime` on `readyState>=1`.
5. Progress writes: `useBatchProgress` — Map accumulator, flush every 10s + `beforeunload/pagehide/visibilitychange` → POST `/api/progress/batch` with `keepalive:true`, one retry after 2s.
6. Notes: debounced 2s upsert into `video_notes` (onConflict user_id,video_id).
7. UX: keyboard shortcuts (space/k/j/l/f/m/arrows), double-tap ±10s zones, swipe left/right for next/prev, auto-pause on tab hide, error classification via HEAD probe (403/404/network), `data-watermark={user?.email}` attribute (CSS overlay watermark — forensic deterrent only).
**Issues:** JWT in URL (§12); `updateProgress` called on `ended` with `duration` twice (OK), but progress store (`store/progressStore.ts`) is **unused by PlayerPage** (dead state, TODO comment inside) [HIGH].

### 7.5 Enrollment/access chain (client side)
- `useChapterAccess`: `checkAccess(chapterId)` → `getDeviceFingerprint()` (SHA-256 of UA+screen+tz+lang+cores; **spoofable, documented as non-security**) → RPC `check_chapter_access(chapter, fingerprint)` → caches in localStorage `nexus_access_map`.
- `submitCode` → normalizes code → RPC `use_chapter_enrollment_code(code, chapter, fingerprint, ua)`; optional ipify IP fetch **disabled by default** (`VITE_ENABLE_IP_FETCH`), fixing prior privacy leak [verified].
- `EnrollmentPage` (manual payment): lists chapters with `requires_enrollment`, student pays externally (bKash number shown: placeholder `123456789` in code 🔴), submits `{transaction_id, amount, payment_method}` → inserts `pending_enrollments` → **nothing consumes it** (§13.2).
- `EnrollmentCodeModal` + chapter gates in `VideoListPage` enforce lock UI (client-side only; the true gate is backend `/api/stream` 403).

### 7.6 Admin panel (9 pages)
- **AdminDashboardPage**: fires ~8 parallel Supabase queries via `safeQuery` (users count, watch hours, errors, signups, popular videos, recent activity) + `useRealtime()` (Supabase channel listener for videos INSERT → toast) + calls backend `/api/admin/dashboard/metrics` in `useAdminStats`.
- **AdminUsersPage / AdminUserDetailPage**: list/search users, deep-dive per user (profile/activity/watch-history/stats/notes/sessions via backend admin endpoints), block toggle writes `profiles.is_blocked` directly via supabase-js (RLS admin policy).
- **AdminContentPage**: tree CRUD of subjects/cycles/chapters/videos. `apiCall()` tries backend `/api/admin/*` first, **falls back to direct supabase-js insert/update/delete on any API failure** [HIGH] — bypasses backend whitelists/audit when backend is down or 4xx; also quick-generates enrollment codes client-side (`crypto.getRandomValues`, direct insert).
- **AdminEnrollmentPage**: code management (generate via backend — includes `expires_at` that backend silently drops [HIGH]; CSV export; bulk delete direct via supabase-js — depends on RLS admin policy).
- **AdminAnnouncementsPage / AdminLivePage / AdminLogsPage**: direct supabase writes to `announcements` (with `message/title` mix), `live_classes` (meeting_url link-only "live classes"), logs read from `activity_logs`.
- **AdminSystemPage**: **almost entirely hardcoded mock data** (uptime "14d 8h", memory, pool conns, `MOCK_RPM` random series) [HIGH] — misleading ops UI.

### 7.7 State management inventory
| System | Scope | Truth? | Issues |
|---|---|---|---|
| React Query | catalog, settings, admin stats | server cache | 5-min staleness acceptable |
| Context Auth | session/profile | yes (GoTrue) | block check client-only |
| Context Catalog | catalog tree | duplicate of store | two sources |
| zustand catalogStore (IDB) | raw rows offline | cache | duplication (B-035 confirmed) |
| zustand progressStore | progress | **unused** | dead |
| zustand playerStore | current video/quality | partially used | `quality` field unused by native player |
| zustand downloadStore/uiStore | offline downloads / ui | downloadStore feeds `DownloadQueue` component | download pipeline server side doesn't exist (worker stubs) [MED] |
| localStorage | access map, theme, refresh throttle | local | access map can be edited by user — only hides UI, backend re-checks (OK) |

---

## 8. Authentication Forensics (complete lifecycle)

- **Registration:** email+password+display_name → Supabase `signUp` with email confirmation redirect to `/dashboard`. No MFA, no captcha (Supabase defaults). Password policy = Supabase default (min 6 chars) [MED].
- **Login:** `signInWithPassword` → JWT pair (access ~1h + refresh) stored in **localStorage** (`storage: localStorage`, `persistSession: true`) → XSS-readable tokens [MED, typical SPA tradeoff].
- **Session use:** access token sent as `Authorization: Bearer` to FastAPI; also embedded in `<video>` query string (§12).
- **Refresh:** supabase-js `autoRefreshToken` + app-level timer (5 min pre-expiry) + `apiFetch` 401-retry: refresh → replay request once; refresh failure → `signOut()` + hard redirect `/login` (possible redirect loop on flaky network — B-039 confirmed) [HIGH].
- **Password reset:** `resetPasswordForEmail` → `/reset-password` page → `updateUser({password})`. Works; no rate-limiting beyond Supabase's.
- **Logout:** logs activity then `signOut()`. Sessions are not revoked server-side elsewhere (GoTrue single-session-per-user is not enforced; multiple devices allowed — while "3 concurrent streams" limit exists per user, device count is unlimited).
- **Blocked users:** frontend signs them out on profile fetch; nothing stops API usage with a still-valid JWT except chapter-level checks — `is_blocked` is **not checked by the backend stream endpoint** [HIGH]. A blocked user with a valid token can keep streaming until token expiry.
- **Admin auth:** Supabase role column(s) (§6.7); HMAC signature second factor exists but is **required only for delete_user** and optional elsewhere (`_ensure_admin_signature(required=False)` logs-and-allows when absent) — the "second factor" is effectively decorative [HIGH].

## 9. Database Forensics

### 9.1 Entity model (as defined by migrations)
`profiles(1)─auth.users` · `user_roles(profiles)` · content tree `subjects→cycles→chapters→videos` · monetization `enrollment_codes→chapter_access(profiles,chapters)` · engagement `watch_history, video_notes, video_bookmarks, quiz_attempts, qa_questions/answers, cycle_completions` · ops `activity_logs, audit_logs, error_logs, user_sessions, device_sessions` · pipeline `upload_queue, video_variants, video_analytics, download_queue, content_reports` · comms `notifications, announcements, live_classes, push_subscriptions` · billing `payments, subscriptions, pending_enrollments` · misc `system_settings, resources`.
ER core:
```
auth.users ── profiles ──< user_roles
subjects ──< cycles ──< chapters ──< videos
                          │            │
             enrollment_codes ──< chapter_access >── profiles
                          videos ──< watch_history >── profiles
```
Indexes: sensible composite + partial indexes added in `20260503000000_security_and_optimization.sql` (incl. `pg_trgm` GIN for video/chapter search) [GOOD].

### 9.2 RLS model
Every table RLS-enabled. A dynamic DO-loop creates `"Admins have full access" USING (is_admin())` on **all public tables** (re-run in 3 migrations). Per-user `auth.uid()` policies for own-data tables. Public SELECT for active catalog rows, announcements, live_classes, quiz questions, QA, `system_settings` (**all settings readable by anyone**, incl. maintenance flag — acceptable but notable).
**`is_admin()` has THREE conflicting definitions across migrations**: (a) `user_roles`-based (complete_schema), (b) `profiles.role`-based (security_and_optimization), (c) `user_roles`-based with `SET search_path=public` (restore_is_admin_policies, chronologically last → winner). So **RLS admin = user_roles table**, while backend/frontend admin = mostly `profiles.role`. Two sources of truth for privilege [HIGH].

### 9.3 SECURITY DEFINER functions
`check_chapter_access`, `use_chapter_enrollment_code`, `redeem_enrollment_code`, `increment_watch_count`, `admin_*`, `delete_user_account`, `get_admin_stats`, `is_admin`, `has_role`. Notable:
- `use_chapter_enrollment_code`: validates active/expiry/max_uses/chapter match/duplicate-enrollment, inserts `chapter_access` with device fingerprint, increments `uses_count` — **no transaction isolation guard**: two concurrent redemptions can race past `uses_count >= max_uses` (read-then-write without `SELECT … FOR UPDATE` or atomic conditional UPDATE) → code over-redemption race [MED].
- Device-lock: `check_chapter_access` rejects when stored fingerprint differs — spoofable client fingerprint is the lock (weak DRM, acknowledged).
- `delete_user_account(UUID, TEXT)` requires `DELETE-{uuid}` confirmation and deletes `auth.users` (cascades profile via FK) — but the **backend's `/api/admin/delete_user` also calls GoTrue admin delete**; the SQL version appears unused by code [MED].
- Prior pass dropped `get_user_quiz_attempts` as RLS-bypass (0002 migration) — but `0001_secure_quiz_attempts.sql` (earlier in sort order) recreates exactly that insecure function, and `20260501161500` creates yet another `quiz_attempts` table. **quiz_attempts is dropped/recreated 3×**; final shape depends on runner ordering [HIGH].

### 9.4 Missing columns — code/schema drift 🔴 (all verified by grep across every migration)
| Column used by | Column | In migrations? | Consequence |
|---|---|---|---|
| FE+BE admin checks, `is_admin()`(b) | `profiles.role` | **NO** | auth/admin broken on clean DB |
| BE `_save_file_metadata` PATCH, `get_file_info` read | `videos.file_size_bytes`, `videos.mime_type`, `videos.telegram_fetched_at` | **NO** | metadata cache writes 400 (swallowed); reads fall back to TG round-trips |
| BE audit middleware write | `audit_logs.user_id` | **NO** | audit inserts fail silently → audit trail effectively empty |
| BE `generate_chapter_code` (type=cycle) | `enrollment_codes.cycle_id` | **NO** (`scope`/`batch_id` added instead) | cycle-scoped codes 400 |
| upload worker patch | `videos.file_id` | **NO** | thumbnail message id never linked |
| admin UI read | `enrollment_codes.uses` | column is `uses_count` | "uses" shows undefined [MED] |

### 9.5 Broken/conflicting migrations
- Two files share timestamp `20260503000000` (`audit_security`, `security_and_optimization`) — order undefined.
- `audit_security.sql` DO-block: `EXECUTE format('DROP POLICY … ON public;\nCREATE POLICY … ON public.%I …', t)` — **2 `%I` placeholders, 1 argument** → runtime error; whole transaction rolls back, meaning `audit_logs` may never have been created by this file [MED-HIGH].
- `security_and_optimization.sql` Part E alters nonexistent tables `notes` and `bookmarks` (real names `video_notes`, `video_bookmarks`) → statement error → transaction rollback → **its RLS fixes (Part D) also rolled back** if applied as-is [MED-HIGH].
- `announcements` defined twice with incompatible shapes (complete_schema: title/body/type; dashboard_additions: message/target/priority/sent_at). Backend writes the second shape; first table wins if both ran [HIGH].
- `video_variants` defined twice with incompatible columns (`quality` vs `variant_name`) [HIGH].
- `videos_temp`, `pending_enrollments.status` enum-ish strings, `payments` unused by code — vestigial.
**Conclusion:** the migration set cannot produce the schema the code expects. The live database was evidently hand-patched; a fresh `supabase db push` of these files would leave the app partially broken. Confidence: High for the textual contradictions; Medium for runtime outcome (depends on applied history).

### 9.6 Data risks
N+1-ish patterns: admin metrics does sequential per-channel `get_chat`; dashboard fires 8+ parallel unindexed-ish selects (`activity_logs` scans by `created_at` — indexed, OK). `watch_history` upsert uses PostgREST `Prefer: resolution=merge-duplicates` (requires unique index — exists via UNIQUE(user_id,video_id) [GOOD]). Race conditions: enrollment redemption (§9.3), concurrent-stream counter in-memory only (§18). No soft-delete used despite `deleted_at` columns (admin DELETEs are hard deletes; `videos` FK `ON DELETE CASCADE` wipes watch_history/notes — data-loss risk on accidental video deletion) [MED].

## 10. Business Logic Forensics

1. **Content hierarchy:** Subject → Cycle (semester-like batch) → Chapter → Video. Chapters flagged `requires_enrollment` are paywalled. Catalog ordering everywhere by `display_order`.
2. **Monetization (two coexisting models):**
   - **Enrollment codes** (primary): admin generates `XXXXXX-XXXXXX` secure codes (`generate_secure_hex(3)-generate_secure_hex(3)`, 12-char hex, ~48 bits) with `max_uses`; student redeems → `chapter_access` row locked to device fingerprint. Cycle-scoped codes intended but DB-broken (§9.4).
   - **Manual payment approval** (secondary): student pays via bKash/Nagad, submits trxID → `pending_enrollments(status=pending)` → **no approval UI or backend endpoint exists**; access must be granted manually via DB or by generating a code out-of-band [HIGH]. The documented flow is half-built.
   - Stripe/bKash checkout components are **simulations** (setTimeout step machine collecting phone/OTP/PIN into nowhere) and unwired — dead code that should be deleted to avoid confusion/phishing appearance [HIGH].
3. **Progress rule:** `progress/duration ≥ 0.95 ⇒ completed`; progress capped at duration×1.5 then clamped; unknown video_ids skipped; percent clamped 0-100 (`/api/progress/batch`, main.py:1771-1880).
4. **Concurrency rule:** max 3 simultaneous Telegram streams per user (in-process counter).
5. **Rate limits (per IP unless noted):** stream 120/min, thumbnail 100/min, prefetch 50/min, refresh 5/min, warmup 10/min, webhook 60/min, admin verify 10/min, admin actions 5-20/min, activity 100/min per user.
6. **Upload pipeline:** channel-watch → queue → download → thumbs → link → notify (variants stubbed) (§6.6).
7. **Maintenance mode:** `system_settings.maintenance_mode` → frontend redirects non-admins to `/maintenance`; backend does **not** enforce it [MED].
8. **Announcements:** admin posts; FE dashboard reads active ones. Target field (`all/active_7d/…`) written but never used for targeting logic [LOW].

## 11. Authorization Forensics — who can do what

| Capability | Student | Admin | Enforced where |
|---|---|---|---|
| Browse catalog (active rows) | ✅ | ✅ | RLS public SELECT |
| Stream free chapter video | ✅ JWT | ✅ | BE `/api/stream` (server) |
| Stream paid chapter | ✅ JWT + chapter_access + device match | ✅ bypass | BE server-side [GOOD] |
| Redeem code | ✅ RPC | n/a (auto) | SECURITY DEFINER RPC |
| Write own progress/notes/bookmarks | ✅ | ✅ | RLS `auth.uid()` + BE service-key |
| Read others' data | ❌ | ✅ | RLS admin policy + BE admin endpoints |
| Block user / edit content | ❌ | ✅ | RLS admin policy (FE direct writes!) + BE whitelist endpoints |
| Delete user | ❌ | ✅ JWT+HMAC | BE delete_user (server) |
| Generate codes | ❌ | ✅ | BE endpoint (server) — but FE also inserts codes directly via supabase-js (RLS admin) |
| Metrics/logs | ❌ | ✅ | BE token/role checks |
**Server-side enforcement is real for streaming and admin endpoints** [GOOD]. Weak spots: admin CRUD fallback path writes via RLS only (still server-enforced by Postgres, acceptable), `is_blocked` not enforced by BE (§8), device fingerprint spoofability, frontend admin gating is cosmetic (as it should be).

---

## 12. Security Red-Team Review

Grading: **Confirmed** (evidence-backed) · **Strong suspicion** · **Potential** · **Theoretical**.

### 🔴/🟠 Findings
1. **JWT in video URL — Confirmed, 🟠 HIGH.** `PlayerPage.tsx:421` builds `?token=<JWT>`; backend accepts `token` query param (`stream_video`). Leaks: browser history, Referer (mitigated partly by API's `Referrer-Policy: strict-origin-when-cross-origin`), Render access logs, any proxy logs; token valid ~1h. Fix: short-lived signed stream tickets (HMAC, 5-min TTL, single-use) or cookie-based auth for media.
2. **Blocked users can stream — Confirmed, 🟠 HIGH.** `/api/stream` validates JWT via GoTrue but never checks `profiles.is_blocked`; only the client signs blocked users out. Token remains valid until expiry.
3. **Fail-open authorization on catalog miss — Confirmed, 🟠 HIGH (bounded).** `_check_user_chapter_access` returns **True** when `chapter_lookup` lacks the chapter ("be permissive but log"). Window: after catalog refresh failures or for chapters created but not yet refreshed (up to 300s TTL + manual refresh) — paid content becomes free. Attacker-controllable? Only indirectly (can't force refresh failure), but operationally likely after DB hiccups.
4. **CORS + credentials from env — Confirmed config risk, 🟠.** `allow_origins=settings.allowed_origins_list`, `allow_credentials=True`. A misconfigured/overly-broad `ALLOWED_ORIGINS` (e.g. wildcard or attacker-added origin) enables credentialed cross-origin admin calls. No allowlist sanity check in code.
5. **PostgREST filter injection surface — Strong suspicion, 🟡.** Many admin endpoints interpolate path/params into PostgREST URLs (`get_logs` concatenates `since` into query; `_supabase_admin_rpc` passes endpoint strings built with `?id=eq.{subject_id}` for CRUD — ids not UUID-validated in main.py CRUD routes unlike upload.py). Impact capped by service-key scope (admin-only) but can enable row-filter manipulation. upload.py correctly uses UUID4 types — main.py CRUD doesn't.
6. **Service-role key blast radius — Confirmed design risk, 🟠.** Every backend DB call uses `SUPABASE_SERVICE_KEY` (RLS bypass). Any SSRF/logic bug in the backend = full DB. Key also cached in `secrets_manager` plain dict.
7. **Webhook double-path trap — Confirmed, 🟡.** §6.5; misconfigured webhook silently breaks bot or (if operator "fixes" by pointing WEBHOOK_URL at bare host) works; secret-token check only when env set — **if `TELEGRAM_WEBHOOK_SECRET` unset the endpoint accepts any POST** (rate-limited 60/min) — spoofed updates can trigger admin commands only if attacker is admin chat id; public commands spam possible.
8. **In-memory admin token compare for /metrics — Confirmed OK** (`hmac.compare_digest`) but `?token=` query alternative leaks ADMIN_TOKEN into URLs/logs the same way as #1 🟡.
9. **Raw token LRU cache — Confirmed, 🟡.** `main.py:_TOKEN_CACHE` keys are raw JWTs (5000 entries) — memory disclosure/heap dump exposes valid tokens; `dependencies.py` hashes keys (the better pattern unused by main routes).
10. **Audit trail effectively absent — Confirmed, 🟠 (governance).** AuditMiddleware writes fail (`user_id` column missing §9.4); admin actions land in `activity_logs` only for `stream/catalog/login` events. Who-changed-what is unrecoverable.
11. **localStorage session + XSS — Potential, 🟡.** Standard SPA risk; CSP meta in `index.html` allows `'unsafe-inline'` scripts 🟡 (needed for inline theme script; could be nonce'd). Backend CSP is irrelevant to SPA. `dangerouslySetInnerHTML` not found in app components [verified grep] — XSS surface is low but not zero (user-generated notes/announcements rendered as text via React — safe by default).
12. **Enrollment race — Confirmed, 🟡.** §9.3 over-redemption.
13. **No CSRF concern for JWT-header API** (no cookies) — but supabase-js uses localStorage; classic CSRF largely N/A [GOOD].
14. **Rate limiter IP source — Confirmed reasonable.** Reads X-Forwarded-For from the right with `TRUSTED_PROXY_HOPS` (default 1, Render-correct). Misconfiguration = spoofable limits 🟡.
15. **Dependency exposure — Confirmed, 🟡.** `pyrogram 2.0.106` (unmaintained upstream project), `python-jose` (unused! grep shows no import in backend — dead dep with known CVE history), old Pillow/uvicorn pin. Frontend: `pdfjs-dist 5.7`, `socket.io-client` fine; 45 Radix packages pinned with `^`.
16. **Secrets hygiene — GOOD overall.** `.env.example` contains only fake values; `.gitignore` excludes env files; docs warn explicitly. However `index.html` hardcodes production Supabase project ref `jwwlnjcickeignkemvrj.supabase.co` (public info disclosure of project id, anon key is separately baked at build time — by design public, but project-ref pinning aids targeted attacks) 🟡.
17. **Socket.io server mock auth — Confirmed DORMANT vulnerability, 🔴 if mounted.** `realtime/socket_server.py` accepts client-supplied `user_id` without verifying the token (`auth.get("user_id","anonymous")`), `cors_allowed_origins='*'`. It is **not mounted** (`init_socket_app` never called) [verified], so zero current exposure — but it is a loaded gun pointed at production; mounting it without rewrite = impersonation + cross-origin realtime abuse.
18. **Drive worker redirect — Strong suspicion, 🟡.** `/api/stream` 302s to `{WORKER}/drive/{file_id}` after authz, but the Cloudflare Worker is external and its code isn't in this repo — **not verifiable** whether it re-checks anything; the worker URL defaults to `https://nexusedu-proxy.mdhosainp414.workers.dev` hardcoded (a personal account!) [HIGH supply-chain/ops risk if that worker is deleted or hijacked].

### Positive security controls (verified present) 🟢
- Streaming enrollment check server-side; field whitelists on all admin mutations; UUID4 validation on bulk ops; HMAC + nonce replay protection (delete_user); rate limiting on every sensitive route; 2KB payload caps; body-size limit; `secrets.token_hex` codes (replacing md5(random())); secure SQL code generation migration; RLS everywhere + SECURITY DEFINER with `SET search_path` on the final `is_admin`; webhook secret support; `hmac.compare_digest` usage; private/no-store media caching; `.gitignore` for sessions/env.

## 13. Performance Forensics

**Backend**
- 🔴 **Single uvicorn worker** (`Procfile`) + MTProto streaming through the same event loop: every byte chunk of every stream passes through one process; 3 concurrent streams/user × N users saturate one core/connection quickly. Horizontal scaling is blocked by in-memory state (`video_map`, token cache, stream counters, message LRU) [HIGH].
- 🟠 `httpx.AsyncClient` constructed per request in ~20 places (each = new TLS handshake to Supabase). `get_http_client()` helper exists but is used once (B-016 confirmed) [HIGH].
- 🟠 `/api/admin/dashboard/metrics`: sequential Telegram `get_chat` per channel + 5 Supabase round-trips, uncached.
- 🟡 Catalog refresh is O(all rows) with nested O(V×C) assembly loops in Python; fine for ~1.4k videos, not for 50k.
- 🟡 Prometheus label cardinality (§6.2).
- 🟡 30s timeout middleware vs long ranges (§6.2).
**Frontend**
- 🟢 Route-level code splitting (`React.lazy` for all pages), manual vendor chunks, preconnect/dns-prefetch, SW caching, virtualized list option exists.
- 🟠 three.js (`HeroCanvas`) bundled — vite config comment itself admits it should be lazy; 600KB chunk.
- 🟡 `PlayerPage` catalog search is O(subjects×cycles×chapters×videos) per render (useMemo mitigates); dual toast systems mounted; both `Toaster` and `Sonner` loaded.
- 🟡 `apiFetch` 401-retry re-fetches full request; video element re-requests on token change.
- 🟢 Web-vitals telemetry implemented properly (except auth on beacon, §7.1).
**Database**: good index set incl. trigram; admin queries mostly bounded (`limit`); `activity_logs` grows unbounded — no partitioning/retention job [MED].
**Infra**: Render free tier sleeps (mitigated by GH cron keep-alive — which GitHub disables after 60 days repo inactivity, noted in workflow comment) [MED]; no CDN in front of the API; Telegram MTProto from Singapore region to BD users adds latency vs a real CDN.

## 14. Caching Analysis

| Layer | What | TTL | Invalidation | Risk |
|---|---|---|---|---|
| BE catalog_cache | nested catalog | 300s | `refresh_catalog()` on admin mutations (fire-and-forget task) + `/api/refresh` | ≤5min staleness after admin edit; concurrent refreshes guarded by `catalog_lock` [GOOD] |
| BE message_cache (LRU 300/1h) | Pyrogram message objects | 1h | eviction only | deleted TG messages served from cache up to 1h 🟡 |
| BE _TOKEN_CACHE (5000/300s) | GoTrue user payloads | 5min | expiry | role changes (admin grant/block) lag ≤5min 🟡 |
| BE dependencies cache (1000/60s) | same, upload router only | 60s | — | two caches, divergent TTLs [smell] |
| Redis | rate-limit counters only when REDIS_URL set | window | expiry | falls back to per-process memory silently |
| SW static | app shell | 1yr stamped | cache-name versioning (`-v1`) — must bump manually 🟡 |
| SW catalog | `/api/catalog` | 1h SWR | revalidate on fetch | stale catalog offline |
| SW thumbnails | images | 7d | stamped date | — |
| HTTP headers | streams `private,no-store`; thumbs `private,604800` | — | — | Netlify assets `immutable 1yr` [GOOD] |
| React Query | catalog/settings | 5min staleTime | refetch on mount | — |
| IndexedDB | raw catalog rows | 24h offline grace | overwrite on fetch | — |
No cache stampede protection on `/api/catalog` (concurrent misses all call `refresh_catalog` — guarded partially by lock+TTL check) [LOW]. No Redis object caching despite `core/cache.py` claiming a "multi-layer" design (dead code).

## 15. Error Handling & Observability

- **BE:** GlobalExceptionHandler middleware → generic 500 JSON; per-endpoint try/except returning `JSONResponse({error})` with **raw exception strings** (e.g. `get_logs` returns `str(e)`, `delete_user` raises `HTTPException(500, str(e))`) → internal details (Supabase error text) can leak to clients 🟡. No structured logging (plain `logging.basicConfig`), no request IDs, no Sentry/APM.
- **FE:** React `ErrorBoundary` at root (tested); per-page try/catch with sonner toasts; `OfflineBanner`; `BackendStatus` component; error classification on player (403/404/network) [GOOD UX]. `window.onerror`/unhandledrejection not wired; error_logs table exists client-side write path? `lib/analytics` posts errors as `action:'error'` to activity_logs (used by `logActivity` callers) [MED].
- **What happens when prod breaks:** Render logs only; keep-alive pings fail silently (`|| echo`); Telegram watchdog logs reconnects; no alerting actually fires because Prometheus isn't deployed and alert rules reference nonexistent metrics (§22). **Observability is effectively: read Render logs.** 🔴 for ops.

## 16. Testing Forensics

| Layer | Files | Verdict |
|---|---|---|
| BE pytest | `test_auth.py` (3 tests: metrics-401, health, api/health), `test_catalog.py` (asserts 200 — **will get 503 with empty cache → failing test**), `test_stream.py` (hits nonexistent `/api/v1/stream`, uses `mocker` fixture but **pytest-mock not installed** → collection error), `test_upload.py` (posts `/api/admin/upload/chunk` — route doesn't exist; asserts within [401,403,405]) | **2 of 4 files broken/misleading; 0 cover streaming/authz core** 🔴 |
| FE vitest | 5 files: `api.test.ts` (mutates `import.meta.env` then asserts), `ErrorBoundary`, `Player`, `useChapterAccess`, `AdminDashboardPage` | thin; no enrollment/stream/redemption flows 🔴 |
| E2E/security/perf | none | 🔴 |
Critical untested paths: enrollment redemption RPC, chapter access checks, progress batch rules, admin HMAC, token-refresh retry, SW behavior. Given §6.9, the CI backend job cannot even import the app → **CI gives false confidence or fails outright** [HIGH].

## 17. DevOps & Deployment Forensics

- **Frontend:** Netlify (`netlify.toml`): build `npm run build` → `dist`, SPA redirect `/*→/index.html`, security headers (XFO SAMEORIGIN ≠ backend DENY — mismatch), immutable asset caching, prerender flag (Vite SPA: cosmetic). Sitemap generated postbuild via `scripts/generate-sitemap.mts`.
- **Backend:** two competing deploy stories: `render.yaml` (native Python, pip install requirements) and `Dockerfile` (root) + `RENDER_DEPLOYMENT_INSTRUCTIONS.md` claiming a `backend/Dockerfile` **that doesn't exist** [HIGH contradiction]. `Procfile`: single worker. GH `backend-deploy.yml` just curls a Render deploy hook.
- **Keep-alive:** `keep-alive.yml` cron `*/10` pings `https://nexusedu-backend-0bjq.onrender.com/api/ping` + `/api/warmup` — **production URL hardcoded in repo**; workflow self-documents that GitHub disables it after 60 days inactivity 🔴 given the repo was dormant ~4-5 months (per revival docs) → backend almost certainly sleeping/degraded now.
- **CI:** `ci.yml` = typecheck/lint/test/build FE + pytest BE + CodeQL + Netlify publish (secrets-based). Backend job broken by §6.9.
- **Docker compose:** local dev only (pip install on every up — slow but fine).
- **Terraform:** example-grade, provider `render-oss/render` "Example version", missing required vars, never used [dead].
- **Makefile:** `make deploy` → `scripts/deploy.sh` which runs `cd backend && docker build` — **Dockerfile is not in backend/ → script fails** [HIGH]. `make dev` mixes `npm run dev & uvicorn ...` with wrong import path (`backend.main` from repo root is correct; actually OK), `make test` swallows FE failures (`|| echo`).
- **Secrets:** managed via platform dashboards/GH secrets (docs); `validate_env.py` enforces required vars; setup.py refuses migrations when `NEXUSEDU_ENV=production` [GOOD guard].
- **Rollback:** none automated; migrations one-way; no DB backup story documented 🔴.

## 18. Scalability Analysis

- **10×:** single Render worker + MTProto session = hard ceiling; Telegram FloodWait (client-level rate limits) already handled with sleeps but shared across all users — one flood stalls everyone 🟠.
- **100×:** in-memory everything (catalog, counters, caches) prevents multi-instance; need Redis-backed session/counter state and a real object CDN (or HLS packaging, for which `video_variants` schema exists but pipeline is stubbed).
- **DB:** Supabase free/pro plans fine for metadata scale; `activity_logs` unbounded growth is the first fire (every login/stream/error/web-vital writes a row).
- **Telegram as CDN:** ToS risk (streaming to non-Telegram clients via user session may violate Telegram terms; account bans are the ultimate single point of failure — already materialized once: the original channels were deleted externally per docs) 🔴 architectural existential risk.
- **Storage:** unlimited free Telegram storage is the only reason this product exists at $0; any migration path costs real money (~1.4TB).

## 19. User Journey Reconstruction

**Student (free content):** Netlify SPA `/login` → `AuthContext.signIn` → Supabase GoTrue → JWT in localStorage → `fetchProfile` (profiles.*) → `/dashboard` (React Query catalog from Supabase direct) → `/subject/:slug` → `/cycle/:id` → `/chapter/:id` (VideoListPage: batch `check_chapter_access` RPC per chapter, lock icons) → free chapter: `/watch/:videoId` → `<video src=API/stream/{id}?token=JWT>` → FastAPI authz (no enrollment required) → pyrogram range-stream from Telegram channel → progress batched 10s → `watch_history` upsert (service key) → swipe/next → notes autosave `video_notes` → web-vitals beacon (dropped: no auth) → activity log rows.
**Student (paid):** chapter locked → two paths: (a) code: modal → `use_chapter_enrollment_code` RPC (validates code/chapter/limits/duplicate) → `chapter_access` row (device-locked) → access map updated → stream allowed server-side; (b) payment: `/enrollment` → pay externally → submit trxID → `pending_enrollments` → **journey dead-ends in code** (approval happens, if at all, inside Supabase dashboard) 🔴.
**Admin:** `/login` (admin account) → `profiles.role==='admin'` → AdminLayout → dashboard (8 Supabase queries + BE metrics) → content CRUD (BE API w/ fallback direct writes → `refresh_catalog` task) → enrollment codes (BE generate; CSV export) → users (surveillance endpoints; block toggle direct write) → announcements → live classes (meeting links) → logs. Telegram side: admin chats with bot (`/scan` inventory, `/notify` broadcast, `/stats`).

## 20. Edge Cases & Failure Analysis

| Failure | Behavior | Verdict |
|---|---|---|
| Telegram disconnected | watchdog reconnect (exp backoff ≤120s); secondary session fallback; streams 503 meanwhile | 🟢 designed |
| Telegram account banned/channels deleted | streams 404/503 forever; recovery docs exist; content unrecoverable without re-upload | 🔴 happened once already |
| Supabase down | catalog 503 (stale cache ≤5min serves), auth checks fail closed (401), progress flush fails 1 retry then dropped | 🟠 progress loss |
| Render cold start | first request ~30-60s (Telegram connect ≤10s waited + catalog load); keep-alive mitigates until GH disables cron | 🟠 |
| Duplicate/concurrent stream | 3-limit per user in-process; multi-tab counted; multi-instance bypass | 🟡 |
| Expired session mid-video | video errors → HEAD probe → 403 → "log in again" UI; apiFetch redirects /login | 🟢 |
| Range beyond EOF | clamped by `_parse_range` | 🟢 |
| Malformed video id | regex + UUID check → 400 | 🟢 |
| Empty catalog (fresh boot, DB slow) | `/api/catalog` 503; FE falls back to IDB cache if offline else error state | 🟡 |
| Two admins editing catalog | last-write-wins; each triggers background refresh; no locking | 🟡 |
| FloodWait during stream | generator logs and stops → client sees truncated segment, retries | 🟡 |
| Webhook secret unset | open webhook (rate-limited) | 🟡 |
| DB unavailable during admin mutation | fallback supabase-js path also fails → toast; no partial state | 🟢 |

## 21. UI/UX · Accessibility · Mobile · SEO · Analytics

- **UX:** coherent dark glassmorphism design system; Bengali-first copy (`lang="bn"`); swipe/double-tap player gestures; offline banner + PWA install + update toasts; loading/empty/error states present across student pages (verified EmptyState, LoadingSpinner, error cards) 🟢. Admin panel marred by mock data (SystemPage) and fake uptime 🟠 (trust issue for operators).
- **A11y:** deliberate investment: SkipLink, LiveRegion, focus-visible styles, `use-toast` aria announcements, semantic landmarks; **but** prior-doc flags hover-only controls (AdaptivePlayer quality, AdminUsers checkbox) remain; `<video>` lacks descriptive tracks; contrast relies on translucent whites over glass (risky); keyboard shortcuts documented nowhere in UI 🟡. `docs/ACCESSIBILITY.md` + checklist exist.
- **Mobile:** mobile-first layouts (StudentBottomNav for small screens, `useIsMobile`), touch targets generally ≥40px, viewport-fit=cover, PWA manifest; video player responsive aspect-video. Heavy three.js hero on landing hurts low-end mobile LCP 🟡. Overall: genuinely mobile-ready for the student core 🟢.
- **SEO:** SPA (no SSR/prerender of content pages — Netlify prerender flag is cosmetic for Vite); static meta + JSON-LD EducationalOrganization in `index.html` (hardcodes "Join 10,000+ students" — unverifiable marketing claim); canonical points to `nexusedu.netlify.app`; robots.txt + sitemap script 🟢 basics; per-route titles via `setPageTitle` + Helmet 🟢; deep content not crawlable (auth-gated) — acceptable for the product 🔵.
- **Analytics:** backend-only event log (`activity_logs`) with typed events (page_view, video_played, enrollment, web_vital…) — **no third-party analytics, no funnels, no attribution**; web-vitals delivery broken by missing auth on sendBeacon (§7.1) 🟡. Superficial-but-honest implementation.

## 22. Monitoring Stack Audit (Prometheus/Grafana/alerts)

`prometheus.yml` scrapes `backend:8080` (docker-compose-only target; nothing deploys Prometheus). `alert.rules` reference `http_requests_total` and `telegram_connection_status`; backend actually exposes `request_count` / `request_latency_seconds` and **no** `telegram_connection_status`/`active_streams` gauges. Grafana dashboard panels use the same nonexistent names. ⇒ **The entire monitoring layer is fictional relative to the code** 🔴 (config theater). `docs/FREE_MONITORING.md` suggests external free tools instead.

## 23. Code Quality Assessment

**Positive:** consistent TypeScript strictness; sensible naming; good defensive patterns in backend (timeouts, retries, exponential backoff, LRU bounds, finally-cleanup in worker); Pydantic models with Field constraints on newer endpoints; security-conscious helpers (`generate_secure_hex`, compare_digest).
**Negative:** `main.py` god-module (2,455 LOC, ~40 responsibilities); pervasive `as any` / `Record<string, any>` in FE despite strict mode (eslint disables `no-explicit-any`); copy-pasted admin-check blocks (5+ near-identical profile-role fetches in main.py); `datetime.utcnow()` deprecated usage; dual token caches, dual catalogs, dual toast stacks, dual auth stacks — architecture by accretion; stub modules faking structure (`models/`, `utils/`, `schemas/`); commented-out dead code (catalog_refresher); TODO-laden `progressStore`.

## 24. Git/Version Analysis
Single squashed import commit + 1 merge; all "history" lives in docs instead. Contributor: `HasibBot4u` + arena-agent co-authorship. No tags/releases. The `.gitignore` explicitly hides the evidence of past chaos (`check_*.cjs`, `fix_*.sql`, `/database*.sql`, `*.session`) — indicating previous ad-hoc patch scripts were cleaned away [MED inference].

## 25. Technical Debt Inventory (top items)

| # | Location | Problem | Severity | Fix |
|---|---|---|---|---|
| TD-1 | `backend/requirements.txt` | Missing runtime deps (prometheus-client, python-telegram-bot, psutil, python-dateutil); unused dep python-jose | 🔴 | Pin real dep set from live env; remove python-jose |
| TD-2 | `supabase/migrations` | Drift: missing columns (§9.4), broken DO-blocks, duplicate timestamps, triple quiz_attempts | 🔴 | Reconcile against live DB dump into one new migration; stop hand-editing |
| TD-3 | `backend/main.py` | God module | 🟠 | Split routers (streaming, admin, catalog, bot) into modules; keep state in a State class |
| TD-4 | Dual auth/catalog/toasts | Parallel implementations | 🟠 | Keep dependencies.py pattern + React Query; delete alternatives |
| TD-5 | `pending_enrollments` | No approval path | 🟠 | Admin approval endpoint + UI granting chapter_access |
| TD-6 | `realtime/`, payment mocks, stub packages | Dead/misleading code | 🟡 | Delete or finish |
| TD-7 | Tests | Broken/absent coverage | 🟠 | Golden-path pytest for stream authz + enrollment RPC vitest |
| TD-8 | httpx per request | Connection churn | 🟡 | Shared AsyncClient (helper exists) |
| TD-9 | Monitoring configs | Fictional metrics | 🟡 | Align names or delete |
| TD-10 | AdminSystemPage | Hardcoded fake stats | 🟡 | Wire real data or label clearly |
| TD-11 | JWT-in-URL | Token leakage | 🟠 | Signed short-lived stream tickets |
| TD-12 | `is_blocked` not enforced BE | Blocked users stream | 🟠 | Check flag in verify step |

## 26. Dead Code & Duplication Register (verified by import grep)
**Backend dead:** `core/cache.py` (broken import), `core/exceptions.py`, `core/events.py`, `realtime/*`, `services/cdn_service.py`, `services/watermark_service.py`, `services/stream_service.py`, `workers/email_worker.py`, `workers/report_worker.py`, `models/*`, `schemas/*`, `utils/*`, `diagnose_bot.py` (manual tool), `python-jose` dep.
**Frontend dead/unreferenced:** `pages/Index.tsx`, `pages/student/BillingPage.tsx`, `components/SubjectCard.tsx` (vs `cards/SubjectCard.tsx` used), `components/VideoPlayer.tsx` + `shared/VideoPlayer.tsx` (neither used; PlayerPage uses raw `<video>`), `shared/PageLoader.tsx` (vs `ui/PageLoader.tsx` used), `shared/NexusLogo.tsx` (vs `brand/NexusLogo`), `DataTable.tsx`, `YouTubeStealthPlayer.tsx`, `virtual/VirtualTable.tsx`, `ui/VirtualVideoGrid.tsx`, `store/progressStore.ts` (unused), payment components, `usePwaInstall`/`useSearch` partially wired. Duplicate toast systems both mounted.

## 27. Contradiction Register (README/docs vs code)
1. README: "run `uvicorn main:app` from backend/" vs absolute `backend.*` imports (must run from repo root).
2. `docs/API.md` `/api/v1/...` routes vs actual `/api/...`.
3. RENDER instructions: `backend/Dockerfile` vs root `Dockerfile`.
4. `docs/ARCHITECTURE.md`: "socket.io absent" vs socket code present (but unmounted) — technically still true operationally.
5. Migration README rule "all schema changes through migrations" vs profiles.role etc. missing from migrations.
6. `.env.example` marks Redis/channel IDs optional; `validate_env.py` marks many REQUIRED.
7. AdminSystemPage displays fixed "v2.1.4 / 14d uptime"; backend self-reports v1.2.1.
8. index.html JSON-LD/meta claims "10,000+ students", 7 subjects — catalog targets 3 subjects.
9. `announcements` dual schema (§9.5); `enrollment_codes.uses` vs `uses_count` (§9.4).
10. Prior BUG_INVENTORY B-031 ("tests use /api/v1") — confirmed still unfixed in this snapshot.

## 28. Production-Readiness Scorecard (evidence-linked)

| Category | Score | Evidence-based justification |
|---|---|---|
| Architecture | 4.5/10 | Working hybrid BaaS+proxy design, but god-module, 4 parallel subsystems, dead layers |
| Security | 6/10 | Real server-side authz + hardening pass done; token-in-URL, blocked-user gap, fail-open window, dormant socket vuln, audit absent |
| Performance | 4/10 | Single worker, per-request clients, unbounded metric labels, heavy hero chunk; good FE splitting |
| Testing | 1.5/10 | 9 test files total; 2 BE files broken; 0 coverage of core authz/redemption |
| Maintainability | 4/10 | Docs unusually rich (21 files) but code drifts from them; stubs; duplication |
| Scalability | 2.5/10 | In-memory state blocks horizontal scale; Telegram ToS/ban SPOF; no CDN |
| UX | 7/10 | Polished student flow, Bengali-first, gestures, offline, PWA; admin mock data |
| DevOps | 4.5/10 | CI exists but backend job breaks; keep-alive fragile; no backups/rollback; fictional monitoring |
| Documentation | 7.5/10 | Deep recovery/security docs; but several contradictions with reality |
| Production readiness | 4/10 | Serves small paid cohort today only with hand-patched DB + extra runtime deps |

## 29. Red-Flag Summary
🔴 CRITICAL: R1 missing runtime dependencies (§6.9) · R2 migration/schema drift incl. broken audit trail (§9) · R3 no approval path for paid enrollments (§10.2) · R4 Telegram-platform dependency already failed once, no redundancy (§18) · R5 CI backend cannot pass (§16).
🟠 HIGH: H1 JWT-in-URL · H2 blocked users stream · H3 fail-open chapter check · H4 CORS+credentials env trust · H5 admin dashboard fake data · H6 drive worker on personal Cloudflare account · H7 single worker · H8 audit_logs writes failing · H9 `videos.file_id` patch never matches (thumbnail link dead) · H10 socket.io mock-auth code retained.
🟡 MEDIUM: M1 dual token caches · M2 enrollment race · M3 webhook open when secret unset · M4 error strings leak internals · M5 `expires_at` silently dropped in code gen · M6 announcement schema conflict · M7 `python-jose` dead vuln-prone dep · M8 web-vitals lost (auth) · M9 30s timeout vs long ranges · M10 unbounded activity_logs.
🔵 LOW: L1 toast duplication · L2 `utcnow()` deprecation · L3 JSON-LD subject mismatch · L4 XFO SAMEORIGIN/DENY mismatch · L5 sitemap script postbuild only.
🟢 GOOD: G1 server-side stream authz with device-bound enrollment · G2 rate limiting with trusted-hop IP logic · G3 graceful Telegram watchdog/fallback · G4 PWA offline catalog · G5 admin field whitelists + UUID-validated bulk ops · G6 honest docs about limitations · G7 env hygiene (no secrets committed) · G8 RLS everywhere + search_path-pinned definer.

## 30. Prioritized Improvement Roadmap

**Phase 1 — Emergency (days):** fix `requirements.txt` (+remove python-jose); reconcile schema: add migration for `profiles.role`, `audit_logs.user_id`, `videos.{file_size_bytes,mime_type,file_id}`, `enrollment_codes.cycle_id`, fix announcements/video_variants shape; enforce `is_blocked` in `verify_supabase_token` wrapper; fail-closed option for chapter_lookup miss (deny + refresh-once); replace `?token=` with 5-min HMAC stream tickets; add `pytest-mock`+fix test paths so CI is truthful; external uptime ping (UptimeRobot) replacing fragile GH cron.
**Phase 2 — Stabilization (weeks):** split main.py into routers/services with shared `AppState`; single httpx client; build pending_enrollment approval (endpoint+UI) or delete the flow; delete dead modules (realtime, mocks, stubs) or finish them; align monitoring metric names or remove configs; add tests for redemption RPC + stream authz + progress rules; structured logging + request IDs; sanitize error responses.
**Phase 3 — Optimization (months):** Redis-backed stream counters/token cache → multi-instance; HLS packaging via finishing upload variants pipeline (or migrate storage to R2/S3 when budget allows); CDN in front of thumbnails; activity_logs retention/partitioning; lazy three.js; admin dashboard real data.
**Phase 4 — Evolution:** decouple from Telegram ToS risk (contractual CDN); quiz/QA features (schema exists, zero UI) — decide build-or-drop; subscriptions/payments real gateway (bKash official API) replacing manual trxID; SSR/prerender for public pages if SEO matters.

## 31. Final Verdict

1. **What is it?** A zero-budget Bangladeshi HSC video-course platform: React PWA + FastAPI MTProto proxy + Supabase + Telegram-as-CDN, monetized by per-chapter enrollment codes and manual bKash approvals.
2. **How does it work?** Supabase authenticates; the SPA reads the catalog directly and renders gates; the backend authorizes and byte-proxies videos out of private Telegram channels with range support, tracks progress/activity, hosts an admin CRUD surface and a Telegram ops bot.
3. **Architecture?** BaaS-hybrid monolith — Supabase-centric with a FastAPI "do-what-Supabase-can't" sidecar that became a god-module.
4. **Strongest components:** streaming authorization chain (post-hardening), Telegram lifecycle resilience (watchdog/fallback/preload), PWA/offline layer, admin field-whitelisting, documentation depth.
5. **Weakest components:** migration set (drifted/broken), test suite (decorative), monitoring (fictional), payment-approval loop (missing), realtime/payments stubs.
6. **Biggest security risks:** JWT-in-URL leakage, blocked-user streaming, fail-open enrollment window, service-key blast radius, dormant socket.io mock-auth, audit absence.
7. **Biggest performance risks:** single worker + MTProto in one loop, per-request HTTP clients, unbounded Prometheus labels, Telegram FloodWait as shared bottleneck.
8. **Biggest architectural risks:** existential Telegram dependency (already burned once), in-memory state blocking scale, dual parallel subsystems (auth/catalog) drifting.
9. **Technical debt:** see §25 — dominated by dependency manifest, schema drift, god-module, dead code.
10. **Maintainability:** medium-low; rich docs partially offset code chaos; onboarding possible but requires this report.
11. **Scalability:** poor beyond a few hundred concurrent students without Redis-backed state and a real CDN.
12. **Production readiness:** 4/10 — a functioning but fragile MVP; the prior security pass materially improved it.
13. **Fix first:** dependencies → schema reconciliation → CI truthfulness → token-in-URL → blocked-user check.
14. **Redesign:** streaming auth (tickets), admin backend module split, migration process, payment approval flow.
15. **Don't touch:** the core catalog/enrollment/stream authorization logic, the PWA offline layer, the watchdog/fallback mechanics, RLS posture — they are the product's working spine.

---
*Anti-hallucination note: every file, function, route, table and flag referenced above was read directly in this repository snapshot. Items marked [MED]/[LOW] or "not verifiable" (Cloudflare Worker internals, live DB shape, production runtime package set) are labeled as such rather than asserted.*
