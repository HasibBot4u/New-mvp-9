BEGIN;

-- Re-create is_admin() function securely with SET search_path = public
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'::app_role
    );
END;
$$;

-- Re-apply "Admins have full access" policy dynamically across all public tables
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
        EXECUTE format('CREATE POLICY "Admins have full access" ON public.%I USING (public.is_admin());', t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;
