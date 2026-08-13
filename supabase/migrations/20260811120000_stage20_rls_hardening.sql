-- ═══════════════════════════════════════════════════════════════════════
-- Stage 20: enable RLS on tables that were created without it.
--
-- Security finding: audit_logs, error_logs, user_sessions, push_subscriptions
-- and videos_temp had no RLS enabled. Supabase grants table privileges to
-- the `anon` and `authenticated` roles by default, so without RLS any holder
-- of the public anon key could read/write those tables via PostgREST.
--
-- These tables are written by the backend using the service-role key
-- (which bypasses RLS) or, in the case of push_subscriptions, by the
-- logged-in user. We therefore enable RLS and add least-privilege policies.
-- This migration is additive and idempotent; it does not drop any data.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

-- 1. audit_logs — backend-only (service key bypasses RLS); no public access.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_service_only" ON public.audit_logs;
-- Intentionally no policy for anon/authenticated: the backend writes via
-- the service role. If a read policy is ever needed for admins, gate it
-- behind is_admin() rather than opening the table.

-- 2. error_logs — backend-only.
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_logs_service_only" ON public.error_logs;

-- 3. user_sessions — backend-only (the admin sessions endpoint actually
-- reads activity_logs, not this table).
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_sessions_service_only" ON public.user_sessions;

-- 4. push_subscriptions — a user may read/insert/update only their own row.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_owner_all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_all"
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 5. videos_temp — throwaway staging table; backend-only.
ALTER TABLE public.videos_temp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "videos_temp_service_only" ON public.videos_temp;

-- Ensure the service role can still manage all of these (it bypasses RLS,
-- but make the intent explicit and revoke public table privileges).
REVOKE ALL ON public.audit_logs, public.error_logs, public.user_sessions,
    public.videos_temp FROM anon, authenticated;
-- push_subscriptions keeps row-level access for authenticated users.
GRANT SELECT, INSERT, UPDATE ON public.push_subscriptions TO authenticated;

COMMIT;
