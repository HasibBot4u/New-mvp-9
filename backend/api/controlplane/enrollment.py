"""Admin Control Plane — Enrollment, Access Codes & Payments (Stage 31)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request

from backend.api.controlplane import enrollment_service as svc
from backend.api.controlplane.deps import record_audit, require_permission

router = APIRouter(prefix="/control-plane/enrollment", tags=["control-plane/enrollment"])


# ── Enrollments (chapter_access) ──────────────────────────────
@router.get("")
async def list_enrollments(
    request: Request,
    status: Optional[str] = Query(None),
    chapter_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    await require_permission(request, "enrollment.read")
    return await svc.list_enrollments(status, chapter_id, user_id, limit, offset)


@router.post("/grant")
async def grant_enrollment(
    request: Request,
    user_id: str = Body(..., embed=True),
    chapter_id: str = Body(..., embed=True),
):
    actor = await require_permission(request, "enrollment.write")
    result = await svc.grant_access(user_id, chapter_id)
    await record_audit(request, actor, "enrollment.grant", "chapter_access",
                       resource_id=f"{user_id}:{chapter_id}", after=result)
    return result


@router.post("/{access_id}/revoke")
async def revoke_enrollment(request: Request, access_id: str):
    actor = await require_permission(request, "enrollment.write")
    result = await svc.revoke_access(access_id)
    await record_audit(request, actor, "enrollment.revoke", "chapter_access",
                       resource_id=access_id, after=result)
    return result


@router.post("/{access_id}/restore")
async def restore_enrollment(request: Request, access_id: str):
    actor = await require_permission(request, "enrollment.write")
    result = await svc.restore_access(access_id)
    await record_audit(request, actor, "enrollment.restore", "chapter_access",
                       resource_id=access_id, after=result)
    return result


# ── Access codes ──────────────────────────────────────────────
@router.get("/codes")
async def list_codes(request: Request, active: Optional[bool] = None, limit: int = 100):
    await require_permission(request, "enrollment.read")
    return await svc.list_codes(active, limit)


@router.post("/codes")
async def create_code(
    request: Request,
    chapter_id: Optional[str] = Body(None, embed=True),
    cycle_id: Optional[str] = Body(None, embed=True),
    max_uses: int = Body(1, embed=True),
    expires_at: Optional[str] = Body(None, embed=True),
    label: Optional[str] = Body(None, embed=True),
):
    actor = await require_permission(request, "enrollment.write")
    result = await svc.create_code(chapter_id, cycle_id, max_uses, expires_at, label, generated_by=actor)
    await record_audit(request, actor, "codes.create", "enrollment_codes",
                       resource_id=result.get("id"), after={"code": result.get("code")})
    return result


@router.post("/codes/{code_id}/activate")
async def activate_code(request: Request, code_id: str):
    actor = await require_permission(request, "enrollment.write")
    result = await svc.set_code_active(code_id, True)
    await record_audit(request, actor, "codes.activate", "enrollment_codes", resource_id=code_id)
    return result


@router.post("/codes/{code_id}/deactivate")
async def deactivate_code(request: Request, code_id: str):
    actor = await require_permission(request, "enrollment.write")
    result = await svc.set_code_active(code_id, False)
    await record_audit(request, actor, "codes.deactivate", "enrollment_codes", resource_id=code_id)
    return result


@router.get("/codes/{code_id}/redemptions")
async def code_redemptions(request: Request, code_id: str):
    await require_permission(request, "enrollment.read")
    return await svc.code_redemptions(code_id)


# ── Manual payments ───────────────────────────────────────────
@router.get("/payments")
async def list_payments(
    request: Request,
    status: str = Query("pending"),
    payment_method: Optional[str] = None,
    limit: int = Query(100, ge=1, le=200),
):
    await require_permission(request, "payments.read")
    return await svc.list_payments(status, payment_method, limit)


@router.post("/payments/{payment_id}/approve")
async def approve_payment(request: Request, payment_id: str):
    actor = await require_permission(request, "payments.write")
    result = await svc.approve_payment(payment_id, actor)
    await record_audit(request, actor, "payments.approve", "pending_enrollments",
                       resource_id=payment_id, after=result)
    return result


@router.post("/payments/{payment_id}/reject")
async def reject_payment(
    request: Request, payment_id: str, reason: Optional[str] = Body(None, embed=True)
):
    actor = await require_permission(request, "payments.write")
    result = await svc.reject_payment(payment_id, actor, reason)
    await record_audit(request, actor, "payments.reject", "pending_enrollments",
                       resource_id=payment_id, after={"status": "rejected"})
    return result
