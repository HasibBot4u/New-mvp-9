"""Admin Control Plane HTTP API.

Mounted at /api/control-plane. All endpoints require an authenticated
admin and (where relevant) a granular permission. Settings and flags
changes are audited and versioned. Read-only endpoints for public/
frontend consumption live outside this router.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Request

from backend.api.controlplane import flags as flag_svc
from backend.api.controlplane import settings as setting_svc
from backend.api.controlplane.deps import (
    is_sensitive_setting,
    record_audit,
    require_permission,
)
from backend.integrations import supabase_integration as sb

router = APIRouter(prefix="/control-plane", tags=["control-plane"])


# ── System status / dashboard ─────────────────────────────────────────
@router.get("/status")
async def system_status(request: Request) -> dict[str, Any]:
    user_id = await require_permission(request, "operations.read")
    flags = await flag_svc.get_public_flags()
    settings = await setting_svc.get_public_settings()
    return {
        "status": "operational",
        "maintenance": settings.get("maintenance.enabled", False),
        "active_flags": {k: v for k, v in flags.items() if v},
        "site": settings.get("site.name"),
    }


@router.get("/audit")
async def list_audit(request: Request, limit: int = 50) -> list[dict[str, Any]]:
    await require_permission(request, "audit.read")
    limit = max(1, min(limit, 200))
    return await sb.admin_request(
        "GET", f"admin_audit_events?order=created_at.desc&limit={limit}"
    ) or []


# ── Settings ───────────────────────────────────────────────────────────
@router.get("/settings")
async def list_settings(request: Request) -> dict[str, Any]:
    await require_permission(request, "settings.read")
    values = await setting_svc.get_settings()
    definitions = [
        {
            "key": d.key, "type": d.type, "category": d.category,
            "description": d.description, "sensitive": d.sensitive,
        }
        for d in setting_svc.SETTING_DEFINITIONS.values()
    ]
    # Never send current values of sensitive settings.
    safe_values = {
        k: ("********" if is_sensitive_setting(k) else v)
        for k, v in values.items()
    }
    return {"definitions": definitions, "values": safe_values}


@router.put("/settings/{key}")
async def put_setting(
    request: Request, key: str,
    value: Any = Body(..., embed=True), reason: Optional[str] = Body(None, embed=True),
) -> dict[str, Any]:
    user_id = await require_permission(request, "settings.write")
    if is_sensitive_setting(key):
        raise HTTPException(status_code=403, detail="Sensitive settings cannot be edited via the Control Plane")
    result = await setting_svc.update_setting(key, value, user_id, reason)
    await record_audit(request, user_id, "settings.update", "settings",
                       resource_id=key, after={"value": result["value"]})
    return result


@router.get("/settings/history/{key}")
async def setting_history(request: Request, key: str, limit: int = 20) -> list[dict[str, Any]]:
    await require_permission(request, "audit.read")
    limit = max(1, min(limit, 100))
    return await sb.admin_request(
        "GET",
        f"admin_change_versions?resource=eq.settings&resource_key=eq.{key}"
        f"&order=created_at.desc&limit={limit}",
    ) or []


# ── Feature flags ─────────────────────────────────────────────────────
@router.get("/feature-flags")
async def list_feature_flags(request: Request) -> list[dict[str, Any]]:
    await require_permission(request, "features.read")
    return await flag_svc.list_flags()


@router.put("/feature-flags/{key}")
async def update_feature_flag(
    request: Request, key: str, enabled: bool = Body(..., embed=True)
) -> dict[str, Any]:
    user_id = await require_permission(request, "features.write")
    result = await flag_svc.set_flag(key, enabled, user_id)
    await record_audit(request, user_id, "features.update", "feature_flags",
                       resource_id=key, after={"enabled": enabled})
    return result


# ── Permissions / roles ───────────────────────────────────────────────
@router.get("/permissions")
async def list_permissions(request: Request) -> list[dict[str, Any]]:
    await require_permission(request, "roles.read")
    return await sb.admin_request("GET", "admin_permissions?order=category.asc,key.asc") or []


@router.get("/roles")
async def list_roles(request: Request) -> list[dict[str, Any]]:
    await require_permission(request, "roles.read")
    roles = await sb.admin_request("GET", "admin_roles?order=name.asc") or []
    perms = await sb.admin_request("GET", "admin_role_permissions?select=role_id,permission") or []
    by_role: dict[str, list[str]] = {}
    for p in perms:
        by_role.setdefault(p["role_id"], []).append(p["permission"])
    for r in roles:
        r["permissions"] = by_role.get(r["id"], [])
    return roles


@router.get("/users/roles")
async def list_user_roles(request: Request) -> list[dict[str, Any]]:
    await require_permission(request, "roles.read")
    return await sb.admin_request(
        "GET", "admin_user_roles?select=user_id,role_id,assigned_by,created_at"
    ) or []


@router.post("/users/{user_id}/roles/{role_id}")
async def assign_role(request: Request, user_id: str, role_id: str) -> dict[str, Any]:
    admin_id = await require_permission(request, "roles.write")
    # Prevent removing the last owner assignment (safety check).
    if not _is_uuid(user_id) or not _is_uuid(role_id):
        raise HTTPException(status_code=400, detail="Invalid UUID")
    await sb.admin_request(
        "POST", "admin_user_roles",
        json_data={"user_id": user_id, "role_id": role_id, "assigned_by": admin_id},
        extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    await record_audit(request, admin_id, "roles.assign", "admin_user_roles",
                       resource_id=user_id, after={"role_id": role_id})
    return {"assigned": True}


# ── Pending approval queue (foundation; full workflow in later stages) ─
@router.get("/change-requests")
async def list_change_requests(request: Request, status: str = "pending") -> list[dict[str, Any]]:
    await require_permission(request, "approvals.read")
    if status not in ("pending", "approved", "rejected", "executed", "all"):
        raise HTTPException(400, "invalid status")
    q = "admin_change_requests?order=created_at.desc"
    if status != "all":
        q += f"&status=eq.{status}"
    return await sb.admin_request("GET", q) or []


@router.get("/health")
async def control_plane_health() -> dict[str, str]:
    """Unauthenticated liveness probe for the control plane itself."""
    return {"control_plane": "ok"}


def _is_uuid(v: str) -> bool:
    import re
    return bool(re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", v))
