BEGIN;

-- Drop insecure SECURITY DEFINER RPC function that allowed bypassing RLS via caller-supplied user_id.
-- Clients should query the quiz_attempts table directly via PostgREST, where RLS policies
-- ("Users can view own quiz attempts" using auth.uid()) are automatically enforced.
DROP FUNCTION IF EXISTS public.get_user_quiz_attempts(UUID);
DROP FUNCTION IF EXISTS public.get_user_quiz_attempts();

COMMIT;
