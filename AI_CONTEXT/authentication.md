# Authentication
Supabase GoTrue email/password; SPA stores session in localStorage; autoRefresh + 5-min-early timer + apiFetch 401→refresh→retry→logout. Backend validates by calling GoTrue /auth/v1/user (LRU 300s).
Stream tickets (Stage-2): GET /api/stream-ticket/{id} with JWT → 6h HMAC ticket `{user_id}:{exp}:{sig}` over `user_id:video_id:exp` keyed by JWT_SECRET (fallback ADMIN_TOKEN, else ephemeral per-boot). <video> uses ?ticket=; legacy ?token= JWT kept as degraded fallback — remove after full rollout.
Blocked users: denied server-side on stream/ticket endpoints (60s cache) — Stage-2.
Password reset: GoTrue email → /reset-password. No MFA (residual; enable Supabase captcha per SECURITY_THREAT_MODEL R2).
