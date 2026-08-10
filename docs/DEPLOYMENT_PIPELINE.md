# Stage 8 — Production Pipeline: Dev → Test → Staging → Production (+ rollback)

## Environments (as this repo actually has them)
| Env | Where | Purpose |
|---|---|---|
| Development | Codespace/Termux: `vite dev` (proxies `/api`→:8000) + `uvicorn backend.main:app --reload` | iterate |
| Test | `pytest` + `vitest` local and in CI on every push/PR | gates |
| **Staging** | **Netlify deploy previews (automatic on every PR)** + optional 2nd free Render service `nexusedu-backend-staging` | pre-prod proof |
| Production | Netlify site + Render service | live |

## Pipeline
```
push/PR ─► GitHub Actions CI: typecheck → lint → vitest → pytest → build (+CodeQL)
   │
   ├─ PR        → Netlify **deploy preview** URL (staging) — test on your phone
   └─ merge main → Netlify production deploy + Render deploy hook (backend)
```
Secrets required in GitHub (Settings → Secrets): `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `RENDER_DEPLOY_HOOK`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, `SITE_URL`; Variable: `BACKEND_URL` (keep-alive); optional secret `SUPABASE_DB_URI` (enables weekly db-backup workflow).

## Release strategy
Small merges to main; each merge = full rebuild. **Migration releases:** new SQL file in `supabase/migrations/` → apply FIRST in Supabase (SQL editor, phone) → then deploy backend that uses it (additive-only rule: new columns nullable/defaulted ⇒ old code unaffected).

## ROLLBACK STRATEGY (mandatory question answered)
| Layer | How to roll back | From phone |
|---|---|---|
| Frontend | Netlify → Deploys → previous deploy → **Publish** (one tap); or `git revert` merge → CI redeploys | ✅ |
| Backend | Render → service → **Deploys** tab → older deploy → restore/rollback; or `git revert` + auto-redeploy | ✅ |
| Database | Additive migrations don't need rollback; if destructive change ever needed → restore latest `db-backup` artifact (Actions → db-backup run → download .sql.gz) into SQL editor | ✅ |
| Config | Env vars are versioned by you in the dashboard — keep a private note of previous values before changing | ✅ |
Rule: **never ship a backend that requires a migration not yet applied; never ship a migration that breaks old code** (additive-only keeps both directions safe).

## Health checks
Render health path `/health` (configured in render.yaml). Post-deploy smoke = `docs/TESTING_MATRIX.md §D`. UptimeRobot (free) → `/api/ping` every 5 min + alert on down (backup for GH cron which dies after 60 idle days).
