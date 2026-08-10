# Stage 11 — Disaster Recovery & Business Continuity

**The defining question: "If production completely disappeared today, could we rebuild?"** This project has already lived the answer once (Telegram deletion). Now the rebuild path is documented and partially automated.

## Recovery matrix (RTO = time to restore service; RPO = data loss window)
| Asset | Backup source | Restore method | RTO | RPO |
|---|---|---|---|---|
| Source code | GitHub repo (+ tag `backup/*`) | clone | minutes | 0 |
| Database schema | `supabase/migrations/` | SQL editor run in order | 30 min | 0 |
| Database DATA | **weekly db-backup workflow artifact** — the workflow file ships at `docs/ops/db-backup.workflow.yml` (this automation token cannot write `.github/workflows/`): in the GitHub web UI, create `.github/workflows/db-backup.yml` with that content once, then set the `SUPABASE_DB_URI` secret; manual `pg_dump` otherwise | SQL editor or Codespace `psql` import | 1–2 h | ≤7 days (set secret → automated) |
| Env config | `docs/RECOVERY_FRESH_START.md` variable map + your private notes | re-enter in dashboards | 1 h | whatever you noted |
| Secrets | none stored (by design) | **rotate and reissue** after a breach; otherwise keep offline private copy | — | — |
| Deployment | render.yaml, netlify.toml, workflows in-repo | reconnect repo | 30 min | 0 |
| Domain/DNS | registrar account (UNKNOWN if you own a domain — netlify.app subdomain otherwise) | registrar login | hours | 0 |
| Telegram channels/bot | **no backup possible** | recreate per TELEGRAM_RECONSTRUCTION.md | 1 day | videos: whatever you re-upload |
| Video files | **only copies are the Telegram channels** | re-upload from your original sources | days | **lost if sources lost** — keep originals on at least one drive/cloud |
| Analytics/logs | activity_logs in DB (covered by DB backup) | — | — | — |

## Full-rebuild drill (the answer to "everything disappeared")
1. GitHub → repo still exists → Codespace. 2. Supabase: new project → run migrations → restore latest artifact → re-add admin row. 3. Render: new service from repo + env. 4. Netlify: import repo + VITE vars. 5. Telegram: recreate per guide (channels, session, bot, IDs → env + `cycles.telegram_channel_id`). 6. Re-upload videos. 7. Smoke script. **Estimated: half a day infra + video re-upload time.**

## Continuity hardening still recommended
- Set `SUPABASE_DB_URI` secret **today** (activates weekly backups) — 👤 2-minute task.
- Keep original video sources somewhere outside Telegram (the 2026 deletion proved Telegram is not durable storage for your only copy).
- Export enrollment_codes CSV monthly (admin UI has Export CSV).
