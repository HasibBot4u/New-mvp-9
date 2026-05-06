-- Add thumbnail_telegram_message_id to videos table
DO $$ 
BEGIN 
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_telegram_message_id BIGINT;
EXCEPTION 
  WHEN OTHERS THEN 
    NULL; 
END $$;
