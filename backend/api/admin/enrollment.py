"""
Admin enrollment-review endpoints.

Students submit manual payments into ``pending_enrollments``; admins
approve (granting idempotent ``chapter_access`` + an in-app notification)
or reject.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from backend.api.admin._deps import ensure_admin, validate_entity_id
from backend.core.rate_limiter import check_rate_limit
from backend.domains import catalog as catalog_domain
from backend.integrations import supabase_integration as sb

router = APIRouter()


@router.get("/enrollments/pending")
async def list_pending_enrollments(
    request: Request, status_filter: str = "pending", limit: int = 50
):
    await ensure_admin(request)
    limit = max(1, min(int(limit), 200))
    if status_filter not in ("pending", "approved", "rejected", "all"):
        raise HTTPException(status_code=400, detail="Invalid status filter")
    query = (
        "pending_enrollments?select=id,user_id,chapter_id,transaction_id,payment_method,"
        "amount,status,admin_notes,created_at,profiles(display_name,email),"
        "chapters(name,name_bn)&order=created_at.desc&limit=" + str(limit)
    )
    if status_filter != "all":
        query += f"&status=eq.{status_filter}"
    return await sb.admin_request("GET", query)


@router.post("/enrollments/{enrollment_id}/approve")
async def approve_enrollment(enrollment_id: str, request: Request):
    admin_user = await ensure_admin(request)
    validate_entity_id(enrollment_id)
    await check_rate_limit(request, limit=30, window=60, prefix="admin_enrollment")

    rows = await sb.admin_request("GET", f"pending_enrollments?id=eq.{enrollment_id}&limit=1")
    if not rows:
        raise HTTPException(status_code=404, detail="Enrollment request not found")
    item = rows[0]
    if item.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Request already {item.get('status')}")
    user_id, chapter_id = item.get("user_id"), item.get("chapter_id")
    if not user_id or not chapter_id:
        raise HTTPException(status_code=400, detail="Enrollment request missing user or chapter")

    # Grant access (idempotent: UNIQUE(user_id, chapter_id) may already exist)
    try:
        await sb.admin_request(
            "POST", "chapter_access", json_data={"user_id": user_id, "chapter_id": chapter_id}
        )
    except HTTPException as exc:
        detail = str(getattr(exc, "detail", "")).lower()
        if exc.status_code != 409 and "duplicate" not in detail:
            raise

    await sb.admin_request(
        "PATCH",
        f"pending_enrollments?id=eq.{enrollment_id}",
        json_data={
            "status": "approved",
            "reviewed_by": admin_user,
            "reviewed_at": datetime.utcnow().isoformat() + "Z",
        },
    )

    # Best-effort in-app notification.
    try:
        await sb.admin_request(
            "POST",
            "notifications",
            json_data={
                "user_id": user_id,
                "type": "enrollment_approved",
                "title": "Enrollment approved",
                "title_bn": "এনরোলমেন্ট অনুমোদিত হয়েছে ✅",
                "body": "Your chapter enrollment has been approved. You can now watch the videos.",
                "body_bn": "আপনার এনরোলমেন্ট অনুমোদিত হয়েছে। এখন ভিডিওগুলো দেখতে পারবেন।",
                "action_url": "/dashboard",
            },
        )
    except Exception as exc:
        import logging

        logging.getLogger("NexusEdu").warning("[Enrollment] notification failed: %s", exc)

    import asyncio

    asyncio.create_task(catalog_domain.refresh_catalog())
    return {"status": "approved", "user_id": user_id, "chapter_id": chapter_id}


@router.post("/enrollments/{enrollment_id}/reject")
async def reject_enrollment(enrollment_id: str, request: Request):
    admin_user = await ensure_admin(request)
    validate_entity_id(enrollment_id)
    await check_rate_limit(request, limit=30, window=60, prefix="admin_enrollment")

    rows = await sb.admin_request("GET", f"pending_enrollments?id=eq.{enrollment_id}&limit=1")
    if not rows:
        raise HTTPException(status_code=404, detail="Enrollment request not found")
    if rows[0].get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Request already {rows[0].get('status')}")

    await sb.admin_request(
        "PATCH",
        f"pending_enrollments?id=eq.{enrollment_id}",
        json_data={
            "status": "rejected",
            "reviewed_by": admin_user,
            "reviewed_at": datetime.utcnow().isoformat() + "Z",
        },
    )
    return {"status": "rejected"}
