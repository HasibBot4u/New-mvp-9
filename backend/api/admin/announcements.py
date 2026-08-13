"""Admin announcement endpoints."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, constr

from backend.api.admin._deps import ensure_admin
from backend.core.rate_limiter import check_rate_limit
from backend.integrations import supabase_integration as sb

router = APIRouter()


class AnnouncementReq(BaseModel):
    message: constr(min_length=1, max_length=2000)
    target: str = "all"  # "all" | "active_7d" | "active_30d"
    priority: str = "normal"  # "normal" | "high" | "urgent"


@router.post("/announcements")
async def create_announcement(req: AnnouncementReq, request: Request):
    await check_rate_limit(request, limit=10, window=60, prefix="admin_announcement")
    user = await ensure_admin(request)
    try:
        await sb.admin_request(
            "POST",
            "announcements",
            json_data={
                "message": req.message,
                "target": req.target,
                "priority": req.priority,
                "created_by": user,
                "sent_at": datetime.utcnow().isoformat() + "Z",
            },
        )
        return {"status": "sent", "message": req.message}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.get("/announcements")
async def list_announcements(request: Request, limit: int = 50):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_announcement")
    await ensure_admin(request)
    data = await sb.admin_request(
        "GET", f"announcements?order=sent_at.desc&limit={limit}"
    )
    return JSONResponse(data)
