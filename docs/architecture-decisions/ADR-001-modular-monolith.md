# ADR-001: Modular Monolith

- **Status:** Accepted (Stage 16)
- **Date:** 2026-08-11

## Context
The backend had evolved into a single 2,777-line `main.py` mixing HTTP
routing, configuration, Supabase access, Telegram MTProto lifecycle,
streaming, authorization, admin CRUD and Prometheus metrics. The frontend
organized code by technical type (`components/`, `hooks/`, `lib/`) with
feature logic scattered across all of them. This produced high coupling,
hidden dependencies and made change isolation/testing difficult.

## Decision
Keep a **single deployable** (one FastAPI app, one React SPA) but enforce
strong internal module boundaries — a modular monolith, not microservices.

Backend layers (dependency direction top → bottom):

```
api/        HTTP routers (thin, coordinate only)
domains/    framework-agnostic business rules (auth, catalog)
services/   cross-cutting application services (activity, notifications)
integrations/  external I/O (Supabase, Telegram MTProto, Telegram Bot)
core/       security, rate limiting, caching, metrics, errors
state.py / runtime.py / config.py   process state, test seams, settings
```

Frontend layers:

```
app/            composition (main, router/App, providers, app-level components)
features/<x>/   feature-owned components, hooks, contexts, stores, tests
infrastructure/ api client, supabase, analytics, storage
shared/         cross-feature UI primitives, hooks, a11y, seo
components/ui/  design-system (shadcn/Radix)
pages/          route-level page components
```

## Consequences
- A feature change is local to its module + a small public interface.
- Business rules in `domains/` are testable without FastAPI/Telegram.
- No new network boundaries, deployments, brokers or datastores.
- `backend.main` remains the ASGI entry point (`uvicorn backend.main:app`),
  preserving Docker/Render/CI contracts; it re-exports legacy names used by
  the test suite via `backend.runtime` test seams.
