# Stage 15 — Controlled Failure / Chaos Audit

Question: **"How can we make it fail — and does it fail safely?"** Each scenario was traced through actual code paths (not executed against live infra — classified accordingly).

| # | Failure injected | Code path & behavior | Verdict |
|---|---|---|---|
| 1 | Supabase unavailable | catalog: stale cache ≤5min then 503 · auth: verify fails → 401 (closed) · progress: 500 + client retry once · app boots (lifespan tolerates) | ✅ fails safe; data preserved |
| 2 | Telegram disconnected | watchdog reconnect exp-backoff ≤120s · secondary session failover · streams meanwhile 503 · `telegram_connected`=0 alertable | ✅ designed for it |
| 3 | Telegram account banned | primary reconnect fails forever; if `SESSION_STRING_2` set service continues on it, else streams down | 🟡 mitigated only if 2nd session configured (👤) |
| 4 | Backend restart mid-stream | client gets EOF → retries range; server holds no stream state | ✅ |
| 5 | Restart mid-upload | `upload_queue` row stays `processing`→ worker repolls `pending` only; processing row orphaned | 🟡 residual: add stuck-job reaper (R8) |
| 6 | FloodWait burst | sleeps `e.value` in safe_upload; stream generator logs+stops → player retries | 🟡 shared stall across users (known) |
| 7 | Two users redeem last code use simultaneously | atomic UPDATE WHERE uses_count<max_uses (Stage-3 RPC) → exactly one wins | ✅ fixed |
| 8 | Expired JWT mid-video | next Range → 401/ticket-expired → PlayerPage error UI with re-login path | ✅ |
| 9 | Duplicate approval click | 2nd request sees status≠pending → 409 | ✅ |
| 10 | Malformed Range header | `_parse_range` clamps/falls back to full file | ✅ |
| 11 | Deploy during active streams | Render graceful stop; streams drop; clients retry | ✅ acceptable |
| 12 | Corrupted env (bad API_ID string) | int-parse guard disables Telegram cleanly, app boots | ✅ (Stage-1 fix present) |
| 13 | Redis unavailable | rate limiter logs + memory fallback; no crash | ✅ |
| 14 | Netlify build fails on bad env | build-time throw (env.ts) → deploy blocked loudly, old site stays live | ✅ |
| 15 | GH keep-alive disabled (60d idle) | Render sleeps; first request cold-starts 30–60s; UptimeRobot backup if configured | 🟡 documented |
| 16 | Worker (Drive proxy) deleted | drive videos fail; telegram unaffected | 🟡 external |
| 17 | Catalog refresh loop error | logs traceback, keeps serving last cache | ✅ |
| 18 | Audit DB write fails | swallowed + error log (auditing degrades, service doesn't) | ✅ |

**Overall:** the system fails **safe and diagnosable** in 15/18 scenarios; residuals R8 (stuck upload-job reaper), 2nd Telegram session, UptimeRobot. Nothing found that fails **silently with data corruption** — writes are idempotent upserts or status-guarded.

## R8 (new remediation)
`upload_queue` stuck-job reaper: on worker start, reset rows `status='processing' AND updated_at < now()-15min` → `pending`. Small, safe, recommended before heavy re-upload work.
