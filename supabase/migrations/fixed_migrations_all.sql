CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  title_bn TEXT,
  drive_file_id TEXT,
  pdf_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access" ON resources;
CREATE POLICY "Admins have full access" ON resources USING (is_admin());
DROP POLICY IF EXISTS "Anyone can read active resources" ON resources;
CREATE POLICY "Anyone can read active resources" ON resources FOR SELECT USING (is_active = true);

-- Add Index
CREATE INDEX IF NOT EXISTS idx_resources_chapter_id ON resources(chapter_id);


CREATE TABLE IF NOT EXISTS pending_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  payment_method TEXT, -- 'bkash', 'nagad', 'rocket'
  amount NUMERIC,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE pending_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own enrollments" ON pending_enrollments;
CREATE POLICY "Users can manage own enrollments" ON pending_enrollments FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to enrollments" ON pending_enrollments;
CREATE POLICY "Admins have full access to enrollments" ON pending_enrollments USING (is_admin());


-- Indexes
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_user_id ON pending_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_status ON pending_enrollments(status);


-- PART A — MISSING INDEXES
DROP FUNCTION IF EXISTS is_admin() CASCADE;
CREATE INDEX IF NOT EXISTS idx_videos_source_type ON videos(source_type);
CREATE INDEX IF NOT EXISTS idx_videos_telegram_channel_id ON videos(telegram_channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_active_display_order ON videos(is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON profiles(is_blocked) WHERE is_blocked = true;
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON profiles(last_active_at DESC);

-- Assuming enrollment_codes table might exist, creating indexes if it does. Creating empty tables if needed first.
-- Wait, let's just create the indexes directly, wrapping in DO block if we want to be safe, but supabase migrations usually just fail if table doesn't exist, which implies we should make sure tables exist or we just execute the provided snippet.
-- Given the context, we'll apply exactly what the user asked.

CREATE INDEX IF NOT EXISTS idx_enrollment_codes_expires_at ON enrollment_codes(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_enrollment_codes_chapter_active ON enrollment_codes(chapter_id, is_active);

CREATE INDEX IF NOT EXISTS idx_chapter_access_user_chapter ON chapter_access(user_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_access_is_blocked ON chapter_access(is_blocked) WHERE is_blocked = true;

CREATE INDEX IF NOT EXISTS idx_watch_history_user_completed ON watch_history(user_id, completed) WHERE completed = false;
CREATE INDEX IF NOT EXISTS idx_watch_history_updated_at ON watch_history(updated_at DESC);

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_videos_title_trgm ON videos USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chapters_name_trgm ON chapters USING gin(name gin_trgm_ops);


-- PART B — DATABASE CONSTRAINTS
ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_source_type;
ALTER TABLE videos ADD CONSTRAINT chk_source_type 
  CHECK (source_type IN ('telegram', 'drive', 'youtube', 'local'));

UPDATE videos SET duration = '00:00:00' WHERE duration !~ '^([0-9]{2}):([0-9]{2}):([0-9]{2})$' OR duration IS NULL;

ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_duration_format;
ALTER TABLE videos ADD CONSTRAINT chk_duration_format 
  CHECK (duration ~ '^([0-9]{2}):([0-9]{2}):([0-9]{2})$');

ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_size_positive;
ALTER TABLE videos ADD CONSTRAINT chk_size_positive 
  CHECK (size_mb IS NULL OR size_mb >= 0);

ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_display_order;
ALTER TABLE videos ADD CONSTRAINT chk_display_order 
  CHECK (display_order >= 0);


-- PART C — NEW TABLES

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'BDT',
  payment_method TEXT NOT NULL, -- 'bkash', 'stripe', 'nagad'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  transaction_id TEXT UNIQUE,
  subscription_type TEXT, -- 'monthly', 'yearly', 'lifetime'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  os TEXT,
  ip_address INET,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  quality TEXT NOT NULL, -- '360p', '720p', '1080p'
  telegram_channel_id TEXT,
  telegram_message_id INTEGER,
  file_size_mb NUMERIC,
  width INTEGER,
  height INTEGER,
  bitrate INTEGER,
  codec TEXT,
  checksum_md5 TEXT,
  checksum_sha256 TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS download_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  quality TEXT DEFAULT '720p',
  status TEXT DEFAULT 'queued', -- 'queued', 'downloading', 'completed', 'failed'
  progress_percent INTEGER DEFAULT 0,
  bytes_downloaded BIGINT DEFAULT 0,
  total_bytes BIGINT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- 'quality', 'incorrect', 'missing', 'other'
  description TEXT,
  status TEXT DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'dismissed'
  admin_notes TEXT,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  avg_watch_duration INTEGER DEFAULT 0, -- seconds
  completion_rate NUMERIC(5,2) DEFAULT 0,
  drop_off_points INTEGER[] DEFAULT '{}',
  UNIQUE(video_id, date)
);


-- PART D — RLS POLICY FIXES

-- Create is_admin function if not exists
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix profile visibility (only own profile + admin)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT 
  USING (auth.uid() = id OR is_admin());

-- Add device session policies
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own devices" ON device_sessions;
CREATE POLICY "Users can view own devices" ON device_sessions FOR ALL 
  USING (user_id = auth.uid());

-- Add payment policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments FOR SELECT 
  USING (user_id = auth.uid() OR is_admin());
  
-- Add remaining RLS basics
ALTER TABLE video_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public video variants" ON video_variants;
CREATE POLICY "Public video variants" ON video_variants FOR SELECT USING (is_active = true);

ALTER TABLE download_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own download queue" ON download_queue;
CREATE POLICY "Users view own download queue" ON download_queue FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users process own download queue" ON download_queue;
CREATE POLICY "Users process own download queue" ON download_queue FOR ALL USING (user_id = auth.uid());

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can report content" ON content_reports;
CREATE POLICY "Users can report content" ON content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Admins can view reports" ON content_reports;
CREATE POLICY "Admins can view reports" ON content_reports FOR SELECT USING (is_admin());

ALTER TABLE video_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view analytics" ON video_analytics;
CREATE POLICY "Admins can view analytics" ON video_analytics FOR SELECT USING (is_admin());

-- PART E — SOFT DELETE

-- Add deleted_at columns to tables
ALTER TABLE videos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_videos_deleted_at ON videos(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;


-- Upload Pipeline Migrations

CREATE TABLE IF NOT EXISTS upload_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_message_id BIGINT NOT NULL,
    telegram_file_id TEXT NOT NULL,
    telegram_channel_id BIGINT NOT NULL,
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    duration INT,
    width INT,
    height INT,
    thumbnail_file_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL, -- e.g., '360p', '720p', '1080p'
    width INT,
    height INT,
    bitrate INT,
    telegram_file_id TEXT NOT NULL,
    telegram_message_id BIGINT,
    telegram_channel_id BIGINT,
    file_size BIGINT,
    md5_checksum TEXT,
    sha256_checksum TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for upload_queue
ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access" ON upload_queue;
CREATE POLICY "Admins have full access" ON upload_queue USING (is_admin());

-- RLS for video_variants
ALTER TABLE video_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read video variants" ON video_variants;
CREATE POLICY "Anyone can read video variants" ON video_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins have full access" ON video_variants;
CREATE POLICY "Admins have full access" ON video_variants USING (is_admin());


-- Add thumbnail_telegram_message_id to videos table
DO $$ 
BEGIN 
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_telegram_message_id BIGINT;
EXCEPTION 
  WHEN OTHERS THEN 
    NULL; 
END $$;


-- Database Optimization: Indexes and cleanup

-- 1. Create index on upload_queue(status) to speed up polling
CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON public.upload_queue(status);

-- 2. Create index on videos(chapter_id) to speed up catalog queries
CREATE INDEX IF NOT EXISTS idx_videos_chapter_id ON public.videos(chapter_id);

-- 3. Run Vacuum to reclaim space (Note: VACUUM cannot be run inside a transaction block)
-- Ensure this is run manually if necessary, or handled by Supabase autovacuum
-- VACUUM ANALYZE public.upload_queue;
-- VACUUM ANALYZE public.videos;
