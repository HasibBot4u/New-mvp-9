"""Admin Control Plane — Operations & System (Stage 34)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Request

from backend.api.controlplane import operations as ops
from backend.api.controlplane.deps import record_audit, require_permission

router = APIRouter(prefix="/control-plane/operations", tags=["control-plane/operations"])


@router.get("/status")
async def status(request: Request):
    """Lightweight status without external calls (safe for polling)."""
    await require_permission(request, "operations.read")
    return {
        "backend": await ops.backend_component(),
        "configuration": ops.configuration_component(),
        "overall": "operational",
        "checked_at": __import__("time").time(),
    }


@router.get("/diagnostics")
async def diagnostics(request: Request):
    """Full bounded diagnostic report across all components."""
    await require_permission(request, "operations.read")
    return await ops.full_diagnostics()


@router.get("/configuration")
async def configuration(request: Request):
    await require_permission(request, "operations.read")
    return ops.configuration_component()


@router.get("/deployment")
async def deployment(request: Request):
    await require_permission(request, "operations.read")
    return ops.deployment_component()


@router.get("/backups")
async def backups(request: Request):
    await require_permission(request, "operations.read")
    return ops.backups_component()


@router.get("/monitoring")
async def monitoring(request: Request):
    await require_permission(request, "operations.read")
    return ops.monitoring_component()


@router.post("/maintenance")
async def set_maintenance(
    request: Request, enabled: bool = Body(..., embed=True)
):
    actor = await require_permission(request, "system.maintenance")
    before = await ops.get_maintenance()
    result = await ops.set_maintenance(enabled, actor)
    await record_audit(request, actor, "operations.maintenance", "admin_settings",
                       before={"enabled": before}, after={"enabled": enabled})
    return result


@router.post("/telegram/reinitialize")
async def reinit_telegram(request: Request):
    actor = await require_permission(request, "operations.write")
    result = await ops.reinitialize_bot()
    await record_audit(request, actor, "operations.telegram_reinit", "telegram_bot",
                       after={"reinitialized": result.get("reinitialized")})
    return result
