CREATE TABLE IF NOT EXISTS videos_temp (id uuid); -- Just in case
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
