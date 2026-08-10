# Conventions & hard-won rules
- Backend runs from REPO ROOT (`uvicorn backend.main:app`) — absolute imports.
- All DB access in backend uses service key via httpx; never expose it to FE; FE is anon+RLS only.
- Admin mutations: whitelist fields, validate UUIDs, sanitize URL params (keep the validators when adding endpoints).
- New admin endpoints: `await _ensure_admin(request)` + rate limit + (bulk/destroy) confirmation strings.
- Migrations: additive-only, idempotent DO $$ blocks, filename-timestamped.
- Frontend: React Query for server state; zustand only for device-local state; apiFetch for 401-retry; never put JWTs in URLs for NEW features (tickets pattern).
- Tests: every security gate gets an API-level test (see test_stream_authz_matrix.py pattern: monkeypatch module globals).
- Docs are evidence-linked: label CONFIRMED / INFERRED / UNKNOWN; never claim runtime verification without execution.
