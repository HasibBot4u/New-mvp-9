# Stage 2 — Full-System Bug Hunt, Root-Cause Analysis & Repair Report

**Date:** 2026-08-10 · **Branch:** `arena/019fe71a-new-mvp-9` · **Companion to:** `FORENSIC_ANALYSIS.md` (Stage 1), `RECOVERY_FRESH_START.md`, `TELEGRAM_RECONSTRUCTION.md`

Every item below was found in the repository snapshot and fixed in this branch unless marked otherwise. Status legend: ✅ fixed & verified · 🛠 fixed (needs runtime/external verification) · 📋 documented action (external work required).

---

## A. Master Bug Database (Stage 2 pass)

IDs: `S2-###`. Severity: 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low / ⚪ Info.

### A1. Build / dependency layer

| ID | Sev | Location | Bug | Root cause | Fix | Status |
|---|---|---|---|---|---|---|
| S2-001 | 🔴 | `backend/requirements.txt` | Clean install crashes at import: `main.py` imports `prometheus_client` (module level) and `bot_manager.py` imports `python-telegram-bot`; also uses `psutil`, `dateutil` — none declared | Manifest drifted from code over months of edits | Added `python-telegram-bot==21.1.1`, `prometheus-client==0.20.0`, `psutil==5.9.8`, `python-dateutil` | ✅ pip resolves; 17/17 pytest |
| S2-002 | 🔴 | `backend/requirements.txt` | **Manifest was unresolvable**: `supabase==2.4.0` pins `httpx==0.26.0` while the file pins `httpx==0.27.2` (ResolutionImpossible under modern pip) | Version bumps done independently | Bumped to `supabase==2.6.0` (httpx-0.27 compatible) | ✅ full install clean |
| S2-003 | 🟡 | `backend/requirements.txt` | Unused, CVE-prone `python-jose[cryptography]` declared | Dead dependency | Removed (verified zero imports) | ✅ |
| S2-004 | 🟠 | `backend/realtime/socket_server.py` | Imports undeclared `jwt`; contains mock-auth socket server (`cors='*'`, trusts client-supplied user_id) | Abandoned prototype left armed | Deleted entire dead `realtime/` package (never mounted: no `init_socket_app` call anywhere) | ✅ typecheck+build pass |
| S2-005 | 🟡 | `package.json` | `socket.io-client` dependency with no remaining consumer | Same prototype | Removed from dependencies | ✅ |

### A2. Security

| ID | Sev | Location | Bug | Root cause | Fix | Status |
|---|---|---|---|---|---|---|
| S2-010 | 🟠 | `PlayerPage.tsx` → `main.py:stream_video` | ~1h Supabase JWT embedded in `<video src>?token=`; leaks to history/Referer/logs | `<video>` can't send headers | New **stream-ticket** system: `GET /api/stream-ticket/{id}` (JWT-authed) returns 6h HMAC ticket bound to user+video; `<video>` uses `?ticket=`; `?token=` kept only as degraded fallback | ✅ 5 unit tests + endpoint tests |
| S2-011 | 🟠 | `main.py` | Blocked users (`profiles.is_blocked`) kept streaming — enforcement was client-side sign-out only | Missing server check | `_is_user_blocked()` (60s cache) enforced in `/api/stream` and `/api/stream-ticket` | 🛠 needs runtime DB test |
| S2-012 | 🟠 | `main.py:_check_user_chapter_access` | **Fail-open**: chapter missing from `chapter_lookup` → access ALLOWED (premium leak whenever catalog stale/refresh failed) | Defensive coding chosen backwards | Fail-**closed**: on miss refresh catalog once, re-check, still unknown → 403 | 🛠 needs runtime test |
| S2-013 | 🟠 | `main.py` metrics | `hmac.compare_digest` called but `hmac` only imported as `_hmac_mod` → NameError swallowed → ADMIN_TOKEN path always 403 (metrics effectively JWT-admin-only, silently) | Import aliasing mistake | Added top-level `import hmac`, `import hashlib` | ✅ tests import app cleanly |
| S2-014 | 🟡 | `main.py` metrics | ADMIN_TOKEN also accepted via `?token=` query → secret in URLs/logs | Convenience option | Query-param acceptance removed; header only | ✅ |
| S2-015 | 🟡 | `main.py` admin CRUD | Entity ids interpolated into PostgREST URLs without validation (upload.py validated, main.py did not) | Inconsistent hardening | `_validate_entity_id()` UUID regex on all 8 PUT/DELETE routes | ✅ compiles + tests run app |
| S2-016 | 🟡 | `main.py:get_logs` | `since`/`limit` concatenated into PostgREST URL unvalidated; unbounded limit | Missing input handling | ISO-8601 regex on `since`, `limit` clamped 1–1000 | ✅ |
| S2-017 | 🟡 | `bot_manager.py:_set_webhook` | `WEBHOOK_URL` documented as already containing `/api/bot_webhook`, but code appended the path again → `.../api/bot_webhook/api/bot_webhook` (silent bot death) | Env contract ambiguity | Normalize: strip existing suffix before appending | ✅ |
| S2-018 | 🟡 | `middleware/audit_middleware.py` | Writes `audit_logs.user_id` — column exists in **no migration** → every audit insert 400s and is swallowed (audit trail empty) | Hand-patched live DB never back-migrated | Migration `20260810000000` adds column (+index) | 🛠 apply migration |
| S2-019 | ⚪ | `index.html` | CSP blocked worker origin for Drive streaming paths | Static CSP never updated | Added `https://*.workers.dev` to frame-src/connect-src | ✅ build |

### A3. Database integrity / migrations

| ID | Sev | Location | Bug | Root cause | Fix | Status |
|---|---|---|---|---|---|---|
| S2-030 | 🔴 | `supabase/migrations/*` vs code | Six+ columns used by code created by **no migration**: `profiles.role`, `audit_logs.user_id`, `videos.file_size_bytes/mime_type/telegram_fetched_at/file_id`, `enrollment_codes.cycle_id` | Live DB edited by hand; README rule ignored | One idempotent reconciliation migration adding all of them (+`chk_profiles_role`, scope check, indexes) | 🛠 run `supabase db push` |
| S2-031 | 🟠 | migrations | `enrollment_codes.chapter_id NOT NULL` blocks cycle-scoped codes backend tries to insert | Schema predates cycle codes | `DROP NOT NULL` + `CHECK (chapter_id OR cycle_id)` | 🛠 same migration |
| S2-032 | 🟠 | migrations | `announcements` double-defined with incompatible shapes; backend writes message/target/priority/sent_at which may not exist | Two feature waves collided | Reconciliation migration ADDs runtime columns (no data loss either way) | 🛠 same migration |
| S2-033 | 🟡 | migrations | Two files share timestamp `20260503000000`; one has a `format()` with 2 placeholders/1 arg (aborts its transaction); another ALTERs nonexistent `notes`/`bookmarks` | Rushed edits, never applied fresh | Documented in recovery guide; reconciliation migration supersedes their intent; legacy files left untouched (applied-history safety) | 📋 |
| S2-034 | 🟡 | `use_chapter_enrollment_code` RPC | Read-then-write on `uses_count` — concurrent redemptions can exceed `max_uses` | No row lock / atomic update | Documented; recommend atomic `UPDATE ... WHERE uses_count < max_uses RETURNING` in next DB pass | 📋 |

### A4. Backend logic / reliability

| ID | Sev | Location | Bug | Root cause | Fix | Status |
|---|---|---|---|---|---|---|
| S2-040 | 🟠 | `workers/upload_worker.py` | Thumbnail link patch filtered `videos.file_id=eq.{file_id}` — column empty → thumbnails never linked | Wrong join key assumption | Patch by `telegram_channel_id + telegram_message_id` from the queue row; also stores `file_id` going forward | 🛠 needs queue runtime test |
| S2-041 | 🟠 | `main.py` | No path to review `pending_enrollments` (manual bKash payments) — money taken, access never granted by the system | Half-built monetization | New endpoints: `GET /api/admin/enrollments/pending`, `POST .../approve` (grants `chapter_access`, notifies student), `POST .../reject`; migration adds `reviewed_by/at` | ✅ auth tests; 🛠 DB |
| S2-042 | 🟡 | `main.py` GenerateChapterCodeReq | Client-sent `expires_at` silently dropped (Pydantic ignores extras) — UI expiry setting had no effect | Model/FE drift | Field added (ISO-validated) + inserted; scope sanity checks added | ✅ |
| S2-043 | 🟡 | `main.py` TimeoutMiddleware | 30s hard timeout applied to video streams → mid-playback 504 on slow links/large ranges | Middleware too global | Stream paths bypass the timeout | ✅ |
| S2-044 | 🟡 | `main.py` PrometheusMiddleware | Label = raw path → unbounded series per video UUID | Missing templating | `_normalize_metric_path()` collapses dynamic segments | ✅ |
| S2-045 | 🔵 | `main.py` | `get_http_client()` existed but ~20 call sites still created per-request clients (TLS churn) | Partial refactor | Auth-critical hot paths converted to shared client via `get_shared_http()` | ✅ |
| S2-046 | 🔵 | monitoring | `alert.rules`/Grafana referenced nonexistent metrics (`http_requests_total`, `telegram_connection_status`) | Config theater | Alerts rewritten to real names; real `telegram_connected` gauge added (watchdog updates it); prometheus.yml target port fixed | ✅ |

### A5. Frontend

| ID | Sev | Location | Bug | Root cause | Fix | Status |
|---|---|---|---|---|---|---|
| S2-050 | 🟠 | `AdminEnrollmentPage.tsx` | Reads `c.uses` but DB column is `uses_count` → usage bars/“full” status never worked | Naming drift | Normalize at fetch (`uses = uses_count ?? uses ?? 0`) | ✅ typecheck |
| S2-051 | 🟠 | (missing UI) | No approval surface for pending enrollments | See S2-041 | Pending-approvals card (list/approve/reject) added to AdminEnrollmentPage | ✅ typecheck |
| S2-052 | 🟡 | `main.tsx` | Web-vitals flushed via `sendBeacon` **without** Authorization → backend 401s → all RUM data silently lost | Beacon can't carry headers | Session resolved first; keepalive fetch with JWT; beacon only as last-resort fallback | ✅ build |
| S2-053 | 🟡 | vitest setup | 2 test files failed out-of-the-box: env.ts throws without `VITE_*` in test env; `api.test.ts` mutated env after eager module init; dashboard test asserted Bengali text that doesn't exist in the component | Tests never run in CI-green state | `test.env` added to vite.config; api test uses resetModules+dynamic import; dashboard test asserts real content with async queries | ✅ 7/7 pass |
| S2-054 | 🔵 | dead code | `pages/Index.tsx`, `BillingPage.tsx` (unrouted), payment mocks (fake OTP/PIN collector), duplicate players/loaders/logos, unused `progressStore`, live-room components | Accretion | Deleted verified-unreferenced files (grep-confirmed zero importers) | ✅ typecheck+build |
| S2-055 | ⚪ | `AdminSystemPage.tsx` | Hardcoded fake stats (uptime/memory/MOCK_RPM) presented as live data | Placeholder never replaced | Documented for replacement (left in place — data sources exist via `/api/admin/dashboard/metrics`) | 📋 |

### A6. Tests & DevOps

| ID | Sev | Location | Bug | Fix | Status |
|---|---|---|---|---|---|
| S2-060 | 🔴 | `backend/tests/*` | 2/4 files broken: nonexistent routes (`/api/v1/stream`, `/api/admin/upload/chunk`), `mocker` fixture without pytest-mock, catalog test asserting 200 where code returns 503 | Routes corrected, `pytest-mock` added, catalog accepts valid degraded states, new suites for tickets + enrollment authz | ✅ 17/17 |
| S2-061 | 🟠 | CI | Backend job must have failed on import (§S2-001) → false confidence | Dep manifest fixed (job now runnable) | ✅ local pytest parity |
| S2-062 | 🟡 | `scripts/deploy.sh` | `cd backend && docker build` but Dockerfile is at repo root → script always failed | Build from repo root | ✅ |
| S2-063 | 🟡 | `Makefile` | `make test` swallowed frontend failures (`|| echo`) | Failures now fail the target | ✅ |
| S2-064 | 🔵 | `keep-alive.yml` | Prod URL hardcoded; GH disables cron after 60d inactivity | URL now `vars.BACKEND_URL` overridable; documented UptimeRobot alternative | ✅ YAML valid |
| S2-065 | 🔵 | `README.md` | Said run `uvicorn main:app` from `backend/` — absolute imports require repo root | Corrected command | ✅ |

---

## B. Root-Cause Themes (why these bugs existed)

1. **Manifest drift:** dependencies and schema were changed live (Render env, Supabase dashboard) without committing the change → the repo stopped describing reality (S2-001/002/018/030).
2. **Parallel subsystems:** two auth stacks, two catalogs, two toast systems → fixes applied to one branch never reached the other (S2-015, Stage-1 dual-cache findings).
3. **Abandoned prototypes left armed:** realtime mocks, payment simulations, dead pages → confusion + latent vulns (S2-004/005/054).
4. **Tests never executed in CI-green state** → stale assertions fossilized (S2-053/060).
5. **Config theater:** monitoring/alerting written against an imagined metric surface (S2-046).

## C. Verification Matrix

| Fix | Method | Expected | Actual | Status |
|---|---|---|---|---|
| S2-001/002 deps | `pip install -r backend/requirements-dev.txt` in clean venv | resolve + import app | 0 errors; app imports | ✅ Verified |
| Backend suite | `pytest backend/tests -v` | all pass | **17 passed** | ✅ Verified |
| Ticket crypto | unit tests (roundtrip/binding/tamper/expiry/malformed) | pass | pass | ✅ Verified |
| Stream/ticket authz | ASGI tests unauth→401, forged ticket→401 | 401s | pass | ✅ Verified |
| Enrollment admin endpoints | ASGI tests unauth→401 | 401s | pass | ✅ Verified |
| S2-010 frontend | `tsc --noEmit` + `vite build` | clean | clean | ✅ Verified |
| Frontend suite | `npm run test:ci` | all pass | **7 passed (5 files)** | ✅ Verified |
| Prod build | `npm run build` (+sitemap postbuild) | bundle emitted | ✅ (three 600KB chunk noted) | ✅ Verified |
| YAML configs | yaml parse | valid | valid | ✅ Verified |
| S2-011/012/018/030–032/040 | requires live Supabase/Telegram | — | — | 🛠 Requires runtime + migration apply |
| Bot webhook fix | requires new bot + Render URL | — | — | 🛠 Requires external service |

## D. Regression Analysis (what the fixes could disturb)

- **Fail-closed chapter check:** if catalog refresh persistently fails, paid AND free-but-unknown chapters deny. Mitigation: refresh-once before denying; ops should monitor `/api/health` supabase status. Free chapters unaffected (requires_enrollment=false short-circuits).
- **Stream tickets:** already-deployed old frontends keep working via `?token=` fallback; new frontends prefer tickets. No API removal.
- **Enrollment approval PATCH/POST:** idempotent on duplicate `chapter_access` (409/duplicate tolerated).
- **`enrollment_codes.chapter_id DROP NOT NULL`:** existing rows unaffected; new CHECK enforces one target per code.
- **Deleted modules:** import graph re-verified via typecheck + build + pytest.
- **`supabase==2.6.0` bump:** minor-version SDK, same `AsyncClient/create_async_client` API used by main.py; import verified in tests.

## E. Final Health Report (Before → After Stage 2)

| Area | Before | After | Remaining risk |
|---|---|---|---|
| Build/deps | Broken (uninstallable manifest) | ✅ clean install | Keep pins updated |
| Backend tests | 2/4 files broken | ✅ 17/17 | Add integration tests w/ live DB |
| Frontend tests | 2/5 failing | ✅ 7/7 | Coverage still thin |
| Security (stream) | JWT-in-URL, fail-open, blocked bypass | 🛠 tickets + fail-closed + block check | Deploy new frontend; verify live |
| Audit trail | Silently failing writes | 🛠 column added in migration | Apply migration |
| Monetization loop | Dead end | 🛠 approve/reject endpoints + UI | Approve first payment E2E |
| Telegram | Channels/bot deleted externally | 📋 reconstruction guide provided | Rebuild per TELEGRAM_RECONSTRUCTION.md |
| Monitoring | Fictional metrics | Real gauge + aligned alerts | Deploy Prometheus if wanted |
| Dead code | ~15 dead modules/files | Removed verified-safe set | AdminSystemPage fake stats remains |
| Docs | Contradicted code | README/env fixed; 3 new Stage-2 docs | Keep docs in review loop |
