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
CREATE POLICY "Admins have full access" ON upload_queue USING (is_admin());

-- RLS for video_variants
ALTER TABLE video_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read video variants" ON video_variants FOR SELECT USING (true);
CREATE POLICY "Admins have full access" ON video_variants USING (is_admin());
