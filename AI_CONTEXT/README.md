# AI_CONTEXT — Compact Technical Memory

Read this directory **first** when working on the repo. These files are
maintained as ground truth for AI agents. If code and docs disagree, verify
against code and update these files. Keep entries terse and factual
(CONFIRMED / INFERRED / UNKNOWN where useful) — do not duplicate the human
operational guide.

| File | Contents |
|---|---|
| architecture.md | Module/layer topology, data flow, frontend + backend structure (Stage 16) |
| api.md | Endpoint inventory grouped by router, auth requirements |
| authentication.md | JWT lifecycle, stream tickets, refresh behavior |
| authorization.md | Roles, chapter access, admin/HMAC checks |
| business-logic.md | Catalog, enrollment, streaming, progress rules |
| database.md | Schema truth, RLS, migration rules |
| integrations.md | Supabase, Telegram, Render, Netlify, Cloudflare, GitHub Actions |
| telegram.md | MTProto client + bot model, channels, reconstruction |
| deployment.md | Environments, pipeline, rollback |
| testing.md | Suites and how to run them |
| troubleshooting.md | Symptom → cause |
| known-issues.md | Open residuals |
| conventions.md | Code style, module-boundary rules, hard-won lessons |

## How to orient quickly
1. `architecture.md` — where code lives and dependency direction.
2. `api.md` / `database.md` — contracts and data ownership.
3. `business-logic.md` / `authorization.md` — rules.
4. For human operators: `docs/PROJECT_REVIVAL_GUIDE.md`.
5. Historical stage reports: `docs/history/`. ADRs: `docs/architecture-decisions/`.
