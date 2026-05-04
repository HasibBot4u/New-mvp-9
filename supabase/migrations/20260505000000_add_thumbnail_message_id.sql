-- Add thumbnail_telegram_message_id to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_telegram_message_id BIGINT;
