-- ═══════════════════════════════════════════════════════════════════════
-- Stage 28: Admin Control Plane — foundation tables.
--
-- Additive only. Does not modify existing tables or policies (the
-- profiles.role admin gate remains; granular permissions are layered on
-- top via these tables). All new tables are RLS-protected with NO public
-- access; the service role (backend) manages them, and an
-- is_control_plane_admin() helper enforces granular permissions.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Granular permissions catalogue ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_permissions (
    key          TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT,
    category     TEXT NOT NULL DEFAULT 'general',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Roles (owner / admin / custom) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_roles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key          TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    description  TEXT,
    is_system    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
    role_id      UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
    permission   TEXT NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission)
);

-- ── 3. User ↔ role assignment ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_user_roles (
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id      UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
    assigned_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role ON public.admin_user_roles(role_id);

-- ── 4. Settings (typed, versioned, non-secret configuration) ───────────
CREATE TABLE IF NOT EXISTS public.admin_settings (
    key          TEXT PRIMARY KEY,
    value        JSONB NOT NULL,
    type         TEXT NOT NULL DEFAULT 'string',
    category     TEXT NOT NULL DEFAULT 'general',
    description  TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    is_editable  BOOLEAN NOT NULL DEFAULT TRUE,
    version      INTEGER NOT NULL DEFAULT 1,
    updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON public.admin_settings(category);

-- ── 5. Feature flags (typed, environment-scoped) ───────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
    key          TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT,
    category     TEXT NOT NULL DEFAULT 'general',
    enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    default_state BOOLEAN NOT NULL DEFAULT FALSE,
    env_scope    TEXT NOT NULL DEFAULT 'all',  -- all | production | staging
    updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. Settings/flag version history (immutable) ──────────────────────
CREATE TABLE IF NOT EXISTS public.admin_change_versions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource     TEXT NOT NULL,           -- 'settings' | 'feature_flags'
    resource_key TEXT NOT NULL,
    old_value    JSONB,
    new_value    JSONB,
    reason       TEXT,
    changed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_change_versions_lookup
    ON public.admin_change_versions(resource, resource_key, created_at DESC);

-- ── 7. Approval requests for dangerous changes ────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_change_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT,
    proposed_change JSONB NOT NULL,
    reason          TEXT,
    requester_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
                    -- pending | approved | rejected | executed | failed | rolled_back | cancelled
    approver_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    rejected_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    executed_at     TIMESTAMPTZ,
    execution_result JSONB,
    rollback_ref    UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cr_status CHECK (status IN
        ('pending','approved','rejected','executed','failed','rolled_back','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_admin_change_requests_status
    ON public.admin_change_requests(status, created_at DESC);

-- ── 8. Immutable audit events for Control Plane actions ───────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action        TEXT NOT NULL,
    resource      TEXT NOT NULL,
    resource_id   TEXT,
    before_state  JSONB,
    after_state   JSONB,
    result        TEXT NOT NULL DEFAULT 'success',
    request_id    TEXT,
    ip_address    INET,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON public.admin_audit_events(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_events(created_at DESC);

-- ── Helper: is the current user a control-plane admin (has any role) ──
CREATE OR REPLACE FUNCTION public.is_control_plane_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_user_roles ur
    WHERE ur.user_id = auth.uid()
  ) OR public.is_admin();
$$;

-- ── Helper: does the current user hold a specific permission? ─────────
CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super-admin (profiles.role='admin') bypass so the owner always has access.
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_user_roles ur
    JOIN public.admin_role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid() AND rp.permission = p_permission
  );
END;
$$;

-- ── Seed permissions catalogue ────────────────────────────────────────
INSERT INTO public.admin_permissions (key, name, category) VALUES
  ('settings.read','View settings','settings'),
  ('settings.write','Edit settings','settings'),
  ('features.read','View feature flags','features'),
  ('features.write','Edit feature flags','features'),
  ('users.read','View users','users'),
  ('users.write','Edit users','users'),
  ('roles.read','View roles','roles'),
  ('roles.write','Edit roles/assignments','roles'),
  ('content.read','View content','content'),
  ('content.write','Edit content','content'),
  ('videos.read','View videos','videos'),
  ('videos.write','Edit videos','videos'),
  ('enrollment.read','View enrollment','enrollment'),
  ('enrollment.write','Edit enrollment','enrollment'),
  ('payments.read','View payments','payments'),
  ('payments.write','Edit payments','payments'),
  ('telegram.read','View Telegram config','telegram'),
  ('telegram.write','Edit Telegram config','telegram'),
  ('streaming.read','View streaming config','streaming'),
  ('streaming.write','Edit streaming config','streaming'),
  ('operations.read','View operations','operations'),
  ('operations.write','Run operations','operations'),
  ('security.read','View security','security'),
  ('security.write','Edit security policy','security'),
  ('audit.read','View audit trail','audit'),
  ('approvals.read','View approvals','approvals'),
  ('approvals.approve','Approve changes','approvals'),
  ('system.maintenance','Toggle maintenance mode','system')
ON CONFLICT (key) DO NOTHING;

-- ── Seed the immutable 'owner' role with all permissions ───────────────
INSERT INTO public.admin_roles (key, name, description, is_system)
VALUES ('owner','Owner','Full system ownership. Cannot be deleted.', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission)
SELECT r.id, p.key FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.key = 'owner'
ON CONFLICT DO NOTHING;

-- ── RLS: enable on every new table, no public policies ────────────────
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_change_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

-- Admins may read permission/role catalogue; writes go through the
-- backend service role (no direct anon/authenticated table writes).
CREATE POLICY "admins read permissions" ON public.admin_permissions
    FOR SELECT USING (public.is_control_plane_admin());
CREATE POLICY "admins read roles" ON public.admin_roles
    FOR SELECT USING (public.is_control_plane_admin());
CREATE POLICY "admins read role perms" ON public.admin_role_permissions
    FOR SELECT USING (public.is_control_plane_admin());
CREATE POLICY "admins read user roles" ON public.admin_user_roles
    FOR SELECT USING (public.is_control_plane_admin());

-- Settings/flags are readable by admins for the UI; the backend applies
-- them for anonymous/normal users via service-role reads.
CREATE POLICY "admins read settings" ON public.admin_settings
    FOR SELECT USING (public.is_control_plane_admin());
CREATE POLICY "admins read flags" ON public.feature_flags
    FOR SELECT USING (public.is_control_plane_admin());
CREATE POLICY "admins read versions" ON public.admin_change_versions
    FOR SELECT USING (public.has_admin_permission('audit.read'));
CREATE POLICY "admins read change requests" ON public.admin_change_requests
    FOR SELECT USING (public.is_control_plane_admin());
CREATE POLICY "admins read audit" ON public.admin_audit_events
    FOR SELECT USING (public.has_admin_permission('audit.read'));

-- Audit events are insert-only via the backend; no UPDATE/DELETE policies.
-- (RLS default-deny ensures they cannot be modified from the client.)

COMMIT;
