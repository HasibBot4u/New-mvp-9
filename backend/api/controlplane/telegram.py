"""Admin Control Plane — Telegram & Video Storage (Stage 32)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request

from backend.api.controlplane import telegram_service as svc
from backend.api.controlplane.deps import record_audit, require_permission

router = APIRouter(prefix="/control-plane/telegram", tags=["control-plane/telegram"])


@router.get("/status")
async def status(request: Request):
    await require_permission(request, "telegram.read")
    return await svc.telegram_status()


@router.get("/diagnostics")
async def diagnostics(request: Request):
    await require_permission(request, "telegram.read")
    return await svc.run_diagnostics()


@router.get("/webhook")
async def webhook_status(request: Request):
    await require_permission(request, "telegram.read")
    return await svc.webhook_status()


@router.post("/webhook/reinitialize")
async def webhook_reinit(request: Request):
    actor = await require_permission(request, "telegram.write")
    result = await svc.reinitialize_bot()
    await record_audit(request, actor, "telegram.webhook_reinit", "telegram_bot", after=result)
    return result


# ── Video mappings ────────────────────────────────────────────
@router.get("/videos")
async def list_videos(
    request: Request,
    missing: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    await require_permission(request, "videos.read")
    return await svc.list_videos(missing, limit, offset)


@router.get("/videos/{video_id}")
async def get_video(request: Request, video_id: str):
    await require_permission(request, "videos.read")
    return await svc.get_video_mapping(video_id)


@router.get("/videos/{video_id}/verify")
async def verify_video(request: Request, video_id: str):
    await require_permission(request, "videos.read")
    return await svc.verify_mapping(video_id)


@router.put("/videos/{video_id}/mapping")
async def set_video_mapping(
    request: Request,
    video_id: str,
    channel_id: Optional[str] = Body(None, embed=True),
    message_id: Optional[int] = Body(None, embed=True),
    thumbnail_url: Optional[str] = Body(None, embed=True),
):
    actor = await require_permission(request, "videos.write")
    before = await svc.get_video_mapping(video_id)
    result = await svc.set_mapping(video_id, channel_id, message_id, thumbnail_url)
    await record_audit(request, actor, "videos.set_mapping", "videos",
                       resource_id=video_id, before=before, after=result)
    return result


@router.delete("/videos/{video_id}/mapping")
async def clear_video_mapping(request: Request, video_id: str):
    actor = await require_permission(request, "videos.write")
    before = await svc.get_video_mapping(video_id)
    result = await svc.clear_mapping(video_id)
    await record_audit(request, actor, "videos.clear_mapping", "videos",
                       resource_id=video_id, before=before)
    return result


@router.get("/storage/diagnostics")
async def storage_diagnostics(request: Request):
    await require_permission(request, "videos.read")
    return await svc.diagnostics()
