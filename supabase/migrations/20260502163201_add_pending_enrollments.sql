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
CREATE POLICY "Users can manage own enrollments" ON pending_enrollments FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins have full access to enrollments" ON pending_enrollments USING (is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_user_id ON pending_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_status ON pending_enrollments(status);
