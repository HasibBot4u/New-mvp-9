DROP TABLE IF EXISTS quiz_attempts CASCADE;

-- Create the quiz_attempts table securely
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL,
    score INT NOT NULL CHECK (score >= 0 AND score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);

-- Secure function to get user quiz attempts
CREATE OR REPLACE FUNCTION get_user_quiz_attempts(p_user_id UUID)
RETURNS SETOF quiz_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM quiz_attempts
    WHERE user_id = p_user_id;
END;
$$;
