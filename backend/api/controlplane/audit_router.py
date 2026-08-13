"""Admin Control Plane — Audit explorer & settings history/rollback (Stage 35)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request

from backend.api.controlplane import settings as settings_svc
from backend.api.controlplane.deps import record_audit, require_permission
from backend.integrations import supabase_integration as sb

router = APIRouter(prefix="/control-plane", tags=["control-plane/audit"])


# ── Audit events ────────────────────────────────────────────────
@router.get("/audit")
async def list_audit(
    request: Request,
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    await require_permission(request, "audit.read")
    q = f"admin_audit_events?order=created_at.desc&limit={limit}&offset={offset}"
    if action:
        q += f"&action=eq.{action}"
    if resource:
        q += f"&resource=eq.{resource}"
    if actor:
        q += f"&actor_id=eq.{actor}"
    if result:
        q += f"&result=eq.{result}"
    return await sb.admin_request("GET", q) or []


@router.get("/audit/export")
async def export_audit(request: Request, limit: int = Query(500, ge=1, le=2000)):
    """Read-only JSON export (no mutation, no secrets by schema)."""
    await require_permission(request, "audit.read")
    rows = await sb.admin_request(
        "GET", f"admin_audit_events?order=created_at.desc&limit={limit}"
    )
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=rows or [],
        headers={"Content-Disposition": "attachment; filename=audit.json"},
    )


# ── Settings history & rollback ─────────────────────────────────
@router.get("/settings/history")
async def settings_history(request: Request, key: Optional[str] = Query(None), limit: int = Query(100, ge=1, le=500)):
    await require_permission(request, "audit.read")
    q = f"admin_change_versions?order=created_at.desc&limit={limit}"
    if key:
        q += f"&resource_key=eq.{key}"
    return await sb.admin_request("GET", q) or []


@router.post("/settings/rollback")
async def rollback_setting(
    request: Request,
    version_id: str = Body(..., embed=True),
):
    actor = await require_permission(request, "settings.write")
    # Locate the immutable version to restore.
    import re as _re
    if not _re.match(
        r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        version_id,
    ):
        raise HTTPException(400, "Invalid version id")
    rows = await sb.admin_request("GET", f"admin_change_versions?id=eq.{version_id}")
    if not rows:
        raise HTTPException(404, "Version not found")
    version = rows[0]
    key = version.get("resource_key")
    if version.get("resource") != "settings" or not key:
        raise HTTPException(400, "Version is not a settings record")
    # Sensitive settings may never be read back or restored.
    if settings_svc.is_sensitive_setting(key):
        raise HTTPException(403, "Cannot roll back a sensitive setting")
    old_value = version.get("old_value")
    # Restore by writing the previous value as a NEW version (history stays immutable).
    result = await settings_svc.update_setting(
        key, old_value, actor, reason=f"Rollback to version {version_id[:8]}"
    )
    await record_audit(request, actor, "settings.rollback", "admin_settings",
                       resource_id=key, after={"restored_from": version_id})
    return result


