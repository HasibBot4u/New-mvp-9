-- Database Optimization: Indexes and cleanup

-- 1. Create index on upload_queue(status) to speed up polling
CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON public.upload_queue(status);

-- 2. Create index on videos(subject_id) to speed up catalog queries
CREATE INDEX IF NOT EXISTS idx_videos_subject_id ON public.videos(subject_id);

-- 3. Run Vacuum to reclaim space (Note: VACUUM cannot be run inside a transaction block)
-- Ensure this is run manually if necessary, or handled by Supabase autovacuum
-- VACUUM ANALYZE public.upload_queue;
-- VACUUM ANALYZE public.videos;
