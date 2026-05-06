-- Create audit_logs table
DROP FUNCTION IF EXISTS admin_generate_chapter_code(UUID, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS delete_user_account(UUID, TEXT) CASCADE;

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    ip_address TEXT,
    status_code INT,
    duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Secure dynamic policy generation
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Admins have full access" ON public.%I USING (is_admin());', t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Secure admin chapter code generation
CREATE OR REPLACE FUNCTION admin_generate_chapter_code(p_chapter_id UUID, p_notes TEXT, p_label TEXT, p_max_uses INT)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    -- Use secure random bytes instead of md5(random())
    v_code := upper(substring(encode(gen_random_bytes(16), 'hex') from 1 for 6)) || '-' || upper(substring(encode(gen_random_bytes(16), 'hex') from 7 for 6));
    
    INSERT INTO enrollment_codes (chapter_id, code, max_uses, notes, label, generated_by, created_by)
    VALUES (p_chapter_id, v_code, p_max_uses, p_notes, p_label, auth.uid(), auth.uid());
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure user account deletion with confirmation
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID, confirmation_text TEXT)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    IF confirmation_text != ('DELETE-' || target_user_id::text) THEN 
        RAISE EXCEPTION 'Invalid confirmation text';
    END IF;
    
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
