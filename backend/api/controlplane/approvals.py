"""Admin Control Plane — Approval workflow (Stage 35)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request

from backend.api.controlplane import approvals_service as svc
from backend.api.controlplane.deps import record_audit, require_permission

router = APIRouter(prefix="/control-plane/approvals", tags=["control-plane/approvals"])


@router.get("")
async def list_requests(
    request: Request,
    status: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    requester: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    await require_permission(request, "approvals.read")
    return await svc.list_requests(status, action, requester, limit)


@router.get("/{crid}")
async def get_request(request: Request, crid: str):
    await require_permission(request, "approvals.read")
    return await svc.get_request(crid)


@router.post("")
async def create_request(
    request: Request,
    action: str = Body(...),
    resource_type: str = Body(...),
    proposed_change: dict = Body(...),
    reason: Optional[str] = Body(None),
    target_id: Optional[str] = Body(None),
):
    actor = await require_permission(request, "approvals.read")
    result = await svc.create_request(actor, action, resource_type, proposed_change, reason, target_id)
    await record_audit(request, actor, "approvals.create", "admin_change_requests",
                       resource_id=result.get("id"), after={"action": action})
    return result


@router.post("/{crid}/approve")
async def approve(request: Request, crid: str):
    actor = await require_permission(request, "approvals.approve")
    result = await svc.approve(crid, actor)
    await record_audit(request, actor, "approvals.approve", "admin_change_requests", resource_id=crid)
    return result


@router.post("/{crid}/reject")
async def reject(request: Request, crid: str, reason: Optional[str] = Body(None, embed=True)):
    actor = await require_permission(request, "approvals.approve")
    result = await svc.reject(crid, actor, reason)
    await record_audit(request, actor, "approvals.reject", "admin_change_requests", resource_id=crid)
    return result


@router.post("/{crid}/cancel")
async def cancel(request: Request, crid: str):
    actor = await require_permission(request, "approvals.read")
    result = await svc.cancel(crid, actor)
    await record_audit(request, actor, "approvals.cancel", "admin_change_requests", resource_id=crid)
    return result


@router.post("/{crid}/execute")
async def execute(request: Request, crid: str):
    actor = await require_permission(request, "approvals.approve")
    result = await svc.execute(crid, actor)
    await record_audit(request, actor, "approvals.execute", "admin_change_requests",
                       resource_id=crid, after=result)
    return result
