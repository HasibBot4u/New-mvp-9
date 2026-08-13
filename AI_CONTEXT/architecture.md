# Architecture (verified 2026-08-11, Stage 16)

Modular monolith: React 18 PWA (Vite, Netlify) + FastAPI (Render, single worker) + Supabase (Postgres+GoTrue+RLS) + Telegram MTProto (Pyrogram) as video storage.

## Frontend (`src/`)
- `app/` — composition: `main.tsx`, `App.tsx` (router), app-level components, `__tests__`.
- `features/{auth,catalog,video,live}` — feature-owned contexts/hooks/components/stores + colocated tests.
- `infrastructure/{api,supabase,analytics,storage}` — API client (`api/client.ts`), Supabase client, web-vitals/activity logging, thumbnails.
- `shared/{hooks,a11y,seo,lib}` — genuinely cross-feature code.
- `components/ui/` — design system (Radix/shadcn). `components/{layout,public,brand,shared}/`.
- `pages/{auth,public,student,admin}/` — route-level pages.
- FE reads catalog/profile/notes directly from Supabase (anon+RLS); writes progress via backend batch API; streams via backend.

## Backend (`backend/`)
Layered, dependency direction top→bottom:
- `main.py` — thin ASGI entry (`uvicorn backend.main:app`); re-exports legacy names as a test seam.
- `app_factory.py` — app construction, middleware, lifespan.
- `api/` — routers grouped by domain: `system`, `catalog`, `streaming`, `progress`, `integrations` (bot webhook), `admin/{auth,users,content,enrollment,announcements,operations,bulk}`. Routers coordinate only.
- `domains/auth.py` — JWT verify, block/admin, chapter-access (fail-closed), HMAC stream tickets. `domains/catalog.py` — builds the content tree + indexes. Framework-agnostic.
- `services/` — `activity_service`, `notification_service`, `telegram_upload_service`, `video_processor`.
- `integrations/` — `supabase_integration` (only module that builds Supabase URLs/headers), `telegram_client` (only module importing Pyrogram), `telegram_bot` (python-telegram-bot).
- `core/` — `security` (HMAC, secrets), `rate_limiter` (Redis or in-memory), `cache`, `metrics` (Prometheus), `exceptions`.
- `middleware/` — `audit_middleware`, `http_middleware` (timeout, security headers, body size, global errors).
- `state.py` — process-global state/caches/clients/counters. `runtime.py` — callables routers import + the monkeypatch test seam. `config.py` — validated pydantic-settings.

State caches: in-memory catalog (300s), `video_map`, `chapter_lookup`, message LRU (1h), token LRU (300s), blocked cache (60s), in-process stream counters (max 3/user).

## Video
Videos addressed by `videos.telegram_channel_id` + `telegram_message_id`; thumbnails in `THUMBNAIL_CHANNEL_ID` via `videos.thumbnail_telegram_message_id`. Drive sources 302 to a Cloudflare Worker (`VITE_CLOUDFLARE_WORKER_URL`); YouTube embeds client-side.

See `docs/ARCHITECTURE.md`, `docs/PROJECT_REVIVAL_GUIDE.md`, ADRs in `docs/architecture-decisions/`.

## Stage 21 final freeze
- Release gate: repository is code-complete and "READY FOR OWNER INFRASTRUCTURE SETUP" (not live-verified). All 38 tables have RLS; new hardening migrations: `20260811120000_stage20_rls_hardening.sql` and `20260811180000_stage21_function_hardening.sql` (apply in order). `get_admin_stats()` now admin-gated. Shared httpx client closes on shutdown.
- FUTURE REQUIREMENT (do not build yet): centralized Admin Control Plane. Must be layered (foundation→config/flags/content/users/business→controls→DB/security/DevOps→audit/approval/rollback→hardening) with granular roles, confirmation gates, immutable audit, safe defaults, reversibility. No browser-based arbitrary code/DB execution; DB changes via approved migrations + backups. See docs/PROJECT_REVIVAL_GUIDE.md §23.

## Admin Control Plane (Stage 28 foundation)
- Backend: `/api/control-plane/*` (backend/api/controlplane/). JWT + admin role required; granular permissions via `has_admin_permission(p_permission)` SQL.
- New additive migration: `20260812220000_stage28_control_plane_foundation.sql` (admin_permissions, admin_roles, admin_role_permissions, admin_user_roles, admin_settings, feature_flags, admin_change_versions, admin_change_requests, admin_audit_events). RLS enabled; no public write policies.
- Settings engine: typed/validated defaults in `settings.py`; feature flags seed on startup; every write versioned + audited; sensitive values never returned.
- Frontend: `/admin/control-plane/*` shell with Dashboard, Settings, Feature Flags, Audit, Users & Roles; later modules show a clear "soon" state.
- Owner recovery: profiles.role='admin' bypasses granular checks, so the owner never loses access. Future stages build content/enrollment/telegram/etc on this foundation.

## Stage 29 — Content Control Plane
- API: `/api/control-plane/content/{subjects,cycles,chapters,videos}` (list/get/create/update/publish/unpublish/reorder/delete), all requiring content.write (or videos.write for videos) + audit.
- Reuses existing hierarchy Subjects→Cycles→Chapters→Videos. Archive (is_active=false) for hierarchy nodes to avoid cascade loss; hard-delete for video leaves. Reorder validates the ID set matches siblings (no cross-scope).
- Frontend: `/admin/control-plane/content` with search, hierarchy tabs, edit dialog, publish toggle, up/down reorder, confirmation for archive/delete.
- Fixed latent bug: `domains/auth.py` referenced undefined `state` in token cache path; imported `backend.state`.
