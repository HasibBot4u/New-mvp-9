# Stage 4 — Master Test Matrix & Verification Evidence

Philosophy: "tests pass" is not the goal — **evidence that important journeys behave correctly** is. Legend: ✅ automated & passing now · 🛠 manual/runtime (needs deployed env) · 👤 external (needs your accounts/Telegram) · ⛔ not currently testable.

## A. Automated suite (current state: backend 34/34, frontend 14/14)

| Layer | Suite | Covers |
|---|---|---|
| Unit | `test_stream_tickets.py` | ticket issue/verify: roundtrip, video-binding, tamper, expiry, malformed |
| Unit | `enrollmentCode.test.ts` | code canonicalization incl. N-5 regression guard (7 cases) |
| API | `test_auth.py` | admin metrics auth, health endpoints |
| API | `test_stream_authz_matrix.py` | **no-auth→401, forged ticket→401, blocked user→403, concurrency cap→429, unknown chapter→fail-closed 403, free chapter passes, drive→302** |
| API | `test_progress_rules.py` | auth, empty batch, invalid ids, absurd values (>86400, negative), >100 batch, unknown-video drop rule |
| API | `test_admin_validation.py` | UUID validation on CRUD ids, `since` injection guard, anonymous rejection |
| API | `test_enrollments.py` | pending/approve/reject admin-only |
| Component | `ErrorBoundary`, `Player.test.tsx`, `AdminDashboardPage.test.tsx` | render contracts |
| Build | `tsc --noEmit`, `vite build`, pytest import | contracts & bundling |

## B. Feature × scenario matrix (status per cell)

| Feature | Happy path | Invalid input | Unauthorized | Expired session | Network failure | DB failure | Duplicate req | Concurrent req | Recovery |
|---|---|---|---|---|---|---|---|---|---|
| Signup | 🛠 | ✅(pw len) / 🛠 email | n/a | n/a | 🛠 | 🛠 | 🛠 double-submit | n/a | 🛠 email link |
| Login/JWT refresh | 🛠 | ✅ 401s | ✅ | ✅ apiFetch retry→logout | 🛠 | 🛠 | ✅ token cache | ✅ | 🛠 |
| Catalog load | ✅(503-degrade test) | n/a | ✅ public | n/a | ✅ IDB offline | ✅ 503 path | ✅ cache lock | ✅ | ✅ stale-while |
| Stream (free) | 🛠/👤 needs TG | ✅ id regex | ✅ 401 | ✅ ticket expiry test | 🛠 | ✅ 503 | ✅ range dup safe | ✅ 429 cap test | ✅ watchdog test 🛠 |
| Stream (paid) | 👤 E2E | ✅ | ✅ 401/403 tests | ✅ | 🛠 | ✅ fail-closed test | ✅ | ✅ | 🛠 |
| Code redemption | 🛠 RPC | ✅ normalization | ✅ auth.uid | ✅ | 🛠 | 🛠 | ✅ unique_violation | ✅ atomic UPDATE | 🛠 |
| Pending approval | ✅ auth tests | ✅ id validation | ✅ 401 | ✅ | 🛠 | 🛠 | ✅ 409 on re-approve | ✅ status guard | 🛠 |
| Progress batch | ✅ rules tests | ✅ 422 suite | ✅ 401 | ✅ | ✅ keepalive+retry | 🛠 500 | ✅ upsert merge | ✅ | 🛠 |
| Admin CRUD | 🛠 | ✅ UUID/since | ✅ 401 | ✅ | 🛠 fallback path | 🛠 | ✅ | ✅ | ✅ catalog refresh |
| Bot/webhook | 👤 | 🛠 | ✅ secret check code | n/a | 🛠 | n/a | ✅ update_id dedup n/a | 🛠 | ✅ setup_webhook |
| PWA/offline | 🛠 | n/a | n/a | n/a | ✅ SW cache code | n/a | n/a | n/a | 🛠 update toast |

## C. Gaps (honest)
- **No live-DB integration tests** (Postgres unavailable in audit env): RPC behavior, RLS policies, and migration application are code-reviewed only → first deploy must run the §D smoke set.
- **No browser E2E harness** (Playwright not configured). Adding it is Stage-8 follow-up; the matrix's 🛠 cells are the manual script below.
- **Telegram flows** cannot be automated without a real account → 👤.

## D. Post-deploy smoke script (run from phone, ~10 min)
1. `/api/health` → supabase connected · 2. signup new user → dashboard · 3. play a free video, seek, reload → resume position · 4. locked chapter shows lock; redeem a generated code → plays · 5. submit pending enrollment → appears in admin queue → Approve → access granted · 6. block a test user (profiles.is_blocked) → streaming 403 within ≤60s · 7. stop Telegram session (or bad env) → streams 503 + watchdog reconnect logs · 8. Actions: db-backup workflow produces artifact.
