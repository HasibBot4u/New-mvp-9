"""
Catalog & media-metadata endpoints:

* GET /api/catalog        — public nested catalog (subjects→cycles→chapters→videos)
* GET /api/refresh        — manual catalog refresh (throttled)
* GET /api/prefetch/{id}  — warm the Telegram message cache for a video
* GET /api/thumbnail/{id} — stream a JPEG thumbnail from Telegram
"""
from __future__ import annotations

import asyncio
import io
import time

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse

from backend.core.rate_limiter import check_rate_limit
import backend.runtime as runtime
from backend.integrations import telegram_client as tg
from backend.services import activity_service
import backend.runtime as _runtime_mod

router = APIRouter()


@router.get("/api/catalog")
async def catalog(request: Request, authorization: str = Header(None)):
    user = await runtime.verify_supabase_token(authorization) if authorization else None
    user_id = (user.get("sub") or user.get("id")) if user else None
    if user_id:
        asyncio.create_task(activity_service.log_activity(user_id, "catalog_view", {}, request))

    from backend.domains import catalog as catalog_domain

    if catalog_domain.is_fresh(300):
        return JSONResponse(
            {"data": _runtime_mod.S.catalog_cache["data"], "status": "ok"},
            headers={"Cache-Control": "public, max-age=60"},
        )

    await runtime.refresh_catalog()
    if _runtime_mod.S.catalog_cache.get("data"):
        return JSONResponse(
            {"data": _runtime_mod.S.catalog_cache["data"], "status": "ok"},
            headers={"Cache-Control": "public, max-age=60"},
        )
    return JSONResponse(
        {"error": "Catalog unavailable", "detail": "No data in cache"}, status_code=503
    )


@router.get("/api/refresh")
async def force_refresh(request: Request):
    await check_rate_limit(request, limit=5, window=60, prefix="refresh")
    now = time.time()
    if now - _runtime_mod.S._last_refresh_time < 60:
        return {"status": "throttled", "retry_after": round(60 - (now - _runtime_mod.S._last_refresh_time))}
    _runtime_mod.S._last_refresh_time = now
    await runtime.refresh_catalog()
    return {"status": "refreshed", "videos": len(_runtime_mod.S.video_map)}


@router.get("/api/prefetch/{video_id}")
async def prefetch_video(video_id: str, request: Request):
    try:
        await check_rate_limit(request, limit=50, window=60, prefix="prefetch")
    except HTTPException:
        return {"status": "rate_limited"}

    if video_id not in _runtime_mod.S.video_map:
        await runtime.refresh_catalog()
        if video_id not in _runtime_mod.S.video_map:
            return {"status": "not_found", "cached": False}

    info = _runtime_mod.S.video_map[video_id]
    cid_str = info.get("channel_id", "")
    message_id = info.get("message_id", 0)
    if not cid_str or not message_id:
        return {"status": "not_linked", "cached": False}

    key = f"{cid_str}_{message_id}"
    if key in _runtime_mod.S.message_cache:
        return {"status": "already_cached", "cached": True}

    try:
        cid = int(cid_str)
        await tg.resolve_channel(cid)
        client = tg.get_active_client()
        if client is None:
            return {"status": "error", "cached": False, "error": "No telegram client"}
        msg = await client.get_messages(cid, message_id)
        if hasattr(msg, "empty") and msg.empty:
            return {"status": "message_empty", "cached": False}
        _runtime_mod.S.message_cache[key] = msg
        media = msg.video or msg.document
        size_mb = round(media.file_size / 1024 / 1024, 1) if media else 0
        return {"status": "cached", "cached": True, "size_mb": size_mb}
    except Exception as exc:
        return {"status": "error", "cached": False, "error": str(exc)}


@router.get("/api/thumbnail/{video_id}")
async def get_thumbnail(
    video_id: str,
    request: Request,
    authorization: str = Header(None),
    token: str = None,
):
    try:
        await check_rate_limit(request, limit=100, window=60, prefix="thumbnail")
    except HTTPException:
        return RedirectResponse("/placeholder-video.jpg")

    if video_id not in _runtime_mod.S.video_map:
        await runtime.refresh_catalog()
        if video_id not in _runtime_mod.S.video_map:
            return RedirectResponse("/placeholder-video.jpg")

    info = _runtime_mod.S.video_map[video_id]
    if info.get("source_type") != "telegram":
        return RedirectResponse("/placeholder-video.jpg")

    cid_str = info.get("channel_id", "")
    message_id = info.get("message_id", 0)
    if not cid_str or not message_id:
        return RedirectResponse("/placeholder-video.jpg")

    try:
        cid = int(cid_str)
        thumb_bytes = await tg.get_thumbnail_bytes(
            cid, int(message_id), int(info.get("thumbnail_message_id", 0) or 0)
        )
        if thumb_bytes is None:
            return RedirectResponse("/placeholder-video.jpg")
        return StreamingResponse(
            io.BytesIO(thumb_bytes.getbuffer()),
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=604800"},
        )
    except Exception as exc:
        import logging

        logging.getLogger("NexusEdu").info("Thumbnail fetch error: %s", exc)
        return RedirectResponse("/placeholder-video.jpg")
