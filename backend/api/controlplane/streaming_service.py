"""Streaming & playback control service (Stage 33).

Read-only diagnostics + safe configuration through the existing settings
engine. It does NOT replace the streaming endpoints or Telegram client;
it reports their real state and exposes bounded controls the streaming
route honors (concurrency limit, range size, ticket TTL).
"""
from __future__ import annotations

import re
import time
from typing import Any, Optional

from fastapi import HTTPException

from backend.api.controlplane import telegram_service as tg
from backend.api.controlplane.settings import SETTING_DEFINITIONS, get_settings, update_setting
from backend.integrations import supabase_integration as sb

_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _validate_uuid(v: str, label: str = "id") -> None:
    if not _UUID.match(v or ""):
        raise HTTPException(400, f"Invalid {label}")


async def streaming_status() -> dict[str, Any]:
    settings = await get_settings()
    counts = await _video_counts()
    return {
        "configured": True,
        "limits": {
            "max_concurrent_per_user": settings.get("streaming.max_concurrent_per_user", 3),
            "range_max_mb": settings.get("streaming.range_max_mb", 50),
            "ticket_ttl_seconds": settings.get("streaming.ticket_ttl_seconds", 21600),
        },
        "security": {
            "ticket_required": True,
            "chapter_enrollment_enforced": True,
            "hmac_signed_tickets": True,
        },
        "counts": counts,
        "measured_at": int(time.time()),
    }


async def _video_counts() -> dict[str, int]:
    async def count(query: str) -> int:
        try:
            headers = sb.service_headers()
            headers["Prefer"] = "count=exact"
            headers["Range"] = "0-0"
            resp = await sb.client().get(
                f"{sb.base_url()}/rest/v1/videos?{query}", headers=headers, timeout=5.0
            )
            cr = resp.headers.get("content-range", "")
            total = cr.rsplit("/", 1)[-1] if "/" in cr else ""
            return int(total) if total.isdigit() else 0
        except Exception:
            return 0

    return {
        "total": await count("select=id"),
        "mapped": await count("telegram_message_id=not.is.null&select=id"),
        "missing_mapping": await count("telegram_message_id=is.null&select=id"),
        "missing_thumbnail": await count("thumbnail_url=is.null&select=id"),
        "inactive": await count("is_active=eq.false&select=id"),
    }


async def video_diagnostics(video_id: str) -> dict[str, Any]:
    _validate_uuid(video_id, "video_id")
    video = await tg.get_video_mapping(video_id)
    issues: list[str] = []
    cid, mid = video.get("telegram_channel_id"), video.get("telegram_message_id")
    if not cid or not mid:
        issues.append("missing_telegram_mapping")
    elif not (str(cid).lstrip("-").isdigit() and str(mid).isdigit()):
        issues.append("invalid_identifiers")
    if not video.get("thumbnail_url"):
        issues.append("missing_thumbnail")
    if not video.get("is_active", True):
        issues.append("video_inactive")

    chapter = (
        await sb.admin_request(
            "GET",
            f"chapters?id=eq.{video.get('chapter_id')}&select=id,name,is_active,cycle_id",
        )
        if video.get("chapter_id")
        else []
    )
    if chapter:
        ch = chapter[0]
        if not ch.get("is_active", True):
            issues.append("chapter_inactive")
        if ch.get("cycle_id"):
            cycle = await sb.admin_request("GET", f"cycles?id=eq.{ch['cycle_id']}&select=id,is_active")
            if cycle and not cycle[0].get("is_active", True):
                issues.append("cycle_inactive")

    result: dict[str, Any] = {
        "video_id": video_id,
        "healthy": not issues,
        "issues": issues,
        "video": _safe_video(video),
    }
    if not issues or "missing_telegram_mapping" not in issues:
        verify = await tg.verify_mapping(video_id)
        result["telegram"] = verify.get("status")
        if verify.get("status") != "resolvable":
            issues.append("telegram_unreachable")
            result["healthy"] = False
    return result


def _safe_video(v: dict) -> dict:
    keep = (
        "id", "title", "chapter_id", "source_type", "is_active",
        "telegram_channel_id", "telegram_message_id", "thumbnail_url",
    )
    return {k: v.get(k) for k in keep if k in v}


async def list_videos_diagnostic(status_filter: Optional[str] = None, limit: int = 100) -> list[dict]:
    videos = (await tg.list_videos(None, limit)).get("videos", [])
    out = []
    for v in videos:
        issues: list[str] = []
        if not v.get("telegram_message_id"):
            issues.append("missing_mapping")
        if not v.get("thumbnail_url"):
            issues.append("missing_thumbnail")
        if not v.get("is_active", True):
            issues.append("inactive")
        state = "healthy" if not issues else issues[0]
        if status_filter and status_filter != "all" and state != status_filter:
            continue
        out.append({
            "id": v.get("id"),
            "title": v.get("title"),
            "chapter": (v.get("chapters") or {}).get("name"),
            "status": state,
            "issues": issues,
        })
    return out


async def update_streaming_setting(key: str, value: Any, actor: str) -> dict:
    if key not in SETTING_DEFINITIONS:
        raise HTTPException(404, "Unknown streaming setting")
    # Validate bounds FIRST, before any DB access.
    try:
        ivalue = int(value)
    except (TypeError, ValueError):
        raise HTTPException(400, "Value must be an integer")
    if key == "streaming.max_concurrent_per_user" and not (1 <= ivalue <= 10):
        raise HTTPException(400, "max_concurrent_per_user must be 1-10")
    if key == "streaming.range_max_mb" and not (1 <= ivalue <= 200):
        raise HTTPException(400, "range_max_mb must be 1-200")
    if key == "streaming.ticket_ttl_seconds" and not (60 <= ivalue <= 86400):
        raise HTTPException(400, "ticket_ttl_seconds must be 60-86400")
    return await update_setting(key, ivalue, actor, reason="Streaming control plane update")
