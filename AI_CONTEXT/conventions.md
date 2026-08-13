# Conventions & hard-won rules
- Backend runs from REPO ROOT (`uvicorn backend.main:app`) — absolute imports.
- All DB access in backend uses service key via httpx; never expose it to FE; FE is anon+RLS only.
- Admin mutations: whitelist fields, validate UUIDs, sanitize URL params (keep the validators when adding endpoints).
- New admin endpoints: `await _ensure_admin(request)` + rate limit + (bulk/destroy) confirmation strings.
- Migrations: additive-only, idempotent DO $$ blocks, filename-timestamped.
- Frontend: React Query for server state; zustand only for device-local state; apiFetch for 401-retry; never put JWTs in URLs for NEW features (tickets pattern).
- Tests: every security gate gets an API-level test (see test_stream_authz_matrix.py pattern: monkeypatch module globals).
- Docs are evidence-linked: label CONFIRMED / INFERRED / UNKNOWN; never claim runtime verification without execution.

## Stage 16 structure rules
- Backend business rules live in `backend/domains/`; I/O in `backend/integrations/`; HTTP coordination in `backend/api/`. Do not add logic back to `main.py` (it is a thin ASGI entry + test-seam re-exporter).
- `backend/integrations/supabase_integration.py` is the ONLY place that constructs Supabase URLs/service headers. `backend/integrations/telegram_client.py` is the ONLY place that imports Pyrogram.
- Routers import mutable callables from `backend.runtime` (not `backend.main`) so tests can monkeypatch `backend.main.*`.
- Frontend feature code goes in `src/features/<x>/`, I/O in `src/infrastructure/`, shared cross-cutting code in `src/shared/`, design system in `src/components/ui/`. Tests live next to the code they cover.

## Stage 17 technology policy
- Stack is intentionally TypeScript + Python + SQL/YAML/Docker. Do NOT propose Rust/Go/microservices/GraphQL/new DBs without measured evidence — see `docs/TECHNOLOGY_RADAR.md` "Do NOT introduce" list.
- Streaming is I/O-bound (network), not CPU-bound; Pyrogram + tgcrypto handle it. Video transcoding uses native ffmpeg subprocesses. Keep media work out of the Python event loop.
- Backend dependencies must be actually imported (removed pillow/aiofiles/socketio in Stage 17). Verify with grep before adding.
