-- ═══════════════════════════════════════════════════════════════════════
-- STAGE 2 SCHEMA RECONCILIATION (2026-08-10)
--
-- Purpose: the application code reads/writes several columns that were
-- added to the live database by hand and were NEVER captured in any
-- migration. Without this file, a fresh `supabase db push` leaves the
-- app partially broken:
--
--   * profiles.role              -> used by frontend AuthContext, backend
--                                   _ensure_admin / get_current_admin and
--                                   one historical is_admin() definition
--   * audit_logs.user_id         -> written by backend AuditMiddleware
--   * videos.file_size_bytes,
--     videos.mime_type,
--     videos.telegram_fetched_at -> read/written by main.py get_file_info
--                                   / _save_file_metadata
--   * videos.file_id             -> patched by workers/upload_worker.py
--   * enrollment_codes.cycle_id  -> written by /api/admin/generate_chapter_code
--                                   for type=cycle codes (chapter_id must
--                                   therefore become nullable)
--   * announcements.message/target/priority/scheduled_at/sent_at/created_by
--                                -> written by /api/admin/announcements and
--                                   AdminAnnouncementsPage (the original
--                                   complete_schema table used title/body)
--   * pending_enrollments.reviewed_by/reviewed_at
--                                -> new admin approval flow (Stage 2)
--
-- All statements are idempotent and safe to run against a database that
-- was hand-patched previously.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. profiles.role ────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_role'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT chk_profiles_role CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE role = 'admin';

-- ── 2. audit_logs.user_id ───────────────────────────────────────────────
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ── 3. videos runtime-metadata columns ─────────────────────────────────
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS telegram_fetched_at TIMESTAMPTZ;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_file_id ON public.videos(file_id) WHERE file_id IS NOT NULL;

-- ── 4. enrollment_codes: cycle-scoped codes ────────────────────────────
ALTER TABLE public.enrollment_codes
    ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.cycles(id) ON DELETE CASCADE;

-- Chapter-scoped codes keep chapter_id; cycle-scoped codes set it NULL.
ALTER TABLE public.enrollment_codes ALTER COLUMN chapter_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_enrollment_code_scope'
    ) THEN
        ALTER TABLE public.enrollment_codes
            ADD CONSTRAINT chk_enrollment_code_scope
            CHECK (chapter_id IS NOT NULL OR cycle_id IS NOT NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollment_codes_cycle ON public.enrollment_codes(cycle_id)
    WHERE cycle_id IS NOT NULL;

-- ── 5. announcements: dashboard/backend shape ──────────────────────────
-- The 20260502 complete_schema created announcements(title, body, type...).
-- The running system (backend AnnouncementReq + AdminAnnouncementsPage)
-- uses message/target/priority/sent_at/created_by. We ADD the runtime
-- columns instead of recreating the table so no data is lost either way.
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT 'all';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 6. pending_enrollments: approval bookkeeping ───────────────────────
ALTER TABLE public.pending_enrollments
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.pending_enrollments
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ── 7. activity_logs retention helper index (admin log viewer) ─────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
    ON public.activity_logs(user_id, created_at DESC);

-- ── 8. Stage 3: cycle-aware, race-safe code redemption ─────────────────
-- Two defects in the original use_chapter_enrollment_code:
--   a) `v_code.chapter_id != p_chapter_id` evaluates to NULL for
--      cycle-scoped codes (chapter_id IS NULL) → the check silently
--      passed and such a code became redeemable for ANY chapter.
--   b) read-then-write on uses_count allowed concurrent redemptions to
--      exceed max_uses.
CREATE OR REPLACE FUNCTION public.use_chapter_enrollment_code(
    p_code TEXT,
    p_chapter_id UUID,
    p_device_fingerprint TEXT,
    p_device_user_agent TEXT
) RETURNS json AS $$
DECLARE
    v_code RECORD;
    v_existing RECORD;
    v_updated UUID;
BEGIN
    IF public.is_admin() THEN
        RETURN json_build_object('success', true, 'message_bn', 'অ্যাডমিনদের এনরোলমেন্ট লাগে না।');
    END IF;

    SELECT * INTO v_code
    FROM public.enrollment_codes
    WHERE code = p_code AND is_active = true
      AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message_bn', 'কোডটি সঠিক নয়, মেয়াদ শেষ অথবা বন্ধ করা হয়েছে।');
    END IF;

    -- Scope validation: chapter codes match exactly; cycle codes only
    -- redeem inside their own cycle.
    IF v_code.cycle_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.chapters
            WHERE id = p_chapter_id AND cycle_id = v_code.cycle_id
        ) THEN
            RETURN json_build_object('success', false, 'message_bn', 'এই কোডটি এই চ্যাপ্টারের জন্য নয়।');
        END IF;
    ELSIF v_code.chapter_id IS DISTINCT FROM p_chapter_id THEN
        RETURN json_build_object('success', false, 'message_bn', 'এই কোডটি এই চ্যাপ্টারের জন্য নয়।');
    END IF;

    SELECT * INTO v_existing
    FROM public.chapter_access
    WHERE user_id = auth.uid() AND chapter_id = p_chapter_id;

    IF FOUND THEN
        RETURN json_build_object('success', false, 'message_bn', 'আপনি ইতিমধ্যে এই চ্যাপ্টারে এনরোল্ড।');
    END IF;

    -- Atomic consumption: increments only while a use remains, so
    -- simultaneous redemptions cannot exceed max_uses.
    UPDATE public.enrollment_codes
    SET uses_count = uses_count + 1
    WHERE id = v_code.id
      AND is_active = true
      AND uses_count < max_uses
      AND (expires_at IS NULL OR expires_at > now())
    RETURNING id INTO v_updated;

    IF v_updated IS NULL THEN
        RETURN json_build_object('success', false, 'message_bn', 'কোডটির ব্যবহার সীমা শেষ হয়ে গেছে।');
    END IF;

    BEGIN
        INSERT INTO public.chapter_access
            (user_id, chapter_id, enrollment_code_id, device_fingerprint, device_user_agent)
        VALUES
            (auth.uid(), p_chapter_id, v_code.id, p_device_fingerprint, p_device_user_agent);
    EXCEPTION WHEN unique_violation THEN
        RETURN json_build_object('success', false, 'message_bn', 'আপনি ইতিমধ্যে এই চ্যাপ্টারে এনরোল্ড।');
    END;

    RETURN json_build_object('success', true, 'message_bn', 'সফলভাবে এনরোলমেন্ট সম্পন্ন হয়েছে!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
