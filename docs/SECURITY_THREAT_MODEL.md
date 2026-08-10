# Stage 5 — Threat Model, Attack Surface Map & Remediation Plan

Question of this stage: **"How could an attacker abuse this system?"** (not merely "what bugs exist").

## 1. Assets (what is worth stealing/breaking)
A1 Video content (the paid product) · A2 Supabase service-role key (full DB) · A3 Telegram session strings (**full Telegram-account takeover**) · A4 User PII (emails, watch behavior, payment trxIDs) · A5 Admin accounts · A6 Render/Netlify/GitHub accounts · A7 Enrollment revenue stream.

## 2. Attack surface map
| Surface | Entry points | Trust boundary |
|---|---|---|
| Browser SPA | Netlify site, localStorage JWT, SW | untrusted |
| FastAPI | 43 HTTP routes, `/api/bot_webhook` | semi-trusted (rate-limited) |
| Supabase | PostgREST anon (RLS), GoTrue, direct SDK from SPA | RLS = enforcement |
| Telegram | MTProto user session, bot webhook | external |
| CI/CD | GH Actions secrets, deploy hooks | privileged |
| Ops | Render/Netlify dashboards, ADMIN_TOKEN | privileged |

## 3. Threat catalog (STRIDE-flavored) with status
| # | Threat | Path | Likelihood | Status after Stages 2–5 |
|---|---|---|---|---|
| T1 | Stream premium without paying | guess UUIDs → `/api/stream` | Medium | **Mitigated**: JWT/ticket auth + enrollment check + fail-closed + blocked-user check (tests in matrix) |
| T2 | Token theft via media URL | `?token=` leakage | High | **Mitigated (new code)**: 6h scoped tickets; legacy path deprecated — deploy new frontend to close fully |
| T3 | Session hijack via XSS | injected script reads localStorage | Low (no dangerouslySetInnerHTML, React escaping) | Residual: CSP still allows 'unsafe-inline' — remediation R1 |
| T4 | Privilege escalation | edit profiles.role, direct PostgREST writes | Medium | **Mitigated**: RLS admin-only; role writes require admin/service key; FE fallback writes still RLS-bound |
| T5 | IDOR on admin user endpoints | `/api/admin/users/{id}/*` | Medium | **Mitigated**: `_ensure_admin` server-side on all (tests) |
| T6 | Webhook spoofing | forged bot updates | Medium | **Mitigated** when `TELEGRAM_WEBHOOK_SECRET` set — **startup warning added when unset (Stage 5)**; you MUST set it |
| T7 | PostgREST injection via URL params | admin endpoints | Low | **Mitigated**: UUID/ISO validation, whitelists |
| T8 | Brute force login | GoTrue password spray | Medium | Partially mitigated by Supabase defaults; remediation R2 |
| T9 | Rate-limit bypass via header spoofing | X-Forwarded-For | Low | **Mitigated**: right-most trusted hop parsing |
| T10 | Service-key exposure | env misconfig/logs | Medium | Key only in Render env + secrets_manager; CSP/headers set; remediation R3 (log scrubbing review) |
| T11 | Session-string theft | .env leak | **High impact** | `.gitignore` covers env/sessions; never commit; treat as password (mobile guide warns) |
| T12 | Supply chain | stale deps | Medium | requirements/pins audited Stage 2; run `pip-audit`/`npm audit` regularly (R4) |
| T13 | Replay of admin HMAC | captured signature | Low | **Mitigated**: 60s window + nonce cache |
| T14 | Enumeration | `/api/thumbnail/{id}` unauth | Low | Partial (placeholder redirect + rate limit); remediation R5 |
| T15 | CI secret abuse | forked PR accessing secrets | Low | `pull_request` runs without secret access by GH default; deploy gated on main push |
| T16 | CSRF | n/a (no cookie auth) | Low | Not applicable; verify remains true if cookies ever added |
| T17 | SSRF | no user-controlled fetch targets server-side except fixed Supabase/worker URLs | Low | Worker URL from env only — keep env writes admin-only |

## 4. Remediation plan (remaining)
| ID | Action | Priority | Owner |
|---|---|---|---|
| R1 | Replace 'unsafe-inline' in FE CSP with nonce for the theme script | P3 | AI on request |
| R2 | Enable Supabase email captcha / rate-limit auth endpoints (dashboard setting) | P2 | 👤 dashboard |
| R3 | Audit logs for accidental secret echo (none found in Stage-5 grep of `logger.*KEY/TOKEN/SESSION` patterns — logger statements avoid secrets; keep discipline) | P3 | ongoing |
| R4 | Add `pip-audit` + `npm audit --production` to CI weekly | P3 | AI on request |
| R5 | Enforce enrollment on `/api/thumbnail` for locked chapters (mirror stream check) | P3 | AI on request |
| R6 | Set TELEGRAM_WEBHOOK_SECRET + ADMIN_TOKEN + JWT_SECRET in Render (👤) | **P0 at deploy** | 👤 |

## 5. What an attacker CANNOT do after current fixes (evidence-backed)
Stream locked content without a valid ticket/JWT+enrollment (test-verified) · read other users' data via PostgREST (RLS) · access admin endpoints anonymously (tests) · forge tickets without the secret (unit tests) · replay admin HMAC (nonce cache) · spoof rate-limit IPs through Render (hop parsing).
