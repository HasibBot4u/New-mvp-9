# NexusEdu Architecture

> Current as of Stage 16 (2026-08-11). This is the structural overview; the
> single operator guide is [`PROJECT_REVIVAL_GUIDE.md`](PROJECT_REVIVAL_GUIDE.md).
> Durable decisions live in [`architecture-decisions/`](architecture-decisions/).

## 1. System overview
NexusEdu is a mobile-first PWA for HSC video learning. It is a **modular
monolith**: one React SPA, one FastAPI service, one Supabase project, and
Telegram as the video storage/CDN. No microservices, message brokers, or
separate deployments.

```
Browser / PWA ──HTTPS──> FastAPI (Render) ──> Supabase (Postgres/Auth/RLS)
      │                      │
      │                      └──> Telegram MTProto (video bytes)
      │                      └──> Telegram Bot API (admin bot/webhook)
      └──────────────────────> Supabase PostgREST (catalog/profile/notes)
```

## 2. Backend layering (`backend/`)
Dependency direction is top → bottom only:

| Layer | Path | Responsibility |
|---|---|---|
| Entry | `main.py` | Thin ASGI module (`uvicorn backend.main:app`); legacy re-exports / test seam |
| Composition | `app_factory.py` | App, middleware stack, lifespan, router wiring |
| HTTP | `api/` | Routers by domain: `system`, `catalog`, `streaming`, `progress`, `integrations`, `admin/*` — validate + coordinate only |
| Domain | `domains/auth.py`, `domains/catalog.py` | Framework-agnostic business rules (authz, tickets, catalog assembly) |
| Services | `services/` | Cross-cutting app services (activity/audit logging, notifications, upload pipeline, video processing) |
| Integrations | `integrations/` | External I/O: `supabase_integration`, `telegram_client` (Pyrogram), `telegram_bot` (Bot API) |
| Core | `core/` | Security/HMAC, rate limiter, cache, Prometheus metrics, error types |
| Cross-cutting | `state.py`, `runtime.py`, `config.py` | Process state, runtime callables + test seams, validated settings |
| Workers | `workers/` | Background upload worker loop |
| Middleware | `middleware/` | Audit + HTTP transport middleware |

**Boundaries:** `integrations/supabase_integration.py` is the only module
that builds Supabase URLs/headers; `integrations/telegram_client.py` is the
only module that imports Pyrogram. Business logic in `domains/` never
imports FastAPI or Pyrogram.

## 3. Frontend layering (`src/`)
| Path | Responsibility |
|---|---|
| `app/` | Composition: `main.tsx`, `App.tsx` (router), providers, app-level components + their tests |
| `features/<x>/` | Feature-owned code: `auth`, `catalog`, `video`, `live` (components, hooks, contexts, stores, tests) |
| `infrastructure/` | API client (`api/client.ts`), `supabase/`, analytics, storage |
| `shared/` | Cross-feature hooks, a11y, SEO, lib |
| `components/ui/` | Design system (Radix/shadcn) |
| `components/{layout,public,brand,shared}/` | Shells and shared presentational components |
| `pages/{auth,public,student,admin}/` | Route-level page components |
| `types/` | Shared TypeScript types |

## 4. Key flows
- **Streaming:** JWT → `GET /api/stream-ticket/{id}` (6h HMAC ticket bound
  to user+video) → `GET /api/stream/{id}?ticket=` → authz (block check +
  chapter enrollment, fail-closed) → ranged Telegram `stream_media`. Max 3
  concurrent streams/user, 50 MB/range.
- **Enrollment:** enrollment-code redemption (Supabase RPC) or manual
  `pending_enrollments` → admin approve grants `chapter_access` + in-app
  notification.
- **Progress:** batched upsert to `watch_history` every ~10s; completed at
  ≥95%; server clamps and validates video IDs.
- **Admin:** JWT role check (`profiles.role='admin'`, `user_roles` fallback)
  + optional HMAC signature; UUID validation + field whitelists on all CRUD.
- **Upload pipeline:** Pyrogram message handler queues `upload_queue`;
  `UploadWorker` extracts thumbnails/variants (skipped on Render free tier)
  and links metadata back to `videos`.

## 5. Failure isolation
- Missing Telegram credentials → backend boots; streaming returns 503 and
  thumbnails redirect to a placeholder. Catalog/auth keep working.
- Activity/audit logging is best-effort and never fails a request.
- Notifications are best-effort.
- Rate limiting and cache degrade from Redis to in-process if Redis is absent.
- Global exception middleware returns a safe 500 without leaking internals.

## 6. Data ownership
Backend modules and their primary tables:
- auth domain/Supabase integration: `profiles`, `user_roles`, `chapter_access`
- catalog domain: `subjects`, `cycles`, `chapters`, `videos`
- progress routes: `watch_history`
- enrollment/admin: `enrollment_codes`, `pending_enrollments`
- services: `activity_logs`, `audit_logs`, `announcements`, `notifications`
- upload pipeline: `upload_queue`
