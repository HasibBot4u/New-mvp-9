-- ═══════════════════════════════════════════════════════════════════════
-- Stage 21: harden SECURITY DEFINER helper functions.
--
-- Finding: get_admin_stats() was SECURITY DEFINER with no admin guard and
-- default PUBLIC EXECUTE, so any holder of the anon key could call it and
-- read aggregate counts (total users/videos/etc.). It contains no PII but
-- should not be publicly callable. We:
--   1. redefine it to require is_admin() (returns NULL for non-admins),
--   2. set search_path = public,
--   3. revoke public EXECUTE and grant only to authenticated (the admin
--      dashboard calls it while logged in as an admin).
-- check_chapter_access already scopes to auth.uid() and returns only the
-- caller's own access state; it remains publicly executable (as designed).
--
-- This migration is additive and idempotent and does not touch data.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.is_admin() THEN json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_videos', (SELECT COUNT(*) FROM public.videos WHERE is_active = true),
    'total_subjects', (SELECT COUNT(*) FROM public.subjects WHERE is_active = true),
    'total_chapters', (SELECT COUNT(*) FROM public.chapters WHERE is_active = true),
    'active_users_today', (
        SELECT COUNT(DISTINCT user_id) FROM public.activity_logs
        WHERE created_at > now() - interval '1 day'
    ),
    'new_signups_this_week', (
        SELECT COUNT(*) FROM public.profiles
        WHERE created_at > now() - interval '7 days'
    ),
    'total_watch_seconds', (
        SELECT COALESCE(SUM(progress_seconds), 0) FROM public.watch_history
    ),
    'enrollment_codes_used', (
        SELECT COALESCE(SUM(uses_count), 0) FROM public.enrollment_codes
    )
  ) ELSE NULL END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

COMMIT;
