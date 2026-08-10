# Business logic (verified)
Content tree: subjects → cycles → chapters → videos (display_order everywhere, is_active soft-toggle).
Paywall: chapters.requires_enrollment. Two unlock routes:
1) Enrollment codes (6-6 hex, `generate_secure_hex(3)-...`; SQL variant same shape; quick codes `NEXUS-XXXXXX`). Redemption RPC `use_chapter_enrollment_code` is cycle-aware and atomic (Stage-3): chapter codes match exactly, cycle codes accept any chapter in the cycle; `uses_count < max_uses` enforced in the UPDATE; device fingerprint stored (spoofable deterrent, not security).
2) Manual payment: student pays bKash/Nagad externally → POSTs trxID to `pending_enrollments` → admin Approves in Admin→Enrollment (backend `/api/admin/enrollments/{id}/approve` grants chapter_access + notification) — loop closed in Stage 2.
Progress: batch upsert every 10s (+flush on hide/unload); completed at ≥95%; progress capped at duration (server clamps >1.5×duration); unknown videos dropped when catalog loaded.
Streaming rules: JWT or 6h HMAC stream ticket (user+video bound, signed by JWT_SECRET→ADMIN_TOKEN→ephemeral); max 3 concurrent streams/user (in-process); 50MB per range; blocked users denied (60s cache).
Admin: role 'admin' in profiles.role and/or user_roles (backend accepts either; RLS is_admin() uses user_roles). maintenance_mode gates frontend only (residual).
