"""
Progress + activity endpoints (student telemetry).

* POST /api/progress/batch — upsert watch progress (one or many videos)
* POST /api/activity       — append a generic activity log entry

Both require a valid Supabase JWT and are rate-limited per user/IP.
"""
from __future__ import annotations

import math
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field, constr

from backend.core.rate_limiter import check_rate_limit
import backend.runtime as runtime
from backend.integrations import supabase_integration as sb
from backend.services import activity_service
import backend.runtime as _runtime_mod

router = APIRouter()


class ActivityLogReq(BaseModel):
    action: constr(min_length=1, max_length=50)
    details: dict = Field(default_factory=dict)

    def model_post_init(self, __context):
        import json as _json

        if len(_json.dumps(self.details)) > 2048:
            raise ValueError("details too large (max 2KB)")


@router.post("/api/activity")
async def log_activity(req: ActivityLogReq, request: Request, authorization: str = Header(None)):
    user = await runtime.verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_id = user.get("sub") or user.get("id")
    await check_rate_limit(request, limit=100, window=60, prefix=f"activity_{user_id}")

    import asyncio

    asyncio.create_task(activity_service.log_activity(user_id, req.action, req.details, request))
    return {"status": "ok"}


class ProgressUpdateItem(BaseModel):
    video_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    progress: float = Field(..., ge=0, le=86400)
    duration: float = Field(..., ge=0, le=86400)


class ProgressBatchReq(BaseModel):
    updates: list[ProgressUpdateItem] = Field(..., min_length=1, max_length=100)


@router.post("/api/progress/batch")
async def batch_progress(
    req: ProgressBatchReq, request: Request, authorization: str = Header(None)
):
    user = await runtime.verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")
    user_id = user.get("sub") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not sb.secrets_manager.get_secret("supabase_url") or not sb.secrets_manager.get_secret(
        "supabase_service_key"
    ):
        return {"status": "error", "message": "Database not configured"}

    upsert_data = []
    now_str = datetime.utcnow().isoformat() + "Z"
    for up in req.updates:
        if up.duration > 0 and up.progress > up.duration * 1.5:
            up_progress = min(up.progress, up.duration)
        else:
            up_progress = up.progress

        if _runtime_mod.S.video_map and up.video_id not in _runtime_mod.S.video_map:
            import logging

            logging.getLogger("NexusEdu").warning(
                "[Progress] unknown video_id %s from user %s, skipping", up.video_id, user_id
            )
            continue

        completed = up.duration > 0 and (up_progress / up.duration) >= 0.95
        progress_percent = round((up_progress / up.duration) * 100) if up.duration > 0 else 0
        progress_percent = min(100, max(0, progress_percent))

        upsert_data.append(
            {
                "user_id": user_id,
                "video_id": up.video_id,
                "progress_seconds": math.floor(up_progress),
                "progress_percent": progress_percent,
                "completed": completed,
                "watched_at": now_str,
                "updated_at": now_str,
            }
        )

    if not upsert_data:
        return {"status": "ok", "message": "no valid updates"}

    try:
        await sb.admin_request(
            "POST",
            "watch_history",
            json_data=upsert_data,
            timeout=10.0,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        import logging

        logging.getLogger("NexusEdu").error("Failed to batch save progress: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save progress")

    return {"status": "ok", "saved": len(req.updates)}
