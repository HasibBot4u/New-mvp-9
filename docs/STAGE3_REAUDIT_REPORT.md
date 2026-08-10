# Stage 3 — Independent Re-Audit, Regression Hunt & Verification Report

**Date:** 2026-08-10 · Performed as an independent pass: previous Stage 1/2 conclusions were treated as untrusted claims and re-checked against the current tree.

## PART 1/2 — Previous-Fix Verification Table

| Bug ID | Original bug | Fix applied | Current status | Evidence | Regression? |
|---|---|---|---|---|---|
| S2-001/002 | Uninstallable/incomplete backend deps | New requirements pins | ✅ Verified fixed | Fresh `pip install -r backend/requirements-dev.txt` in sandbox venv resolves; app imports; **17/17 pytest** | none found |
| S2-010 | JWT in video URL | Stream tickets (backend + PlayerPage) | 🟢 Fixed, runtime verification pending (deploy) | Ticket unit tests (roundtrip/bind/tamper/expiry/malformed) pass; frontend uses ticket-first | ⚫→fixed: first implementation reloaded `<video>` on catalog refetch/token refresh — see N-2 |
| S2-011 | Blocked users streamed | `_is_user_blocked` in stream+ticket paths | 🟢 Code verified; needs DB runtime test | grep-verified call sites; 60s cache | none |
| S2-012 | Fail-open chapter check | Fail-closed with refresh-once | 🟢 Code verified; needs runtime test | function re-read end-to-end | none — free chapters short-circuit |
| S2-013 | metrics NameError | top-level `import hmac/hashlib` | ✅ Verified | module imports in tests | none |
| S2-014 | ADMIN_TOKEN in query | header-only | ✅ Verified | code re-read | none |
| S2-015/016 | id/param injection surface | UUID regex + `since`/`limit` validation | ✅ Verified | code re-read | none |
| S2-017 | webhook double-path | normalization | ✅ Verified | code re-read | none |
| S2-018/030-032 | schema drift | reconciliation migration | 🟢 Written, idempotent; **must be applied to a real DB** (cannot run Postgres in this audit) | SQL reviewed line-by-line | none anticipated |
| S2-040 | thumbnail link filter | channel+message id filter | 🟢 Code verified; needs queue runtime test | re-read | none |
| S2-041/051 | missing approval loop | endpoints + UI | ✅ Auth tests pass (3/3); UI typechecks | pytest + build | none |
| S2-042 | expires_at dropped | field added | ✅ Verified | model re-read | none |
| S2-043/044/046 | timeout/metrics/theater | stream bypass, templated labels, real gauge | ✅ Verified | re-read | none |
| S2-050 | uses vs uses_count | normalize at fetch | ✅ Verified | re-read | none |
| S2-052 | web-vitals beacon auth | keepalive fetch w/ JWT | ✅ Verified | re-read | none |
| S2-053/060 | broken tests | rewritten suites + test env | ✅ Verified | **7/7 frontend, 17/17 backend** in fresh run | none |
| S2-062/063/064 | deploy.sh/Makefile/keep-alive | corrected | ✅ Verified (YAML parsed, scripts re-read) | — | none |
| S2-034 | redemption race | *was only documented* | ✅ Now **actually fixed** in Stage 3 — atomic `UPDATE … WHERE uses_count < max_uses RETURNING` | migration §8 | none |

## PART 3 — Newly Discovered Bugs (missed by Stage 1/2)

| ID | Sev | Location | Bug | Root cause | Fix in Stage 3 | Status |
|---|---|---|---|---|---|---|
| N-1 | 🔴 | `main.py` CORS | `allow_methods` lacked **PUT/PATCH** → every cross-origin admin UPDATE (Netlify→Render) fails CORS preflight in production; only worked in dev via Vite proxy or via the accidental Supabase fallback | Methods list copied without PUT/PATCH | Added `PUT`, `PATCH` | ✅ code + build verified; confirm after deploy |
| N-2 | ⚫→✅ | `PlayerPage.tsx` (Stage-2 regression) | Ticket effect depended on the `video` **object** and `sessionToken` → ticket refetched (and `<video>` reloaded, interrupting playback) on every React-Query catalog refetch and every token refresh | Over-broad effect deps | Effect now keyed on `[source?.type, video?.id]`; session read imperatively | ✅ typecheck/build; observe after deploy |
| N-3 | 🟠 | `useBatchProgress.ts` | "Saving progress…" toast fired on **every 10s auto-flush** during playback — constant noise, worst on mobile | Debug toast left in timer path | Toast removed | ✅ |
| N-4 | 🟠 | `useChapterAccess.ts` | RPC returns `{success:false,…}` object; code stored `!!data` → **locked chapters always rendered as unlocked** (client-side; server still enforced) | Wrong truthiness on JSON envelope | `!!data?.success` | ✅ |
| N-5 | 🔴 | `useChapterAccess.ts` normalizeCode | Re-grouped codes into 4-char chunks but all generators emit **6-6** (`ABC123-DEF456`) → every backend/SQL-generated code was corrupted on submit → redemption from UI could never work | Comment claimed a 24-char format that exists nowhere | Canonicalize to 6-6 for bare 12-char input; preserve other formats | ✅ |
| N-6 | 🟠 | Stage-2 migration × old RPC | Making `chapter_id` nullable exposed old RPC flaw: `chapter_id != p_chapter_id` is NULL for cycle codes → **cycle code redeemable for ANY chapter** | Three-valued logic | New cycle-aware RPC (membership check against `chapters.cycle_id`) | ✅ migration §8 |
| N-7 | 🟠 | `system_settings.allow_registrations` | Setting loaded but enforced **nowhere** — admin "close registrations" toggle was theater | Missing consumer | SignupPage gate added (client-side); server-side enforcement flagged as residual (needs Supabase Auth hook/DB trigger) | ✅ client; residual documented |
| N-8 | 🟡 | `PlayerPage` mobile UX | Double-tap seek zones were full-height → swallowed taps on seekbar ends / fullscreen on phones | Overlay geometry | Zones now `top-0 bottom-14` | ✅ |
| N-9 | 🟡 | `sw.js` | Unreachable code after early return in catalog branch | Copy-paste | Documented (harmless); cleanup optional | 📋 |
| N-10 | ⚪ | sandbox/ops | `node_modules` does not persist across sessions → "tsc not found" mid-audit; any ephemeral environment must reinstall | Environment fact | Documented in mobile guide | 📋 |
| N-11 | ⚪ | `AdminAnnouncementsPage` | Delete uses direct supabase while list/create use backend — mixed paths (RLS still enforces) | Accretion | Documented; acceptable | 📋 |
| N-12 | ⚪ | `notificationclick` SW | Opens `data.url` from payload — open-redirect-ish, but no push sender exists in this system | Dormant | Documented | 📋 |

## PART 4 — Regression Report (did Stage-2/3 fixes break anything?)

1. **N-2 was a real regression introduced by Stage-2** — found and fixed this pass (verified by re-deriving the render chain: catalog refetch → new `video` object → effect rerun → new ticket string → `videoSrc` change → element reload).
2. **N-6 was a latent vulnerability activated by the Stage-2 migration** — fixed in the same (not-yet-applied) migration.
3. Dependency audit of every edited call site: stream auth (ticket → legacy fallback intact), admin CRUD (validation additive), enrollment approval (idempotent on conflict), worker patch (new signature backward-compatible default `task=None`), bot webhook (both URL styles accepted). No broken imports (full typecheck + pytest + build green).
4. `supabase==2.6.0` bump: API surface used (`create_async_client`, table builder) unchanged — import verified.

## PART 15 — Final Verification Table

| System | Prev. bugs | New bugs found | Fixed now | Unfixed/known | Runtime verification required | External action required |
|---|---|---|---|---|---|---|
| Frontend | 6 | N-2,3,4,5,7,8 | ✅ all | AdminSystemPage fake stats | Playback soak test after deploy | Deploy Netlify |
| Backend | 12 | N-1 | ✅ | single-worker scale limits | Live Supabase integration | Deploy Render + env |
| Database | 5 | N-6 | ✅ migration written | quiz_attempts history mess (legacy) | Apply migration on real DB | Supabase dashboard |
| API | 4 | — | ✅ | catalog no pagination | Post-deploy smoke tests | — |
| Auth/AuthZ | 4 | N-7 | ✅ (client gate) | server-side signup gate | Blocked-user stream test | — |
| State | 2 | — | ✅ | dual catalog caches (by design) | — | — |
| Security | 10 | N-6 | ✅ | ToS risk of Telegram storage | Redeploy + manual probes | — |
| DevOps | 5 | N-10 | ✅ | no rollback automation | CI run on main push | Secrets in GH |
| Telegram | — | — | code paths repaired | everything external | End-to-end after rebuild | **Recreate 19 channels + bot** |
| UX/SEO/Analytics | 4 | N-3,8 | ✅ | SPA-only SEO | Mobile walkthrough | — |
| Tests | 4 | — | ✅ | coverage depth | — | — |

## Honest final state (no false completion claims)

- **Verified in this environment:** dependency install, 17/17 backend tests, 7/7 frontend tests, typecheck, production build, YAML validity, migration SQL review.
- **Requires your manual action:** apply migration on Supabase, set env vars (esp. `JWT_SECRET`), recreate Telegram infrastructure, deploy Render+Netlify, add GH secrets/vars.
- **Requires runtime testing after deploy:** blocked-user denial, fail-closed path, ticket playback soak, first enrollment approval E2E, webhook delivery.
- **Permanently lost:** original 18 channels' videos, message IDs, bot state. No repository evidence can restore them.
- **Unknown:** whether your old Telegram API id/hash, Supabase project, Render/Netlify accounts still exist — must be checked by you (procedures in `docs/MOBILE_ONLY_RECOVERY.md`).
