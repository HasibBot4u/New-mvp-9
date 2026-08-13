"""Admin Control Plane — Streaming & Playback (Stage 33)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request

from backend.api.controlplane import streaming_service as svc
from backend.api.controlplane.deps import record_audit, require_permission

router = APIRouter(prefix="/control-plane/streaming", tags=["control-plane/streaming"])


@router.get("/status")
async def status(request: Request):
    await require_permission(request, "streaming.read")
    return await svc.streaming_status()


@router.get("/videos")
async def videos(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
):
    await require_permission(request, "videos.read")
    return {"videos": await svc.list_videos_diagnostic(status_filter, limit)}


@router.get("/videos/{video_id}/diagnostics")
async def video_diagnostics(request: Request, video_id: str):
    await require_permission(request, "streaming.read")
    return await svc.video_diagnostics(video_id)


@router.get("/settings")
async def get_settings(request: Request):
    await require_permission(request, "streaming.read")
    all_settings = await svc.get_settings()
    keys = ("streaming.max_concurrent_per_user", "streaming.range_max_mb",
            "streaming.ticket_ttl_seconds")
    return {k: all_settings.get(k) for k in keys}


# Hard bounds for streaming settings (validated before any DB access).
_STREAMING_BOUNDS = {
    "streaming.max_concurrent_per_user": (1, 10),
    "streaming.range_max_mb": (1, 200),
    "streaming.ticket_ttl_seconds": (60, 86400),
}

@router.put("/settings/{key:path}")
async def put_setting(
    request: Request, key: str, value: object = Body(..., embed=True)
):
    actor = await require_permission(request, "streaming.write")
    # Validate input and bounds up-front.
    if key not in _STREAMING_BOUNDS:
        raise HTTPException(404, "Unknown streaming setting")
    try:
        ivalue = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise HTTPException(400, "Value must be an integer")
    lo, hi = _STREAMING_BOUNDS[key]
    if not (lo <= ivalue <= hi):
        raise HTTPException(400, f"{key} must be between {lo} and {hi}")
    before = None
    try:
        before = (await svc.get_settings()).get(key)
    except Exception:
        pass
    result = await svc.update_streaming_setting(key, ivalue, actor)
    await record_audit(request, actor, "streaming.setting_update", "admin_settings",
                       resource_id=key, before={"value": before}, after={"value": ivalue})
    return result
