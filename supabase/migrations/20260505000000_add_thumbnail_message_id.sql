BEGIN;

-- Add thumbnail_telegram_message_id to videos table safely
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'videos' 
    AND column_name = 'thumbnail_telegram_message_id'
  ) THEN
    ALTER TABLE videos ADD COLUMN thumbnail_telegram_message_id BIGINT;
  END IF;
END $$;

COMMIT;
