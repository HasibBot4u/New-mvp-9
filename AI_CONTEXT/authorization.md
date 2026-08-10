# Authorization
Roles: user/admin. Admin detection differs by layer: backend _ensure_admin = profiles.role OR user_roles; dependencies.get_current_admin (bulk ops) = profiles.role only; RLS is_admin() = user_roles. If an admin fails on one surface, check BOTH tables.
Chapter access: backend stream checks chapter_lookup.requires_enrollment → chapter_access row (is_blocked=false) or admin. Fail-CLOSED on lookup miss (refresh once, then deny) — do not revert to fail-open.
Frontend gates (ProtectedRoute, VideoListPage locks) are UX only; server is the authority. Client access-map uses RPC `success` flag (Stage-3 N-4 fix) and localStorage cache.
