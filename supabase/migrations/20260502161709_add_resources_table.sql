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
