"""Telegram & Video Storage control service (Stage 32).

Provides secret-safe status, diagnostics and video↔Telegram mapping
management on top of the existing Pyrogram/Bot integration. It NEVER
returns credentials; secrets are represented as "configured"/"missing".
All Telegram calls run server-side with short timeouts and degrade
gracefully when Telegram is unreachable.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, Optional

from fastapi import HTTPException

from backend.config import settings
from backend.integrations import supabase_integration as sb
from backend.integrations import telegram_client as tg
from backend.integrations.telegram_bot import bot_manager

_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
_INT = re.compile(r"^\d{1,12}$")


def _validate_uuid(v: str, label: str = "id") -> None:
    if not _UUID.match(v or ""):
        raise HTTPException(400, f"Invalid {label}")


def _secret_present(value: Any) -> bool:
    return bool(value) and (not hasattr(value, "get_secret_value") or bool(value.get_secret_value()))


# ── Status (secret-safe) ──────────────────────────────────────
async def telegram_status() -> dict:
    return {
        "pyrogram_configured": tg.HAS_TELEGRAM_CREDS,
        "bot_configured": bool(settings.telegram_bot_token),
        "webhook_configured": bool(settings.webhook_url),
        "thumbnail_channel_configured": bool(settings.thumbnail_channel_id),
        "storage_channel_count": len(tg.CHANNEL_MAP),
        "storage_channels": _channel_summary(),
        "bot_initialized": getattr(bot_manager, "_initialized", False),
    }


def _channel_summary() -> list[dict]:
    out = []
    for name, cid in tg.CHANNEL_MAP.items():
        out.append({"name": name, "channel_id": cid})
    if settings.thumbnail_channel_id:
        try:
            out.append({"name": "thumbnail", "channel_id": int(settings.thumbnail_channel_id)})
        except (TypeError, ValueError):
            out.append({"name": "thumbnail", "channel_id": None, "error": "invalid channel id"})
    return out


async def run_diagnostics() -> dict:
    """Run bounded, non-destructive Telegram checks. Always returns."""
    results: dict[str, Any] = {"pyrogram": "skipped", "bot": "skipped", "channels": []}
    # Pyrogram connectivity
    if tg.HAS_TELEGRAM_CREDS:
        try:
            await asyncio.wait_for(tg.ensure_connected(), timeout=5.0)
            cl = tg.get_active_client()
            results["pyrogram"] = "connected" if (cl and cl.is_connected) else "unavailable"
        except Exception as e:
            results["pyrogram"] = f"error: {type(e).__name__}"
    else:
        results["pyrogram"] = "not configured"
    # Bot
    if settings.telegram_bot_token:
        results["bot"] = "initialized" if getattr(bot_manager, "_initialized", False) else "not initialized"
    # Resolve each configured channel (with a short timeout)
    for ch in _channel_summary():
        cid = ch.get("channel_id")
        entry: dict[str, Any] = {"name": ch.get("name"), "channel_id": cid}
        if not cid:
            entry["status"] = "invalid"
        else:
            try:
                ok = await asyncio.wait_for(tg.resolve_channel(cid), timeout=5.0)
                entry["status"] = "accessible" if ok else "not accessible"
            except Exception as e:
                entry["status"] = f"error: {type(e).__name__}"
        results["channels"].append(entry)
    return results


# ── Webhook ───────────────────────────────────────────────────
async def webhook_status() -> dict:
    if not settings.telegram_bot_token:
        return {"configured": False, "url": None}
    return {
        "configured": bool(settings.webhook_url),
        "url_configured": bool(settings.webhook_url),
        "initialized": getattr(bot_manager, "_initialized", False),
    }


async def reinitialize_bot() -> dict:
    """Re-run bot initialization (sets the webhook). Safe to retry."""
    if not settings.telegram_bot_token or not settings.webhook_url:
        raise HTTPException(400, "Bot token or webhook URL not configured")
    ok = await bot_manager.initialize()
    return {"reinitialized": ok}


# ── Video ↔ Telegram mapping ──────────────────────────────────
async def list_videos(
    missing: Optional[bool] = None, limit: int = 50, offset: int = 0,
) -> dict:
    limit = max(1, min(limit, 200))
    select = ("id,title,chapter_id,is_active,source_type,telegram_channel_id,"
              "telegram_message_id,thumbnail_url,display_order,chapters(name,name_bn,cycle_id)")
    q = f"videos?select={select}&order=display_order.asc,title.asc&limit={limit}&offset={offset}"
    if missing is True:
        q += "&telegram_message_id=is.null"
    elif missing is False:
        q += "&telegram_message_id=not.is.null"
    rows = await sb.admin_request("GET", q)
    return {"videos": rows or [], "limit": limit, "offset": offset}


async def get_video_mapping(video_id: str) -> dict:
    _validate_uuid(video_id, "video_id")
    rows = await sb.admin_request(
        "GET",
        f"videos?id=eq.{video_id}&select=id,title,chapter_id,source_type,"
        "telegram_channel_id,telegram_message_id,youtube_video_id,drive_file_id,thumbnail_url,is_active",
    )
    if not rows:
        raise HTTPException(404, "Video not found")
    return rows[0]


async def _video_exists(video_id: str) -> bool:
    rows = await sb.admin_request("GET", f"videos?id=eq.{video_id}&select=id")
    return bool(rows)


async def verify_mapping(video_id: str) -> dict:
    """Attempt to fetch the Telegram message for a video's mapping."""
    video = await get_video_mapping(video_id)
    cid, mid = video.get("telegram_channel_id"), video.get("telegram_message_id")
    result: dict[str, Any] = {"video_id": video_id, "configured": bool(cid and mid)}
    if not (cid and mid):
        result["status"] = "missing mapping"
        return result
    if not cid.isdigit() or not _INT.match(str(mid)):
        result["status"] = "invalid identifiers"
        return result
    try:
        msg = await asyncio.wait_for(tg.get_message(int(cid), int(mid)), timeout=6.0)
        media = msg.video or msg.document
        result["status"] = "resolvable" if media else "no media"
        result["mime"] = tg._mime_from_media(media) if media else None
        result["file_size"] = getattr(media, "file_size", None) if media else None
    except Exception as e:
        result["status"] = f"unreachable: {type(e).__name__}"
    return result


async def set_mapping(
    video_id: str, channel_id: Optional[str] = None,
    message_id: Optional[int] = None, thumbnail_url: Optional[str] = None,
) -> dict:
    _validate_uuid(video_id, "video_id")
    if not await _video_exists(video_id):
        raise HTTPException(404, "Video not found")
    if channel_id is not None and not _INT.match(str(channel_id)):
        raise HTTPException(400, "channel_id must be numeric")
    if message_id is not None and not isinstance(message_id, int):
        raise HTTPException(400, "message_id must be an integer")
    payload: dict[str, Any] = {}
    if channel_id is not None:
        payload["telegram_channel_id"] = str(channel_id)
    if message_id is not None:
        payload["telegram_message_id"] = message_id
    if thumbnail_url is not None:
        payload["thumbnail_url"] = thumbnail_url
    if not payload:
        raise HTTPException(400, "No valid fields to update")
    rows = await sb.admin_request(
        "PATCH", f"videos?id=eq.{video_id}", json_data=payload,
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0] if isinstance(rows, list) and rows else payload


async def clear_mapping(video_id: str) -> dict:
    _validate_uuid(video_id, "video_id")
    await sb.admin_request(
        "PATCH", f"videos?id=eq.{video_id}",
        json_data={"telegram_channel_id": None, "telegram_message_id": None},
    )
    return {"cleared": True, "video_id": video_id}


async def diagnostics() -> dict:
    """Read-only storage diagnostics (no mutations)."""
    missing = await sb.admin_request("GET", "videos?telegram_message_id=is.null&select=id,title")
    no_thumb = await sb.admin_request("GET", "videos?thumbnail_url=is.null&select=id,title")
    inactive = await sb.admin_request("GET", "videos?is_active=eq.false&select=id,title")
    return {
        "videos_missing_telegram": len(missing or []),
        "videos_missing_thumbnail": len(no_thumb or []),
        "inactive_videos": len(inactive or []),
        "samples": {
            "missing_mapping": (missing or [])[:10],
        },
    }
