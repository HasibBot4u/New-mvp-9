"""
Video streaming endpoints.

* GET /api/stream-ticket/{id} — exchange a JWT for a short-lived HMAC ticket
* GET /api/stream/{id}         — authenticated, range-capable media stream

Authorization (block check + chapter enrollment) is enforced before any
ticket is issued and again on every stream request. Drive sources redirect
to the configured Cloudflare worker; YouTube sources are client-rendered.
"""
from __future__ import annotations

import math
import re
import uuid as _uuid
from typing import Tuple

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import RedirectResponse, Response, StreamingResponse

from backend.config import settings
from backend.core.rate_limiter import check_rate_limit
from backend.domains import auth as _auth_mod
import backend.runtime as runtime
from backend.integrations import telegram_client as tg
from backend.services import activity_service
import backend.runtime as _runtime_mod

router = APIRouter()

_VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
_MAX_RANGE_SIZE = 50 * 1024 * 1024
_CONCURRENT_STREAM_LIMIT = 3

# Runtime streaming settings (read from Control Plane settings with safe
# bounds and a short in-memory cache so DB is not hit on every chunk).
_STREAM_SETTINGS_CACHE = {"at": 0.0, "concurrent": 3, "range_mb": 50}

async def _stream_limits() -> tuple[int, int]:
    """Return (concurrent_limit, range_max_bytes). Bounded for safety."""
    import time as _t
    now = _t.time()
    if now - _STREAM_SETTINGS_CACHE["at"] < 30:
        return _STREAM_SETTINGS_CACHE["concurrent"], _STREAM_SETTINGS_CACHE["range_mb"] * 1024 * 1024
    concurrent, range_mb = 3, 50
    try:
        from backend.api.controlplane.settings import get_settings
        data = await get_settings()
        concurrent = max(1, min(int(data.get("streaming.max_concurrent_per_user", 3)), 10))
        range_mb = max(1, min(int(data.get("streaming.range_max_mb", 50)), 200))
    except Exception:
        pass
    _STREAM_SETTINGS_CACHE.update(at=now, concurrent=concurrent, range_mb=range_mb)
    return concurrent, range_mb * 1024 * 1024



def _parse_range(range_header: str, total: int) -> Tuple[int, int]:
    try:
        val = range_header.replace("bytes=", "").strip()
        parts = val.split("-")
        start = int(parts[0]) if parts[0].strip() else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1].strip() else total - 1
        start = max(0, min(start, total - 1))
        end = max(start, min(end, total - 1))
        return start, end
    except (ValueError, IndexError):
        return 0, total - 1


def _validate_video_id(video_id: str) -> None:
    if not _VIDEO_ID_RE.match(video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID format")
    if len(video_id) == 36:
        try:
            _uuid.UUID(video_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid video ID format")


@router.get("/api/stream-ticket/{video_id}")
async def get_stream_ticket(
    video_id: str, request: Request, authorization: str = Header(None)
):
    user = await runtime.verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
    user_id = user.get("sub") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    if await runtime.is_user_blocked(user_id):
        raise HTTPException(status_code=403, detail="Account blocked")

    _validate_video_id(video_id)
    await check_rate_limit(request, limit=60, window=60, prefix="ticket")

    if video_id not in _runtime_mod.S.video_map:
        await runtime.refresh_catalog()
    video = _runtime_mod.S.video_map.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found in active catalog.")
    chapter_id = video.get("chapter_id")
    if chapter_id and not await runtime.check_user_chapter_access(user_id, chapter_id):
        raise HTTPException(status_code=403, detail="Enrollment required for this chapter.")

    ticket, ttl = _auth_mod.generate_stream_ticket(user_id, video_id)(user_id, video_id)
    return {"ticket": ticket, "expires_in": ttl}


@router.api_route("/api/stream/{video_id}", methods=["GET", "HEAD"])
async def stream_video(
    video_id: str,
    request: Request,
    token: str = None,
    ticket: str = None,
    authorization: str = Header(None),
):
    # 1) short-lived HMAC ticket, 2) JWT header, 3) deprecated ?token= fallback
    user_id = None
    if ticket:
        user_id = _auth_mod.verify_stream_ticket(video_id, ticket)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid or expired stream ticket")
    else:
        auth_val = authorization or (f"Bearer {token}" if token else None)
        user = await runtime.verify_supabase_token(auth_val)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
        user_id = user.get("sub") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

    if await runtime.is_user_blocked(user_id):
        raise HTTPException(status_code=403, detail="Account blocked")

    concurrent_limit, _ = await _stream_limits()
    if _runtime_mod.S.concurrent_user_streams[user_id] >= concurrent_limit:
        raise HTTPException(status_code=429, detail=f"Maximum {concurrent_limit} concurrent streams allowed")

    _validate_video_id(video_id)
    await check_rate_limit(request, limit=120, window=60, prefix="stream")

    import asyncio

    asyncio.create_task(
        activity_service.log_activity(user_id, "stream_start", {"video_id": video_id}, request)
    )

    try:
        if video_id not in _runtime_mod.S.video_map:
            await runtime.refresh_catalog()
            if video_id not in _runtime_mod.S.video_map:
                raise HTTPException(status_code=404, detail="Video not found in active catalog.")

        video = _runtime_mod.S.video_map[video_id]
        chapter_id = video.get("chapter_id")
        if chapter_id and not await runtime.check_user_chapter_access(user_id, chapter_id):
            raise HTTPException(
                status_code=403,
                detail="Enrollment required for this chapter. Please redeem an enrollment code.",
            )

        source_type = video.get("source_type", "telegram")
        if source_type == "drive":
            drive_file_id = video.get("drive_file_id")
            if not drive_file_id:
                raise HTTPException(status_code=400, detail="Drive file ID missing")
            if not re.match(r"^[a-zA-Z0-9_-]{10,100}$", drive_file_id):
                raise HTTPException(status_code=400, detail="Invalid Drive file ID format")
            worker_url = settings.cloudflare_worker_url or (
                "https://nexusedu-proxy.mdhosainp414.workers.dev"
            )
            return RedirectResponse(url=f"{worker_url}/drive/{drive_file_id}", status_code=302)

        if source_type == "youtube":
            raise HTTPException(status_code=400, detail="YouTube videos stream directly on client")

        connected = await tg.ensure_connected()
        if not connected:
            raise HTTPException(status_code=503, detail="Telegram client is not connected.")

        channel_id_str = video.get("channel_id", "")
        message_id_str = video.get("message_id", 0)
        if not channel_id_str or not message_id_str:
            raise HTTPException(status_code=400, detail="Video not linked to Telegram")

        channel_id = int(channel_id_str)
        message_id = int(message_id_str)
        _runtime_mod.S.channel_usage_stats[channel_id] = _runtime_mod.S.channel_usage_stats.get(channel_id, 0) + 1
        await tg.resolve_channel(channel_id)

        try:
            message = await tg.get_message(channel_id, message_id)
        except Exception as exc:
            raise HTTPException(status_code=404, detail="Telegram message failed to load") from exc

        media = message.video or message.document
        if not media:
            raise HTTPException(status_code=404, detail="Message has no media")

        file_size = media.file_size
        mime_type = tg._mime_from_media(media)

        if request.method == "HEAD":
            return Response(
                status_code=200,
                media_type=mime_type,
                headers={
                    "Content-Length": str(file_size),
                    "Accept-Ranges": "bytes",
                    "Content-Type": mime_type,
                    "Cache-Control": "private, no-store",
                },
            )

        range_header = request.headers.get("Range")
        start, end = _parse_range(range_header or "", file_size)
        _, max_range = await _stream_limits()
        if end - start + 1 > max_range:
            end = start + max_range - 1
        length = end - start + 1

        async def _tracked_stream():
            incremented = False
            try:
                _runtime_mod.S.concurrent_user_streams[user_id] += 1
                incremented = True
                async for chunk in tg.stream_range(channel_id, message_id, start, end, file_size):
                    yield chunk
            finally:
                if incremented:
                    _runtime_mod.S.concurrent_user_streams[user_id] = max(
                        0, _runtime_mod.S.concurrent_user_streams[user_id] - 1
                    )

        return StreamingResponse(
            _tracked_stream(),
            status_code=206 if range_header else 200,
            media_type=mime_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(length),
                "Content-Type": mime_type,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        import logging
        import traceback

        logging.getLogger("NexusEdu").info("Stream endpoint error: %s", exc)
        logging.getLogger("NexusEdu").error(traceback.format_exc())
        # Do not echo internal exception details (paths, Telegram errors)
        # to the client; log them server-side instead.
        raise HTTPException(status_code=500, detail="Internal server error")
