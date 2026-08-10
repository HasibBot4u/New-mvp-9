# Stage 9 — Observability & Incident Response

## A. What the system emits today (evidence)
- **Logs:** uvicorn stdout → Render Logs tab (live, phone-accessible). Tagged lines: `[NexusEdu]`, `[System]`, `[AuthZ]`, `[Webhook]`, `[UploadWorker]`, `[Activity]`, `[Metrics Error]`, GlobalException tracebacks.
- **Audit:** `audit_logs` (admin+auth requests: path/method/status/ip/duration/user_id — works after Stage-3 migration), `activity_logs` (login/logout/stream_start/catalog_view/errors/web_vital).
- **Metrics:** `/metrics` (admin): `request_count`, `request_latency_seconds`, `telegram_connected` gauge; `prometheus.yml`+`alert.rules` aligned to these names (Stage 2).
- **Business signals:** pending_enrollments counts, enrollment redemptions (`uses_count`), watch_history.
- **Uptime:** UptimeRobot/GH keep-alive on `/api/ping`.

## B. Alert thresholds (what SHOULD page you)
| Signal | Threshold | Source | How you get it (phone) |
|---|---|---|---|
| Site down | 2 failed pings | UptimeRobot | push notification (free) |
| Backend 5xx burst | >5% of reqs for 2m | Prometheus alert (if deployed) or Render log grep | optional |
| Telegram disconnected | `telegram_connected==0` 2m | gauge | admin bot `/status` + Render logs |
| Supabase error | `/api/health` supabase≠connected | health endpoint | UptimeRobot keyword monitor on `/api/health` (free plan supports HTTP) |
| Failed uploads | `upload_queue.status='failed'` | SQL | weekly manual check (SQL editor) |
| Failed login spike | activity_logs action=error | SQL | weekly |

## C. Incident response playbook (phone-executable)
```
DETECT   → UptimeRobot alert / user report / Actions red
IDENTIFY → 1) Render → Logs (last 50 lines)  2) GitHub → Actions run logs
           3) Netlify deploy status  4) /api/health + /api/channels/health
CONTAIN  → If bad deploy: rollback (DEPLOYMENT_PIPELINE.md table)
           If Telegram ban/flood: switch to PYROGRAM_SESSION_STRING_2
           If Supabase incident: frontend degrades to IDB catalog; streams 503 — post announcement via bot /notify when restored
FIX      → smallest revert first; forward-fix second
VERIFY   → TESTING_MATRIX.md §D smoke script
DOCUMENT → add a row to docs/known-issues (AI_CONTEXT/known-issues.md)
PREVENT  → add/adjust a test that reproduces the incident
```
## D. Gaps (honest)
No APM/tracing; no structured JSON logs; Grafana stack not deployed (configs exist but require a Prometheus host — optional paid/extra account). For this scale, Render logs + UptimeRobot + audit tables cover real incidents; upgrade path documented in FREE_MONITORING.md.
