BEGIN;

-- Database Optimization: Indexes and cleanup

-- 1. Create index on upload_queue(status) to speed up polling
CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON public.upload_queue(status);

-- 2. Create index on videos(chapter_id) to speed up catalog queries
CREATE INDEX IF NOT EXISTS idx_videos_chapter_id ON public.videos(chapter_id);

COMMIT;
