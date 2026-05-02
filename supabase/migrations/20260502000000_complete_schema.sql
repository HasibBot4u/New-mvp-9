-- Complete schema generated for NexusEdu

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

--------------------------------------------------------------------------------
-- TABLE DEFINITIONS
--------------------------------------------------------------------------------

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    email TEXT,
    phone TEXT,
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ
);

-- USER ROLES
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
);

-- SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_bn TEXT,
    description TEXT,
    description_bn TEXT,
    icon TEXT,
    color TEXT,
    thumbnail_color TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- CYCLES
CREATE TABLE IF NOT EXISTS cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    name_bn TEXT,
    description TEXT,
    description_bn TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    telegram_channel_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- CHAPTERS
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    name_bn TEXT,
    description TEXT,
    description_bn TEXT,
    display_order INTEGER DEFAULT 0,
    requires_enrollment BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- VIDEOS
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    title_bn TEXT,
    description TEXT,
    description_bn TEXT,
    source_type TEXT DEFAULT 'telegram',
    source_url TEXT,
    telegram_channel_id TEXT,
    telegram_message_id INTEGER,
    youtube_video_id TEXT,
    drive_file_id TEXT,
    thumbnail_url TEXT,
    duration TEXT,
    size_mb NUMERIC,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ENROLLMENT CODES
CREATE TABLE IF NOT EXISTS enrollment_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    label TEXT,
    notes TEXT,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- CHAPTER ACCESS
CREATE TABLE IF NOT EXISTS chapter_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
    enrollment_code_id UUID REFERENCES enrollment_codes(id) ON DELETE SET NULL,
    device_fingerprint TEXT,
    device_user_agent TEXT,
    access_count INTEGER DEFAULT 1,
    first_accessed_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ DEFAULT now(),
    is_blocked BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    UNIQUE(user_id, chapter_id)
);

-- WATCH HISTORY
CREATE TABLE IF NOT EXISTS watch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
    progress_seconds INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    watch_count INTEGER DEFAULT 1,
    watched_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, video_id)
);

-- VIDEO NOTES
CREATE TABLE IF NOT EXISTS video_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, video_id)
);

-- VIDEO BOOKMARKS
CREATE TABLE IF NOT EXISTS video_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
    timestamp_seconds INTEGER NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, video_id, timestamp_seconds)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    title_bn TEXT,
    body TEXT,
    body_bn TEXT,
    action_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- LIVE CLASSES
CREATE TABLE IF NOT EXISTS live_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    title_bn TEXT,
    description TEXT,
    description_bn TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    meeting_url TEXT,
    stream_url TEXT,
    is_completed BOOLEAN DEFAULT false,
    is_cancelled BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    title_bn TEXT,
    body TEXT,
    body_bn TEXT,
    expires_at TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    show_on_dashboard BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- QUIZZES
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    time_limit_seconds INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- QUIZ QUESTIONS
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_idx INTEGER NOT NULL,
    explanation TEXT,
    order_index INTEGER
);

-- QUIZ ATTEMPTS
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    score INTEGER DEFAULT 0,
    answers JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, quiz_id)
);

-- QA QUESTIONS
CREATE TABLE IF NOT EXISTS qa_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    is_answered BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- QA ANSWERS
CREATE TABLE IF NOT EXISTS qa_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES qa_questions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    body TEXT NOT NULL,
    is_accepted BOOLEAN DEFAULT false,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CYCLE COMPLETIONS
CREATE TABLE IF NOT EXISTS cycle_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, cycle_id)
);

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_subjects_slug ON subjects(slug);
CREATE INDEX IF NOT EXISTS idx_cycles_subject_id ON cycles(subject_id);
CREATE INDEX IF NOT EXISTS idx_chapters_cycle_id ON chapters(cycle_id);
CREATE INDEX IF NOT EXISTS idx_videos_chapter_id ON videos(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_access_user_id ON chapter_access(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_access_chapter_id ON chapter_access(chapter_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_codes_code ON enrollment_codes(code);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_video_id ON watch_history(video_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_live_classes_scheduled ON live_classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);

--------------------------------------------------------------------------------
-- RPC FUNCTIONS
--------------------------------------------------------------------------------

-- HAS_ROLE
CREATE OR REPLACE FUNCTION has_role(_role app_role, _user_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- IS_ADMIN
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN has_role('admin', auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GET_ADMIN_STATS
CREATE OR REPLACE FUNCTION get_admin_stats() RETURNS json SECURITY DEFINER AS $$
SELECT json_build_object(
  'total_users', (SELECT COUNT(*) FROM profiles),
  'total_videos', (SELECT COUNT(*) FROM videos WHERE is_active=true),
  'total_subjects', (SELECT COUNT(*) FROM subjects WHERE is_active=true),
  'total_chapters', (SELECT COUNT(*) FROM chapters WHERE is_active=true),
  'active_users_today', (SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at > now()-interval '1 day'),
  'new_signups_this_week', (SELECT COUNT(*) FROM profiles WHERE created_at > now()-interval '7 days'),
  'total_watch_seconds', (SELECT COALESCE(SUM(progress_seconds),0) FROM watch_history),
  'enrollment_codes_used', (SELECT COALESCE(SUM(uses_count),0) FROM enrollment_codes)
);
$$ LANGUAGE sql;

-- CHECK_CHAPTER_ACCESS
CREATE OR REPLACE FUNCTION check_chapter_access(p_chapter_id UUID, p_device_fingerprint TEXT) 
RETURNS json AS $$
DECLARE
    v_requires_enrollment BOOLEAN;
    v_has_access RECORD;
BEGIN
    -- Check if chapter requires enrollment
    SELECT requires_enrollment INTO v_requires_enrollment 
    FROM chapters WHERE id = p_chapter_id;

    IF NOT v_requires_enrollment THEN
        RETURN json_build_object('success', true);
    END IF;

    -- Admins have auto-access
    IF is_admin() THEN
        RETURN json_build_object('success', true);
    END IF;

    -- Check user's access
    SELECT * INTO v_has_access 
    FROM chapter_access 
    WHERE user_id = auth.uid() AND chapter_id = p_chapter_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'No active enrollment. Please apply a code.');
    END IF;

    IF v_has_access.is_blocked THEN
        RETURN json_build_object('success', false, 'error', 'Access blocked: ' || COALESCE(v_has_access.blocked_reason, 'Admin restriction'));
    END IF;

    IF v_has_access.device_fingerprint IS NOT NULL AND v_has_access.device_fingerprint != p_device_fingerprint THEN
         RETURN json_build_object('success', false, 'error', 'Device mismatch. Your enrollment is tied to another device.');
    END IF;

    -- Update last accessed
    UPDATE chapter_access SET 
        last_accessed_at = now(),
        access_count = access_count + 1
    WHERE id = v_has_access.id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USE_CHAPTER_ENROLLMENT_CODE
CREATE OR REPLACE FUNCTION use_chapter_enrollment_code(p_code TEXT, p_chapter_id UUID, p_device_fingerprint TEXT, p_device_user_agent TEXT) 
RETURNS json AS $$
DECLARE
    v_code RECORD;
    v_existing_access RECORD;
BEGIN
    IF is_admin() THEN
        RETURN json_build_object('success', true, 'message', 'Admins bypass enrollment.');
    END IF;

    -- Find the code
    SELECT * INTO v_code 
    FROM enrollment_codes 
    WHERE code = p_code AND is_active = true AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid, expired, or inactive enrollment code.');
    END IF;

    -- Ensure code belongs to the right chapter
    IF v_code.chapter_id != p_chapter_id THEN
        RETURN json_build_object('success', false, 'error', 'Code is not valid for this chapter.');
    END IF;

    -- Check limits
    IF v_code.uses_count >= v_code.max_uses THEN
        RETURN json_build_object('success', false, 'error', 'Code has reached its maximum usage limit.');
    END IF;

    -- Check if user already enrolled
    SELECT * INTO v_existing_access 
    FROM chapter_access 
    WHERE user_id = auth.uid() AND chapter_id = p_chapter_id;

    IF FOUND THEN
        RETURN json_build_object('success', false, 'error', 'You are already enrolled in this chapter.');
    END IF;

    -- Process enrollment
    INSERT INTO chapter_access (user_id, chapter_id, enrollment_code_id, device_fingerprint, device_user_agent)
    VALUES (auth.uid(), p_chapter_id, v_code.id, p_device_fingerprint, p_device_user_agent);

    UPDATE enrollment_codes SET uses_count = uses_count + 1 WHERE id = v_code.id;

    RETURN json_build_object('success', true, 'message', 'Successfully enrolled.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REDEEM_ENROLLMENT_CODE (Wrapper for above)
CREATE OR REPLACE FUNCTION redeem_enrollment_code(_code TEXT, _device_fingerprint TEXT DEFAULT NULL) 
RETURNS json AS $$
DECLARE
    v_code_chapter UUID;
BEGIN
    SELECT chapter_id INTO v_code_chapter FROM enrollment_codes WHERE code = _code;
    IF NOT FOUND THEN
         RETURN json_build_object('success', false, 'error', 'Code not found.');
    END IF;
    RETURN use_chapter_enrollment_code(_code, v_code_chapter, _device_fingerprint, 'Unknown User Agent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- INCREMENT WATCH COUNT
CREATE OR REPLACE FUNCTION increment_watch_count(p_video_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO watch_history (user_id, video_id, watch_count)
    VALUES (auth.uid(), p_video_id, 1)
    ON CONFLICT (user_id, video_id)
    DO UPDATE SET watch_count = watch_history.watch_count + 1, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_generate_chapter_code(p_chapter_id UUID, p_notes TEXT, p_label TEXT, p_max_uses INT)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    v_code := upper(substring(md5(random()::text) from 1 for 6)) || '-' || upper(substring(md5(random()::text) from 1 for 6));
    INSERT INTO enrollment_codes (chapter_id, code, max_uses, notes, label, generated_by, created_by)
    VALUES (p_chapter_id, v_code, p_max_uses, p_notes, p_label, auth.uid(), auth.uid());
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_toggle_enrollment_code(p_code_id UUID, p_active BOOLEAN)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    UPDATE enrollment_codes SET is_active = p_active WHERE id = p_code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_block_chapter_access(p_access_id UUID, p_block BOOLEAN, p_reason TEXT)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    UPDATE chapter_access SET is_blocked = p_block, blocked_reason = p_reason WHERE id = p_access_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_completions ENABLE ROW LEVEL SECURITY;

-- Apply Admin ALL policy dynamically
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON %I;', t);
        EXECUTE format('CREATE POLICY "Admins have full access" ON %I USING (is_admin());', t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Read access common policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can read active subjects" ON subjects;
CREATE POLICY "Anyone can read active subjects" ON subjects FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Anyone can read active cycles" ON cycles;
CREATE POLICY "Anyone can read active cycles" ON cycles FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Anyone can read active chapters" ON chapters;
CREATE POLICY "Anyone can read active chapters" ON chapters FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Anyone can read active videos" ON videos;
CREATE POLICY "Anyone can read active videos" ON videos FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own access" ON chapter_access;
CREATE POLICY "Users can view own access" ON chapter_access FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own watch history" ON watch_history;
CREATE POLICY "Users can view own watch history" ON watch_history FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own notes" ON video_notes;
CREATE POLICY "Users can view own notes" ON video_notes FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own bookmarks" ON video_bookmarks;
CREATE POLICY "Users can view own bookmarks" ON video_bookmarks FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can view own quiz attempts" ON quiz_attempts FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own cycle completions" ON cycle_completions;
CREATE POLICY "Users can view own cycle completions" ON cycle_completions FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own activity" ON activity_logs;
CREATE POLICY "Users can view own activity" ON activity_logs FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can read active live classes" ON live_classes;
CREATE POLICY "Anyone can read active live classes" ON live_classes FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Anyone can read active announcements" ON announcements;
CREATE POLICY "Anyone can read active announcements" ON announcements FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Anyone can read system settings" ON system_settings;
CREATE POLICY "Anyone can read system settings" ON system_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read active quizzes" ON quizzes;
CREATE POLICY "Anyone can read active quizzes" ON quizzes FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Anyone can read quiz questions" ON quiz_questions;
CREATE POLICY "Anyone can read quiz questions" ON quiz_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read questions" ON qa_questions;
CREATE POLICY "Anyone can read questions" ON qa_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own questions" ON qa_questions;
CREATE POLICY "Users can manage own questions" ON qa_questions FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Anyone can read answers" ON qa_answers;
CREATE POLICY "Anyone can read answers" ON qa_answers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own answers" ON qa_answers;
CREATE POLICY "Users can manage own answers" ON qa_answers FOR ALL USING (user_id = auth.uid());
