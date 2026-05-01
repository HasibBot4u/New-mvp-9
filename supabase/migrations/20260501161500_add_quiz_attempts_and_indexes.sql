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

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  answers JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_live_classes_scheduled ON live_classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_codes_code ON enrollment_codes(code);
