CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL, -- 'free', 'basic', 'standard', 'premium', 'lifetime'
  status TEXT DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'unpaid'
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  payment_method TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- Also add code_batch to enrollment_codes if it's missing (for analytics)
ALTER TABLE enrollment_codes ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE enrollment_codes ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'chapter'; -- 'chapter', 'subject', 'platform'
ALTER TABLE enrollment_codes ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES profiles(id);
