# Known residuals (do not re-diagnose; pick up here)
K1 single-worker scale ceiling + in-memory state (P1/P2 in PERFORMANCE_SCALE_PLAN) · K2 upload_queue stuck 'processing' rows after restart — reaper R8 not built · K3 maintenance_mode not enforced server-side · K4 allow_registrations client-gate only · K5 thumbnail endpoint unauth enumeration (R5) · K6 CSP 'unsafe-inline' (R1) · K7 index.html JSON-LD claims 7 subjects/10k students — edit to truth · K8 two toast systems mounted · K9 HLS variant pipeline stubbed (video_variants empty) · K10 Drive worker default = personal account · K11 quiz_attempts migration history chaotic (legacy, unused feature) · K12 no MFA/captcha yet (R2) · K13 activity_logs unbounded growth (P3).

## Stage 20 pre-launch
- New migration `20260811120000_stage20_rls_hardening.sql` MUST be applied after earlier migrations on any real DB (enables RLS on audit_logs/error_logs/user_sessions/videos_temp + owner policy on push_subscriptions).
- Frontend no longer hardcodes a fallback Render URL; VITE_API_BASE_URL must be set in Netlify or API calls fail (intentional fail-loud).
- Admin user-inspection endpoints now require UUID path params (422 on non-UUID).
- Last-known historical URLs (netlify app, nexusedu.com, old Supabase ref) are NOT verified live; owner must confirm them.
