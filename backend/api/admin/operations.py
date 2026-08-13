"""
Admin operational endpoints: audit logs + live dashboard metrics.
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import psutil
from fastapi import APIRouter, HTTPException, Request

from backend.api.admin._deps import ensure_admin
from backend.integrations import supabase_integration as sb
from backend.integrations import telegram_client as tg
import backend.runtime as _runtime_mod

router = APIRouter()

_ISO_DT = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$"


@router.get("/logs")
async def get_logs(request: Request, limit: int = 200, since: Optional[str] = None):
    await ensure_admin(request)
    limit = max(1, min(int(limit), 1000))
    url = (
        f"activity_logs?select=*,profiles(email,display_name)"
        f"&order=created_at.desc&limit={limit}"
    )
    if since:
        if not re.match(_ISO_DT, since):
            raise HTTPException(status_code=400, detail="Invalid 'since' timestamp")
        url += f"&created_at=gte.{since}"
    return await sb.admin_request("GET", url)


@router.get("/dashboard/metrics")
async def get_dashboard_metrics(request: Request):
    await ensure_admin(request)

    active_streams = sum(_runtime_mod.S.concurrent_user_streams.values())
    live_users_count = len([u for u, c in _runtime_mod.S.concurrent_user_streams.items() if c > 0])
    live_users = live_users_count

    # Enrich with DB activity from the last 5 minutes.
    try:
        five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        resp = await sb.client().get(
            f"{sb.base_url()}/rest/v1/activity_logs?select=user_id&created_at=gte.{five_min_ago}",
            headers=sb.service_headers(),
            timeout=3.0,
        )
        if resp.status_code == 200:
            active = {r.get("user_id") for r in resp.json() if r.get("user_id")}
            live_users = max(live_users_count, len(active))
    except Exception:
        pass

    process = psutil.Process()
    metrics = {
        "live_users": live_users,
        "active_streams": active_streams,
        "server_resources": {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": process.memory_percent(),
        },
        "recent_errors": [],
        "recent_signups": [],
        "popular_videos": [],
        "telegram_health": [],
    }

    headers = sb.service_headers()
    try:
        async with sb.client() as client:
            signups = await client.get(
                f"{sb.base_url()}/rest/v1/profiles"
                f"?select=id,display_name,email,created_at&order=created_at.desc&limit=10",
                headers=headers,
            )
            if signups.status_code == 200:
                metrics["recent_signups"] = signups.json()

            tg_client = tg.get_active_client()
            if tg_client:
                tg_health = []
                for name, cid in tg.CHANNEL_MAP.items():
                    if not cid:
                        continue
                    try:
                        chan = await tg_client.get_chat(cid)
                        tg_health.append(
                            {"channel_name": chan.title or name, "status": "Healthy", "latency": "~50ms"}
                        )
                    except Exception as exc:
                        tg_health.append(
                            {"channel_name": name, "status": "Error", "latency": str(exc)[:50]}
                        )
                metrics["telegram_health"] = tg_health
            else:
                metrics["telegram_health"] = [
                    {"channel_name": "No Telegram client", "status": "Disconnected", "latency": "N/A"}
                ]

            try:
                errors = await client.get(
                    f"{sb.base_url()}/rest/v1/activity_logs?action=eq.error"
                    f"&order=created_at.desc&limit=10",
                    headers=headers,
                )
                if errors.status_code == 200:
                    metrics["recent_errors"] = [
                        {
                            "id": i + 1,
                            "message": (
                                e.get("details", {}).get("message", "Unknown error")
                                if isinstance(e.get("details"), dict)
                                else str(e.get("details", "Unknown"))
                            ),
                            "time": e.get("created_at", "Unknown"),
                        }
                        for i, e in enumerate(errors.json())
                    ]
            except Exception:
                metrics["recent_errors"] = []

            try:
                popular = await client.get(
                    f"{sb.base_url()}/rest/v1/watch_history"
                    f"?select=video_id,videos(title)&order=watched_at.desc&limit=100",
                    headers=headers,
                )
                if popular.status_code == 200:
                    counts: dict = {}
                    titles: dict = {}
                    for item in popular.json():
                        vid = item.get("video_id")
                        if vid:
                            counts[vid] = counts.get(vid, 0) + 1
                            if vid not in titles:
                                v = item.get("videos")
                                if isinstance(v, dict):
                                    titles[vid] = v.get("title", "Unknown")
                    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:5]
                    metrics["popular_videos"] = [
                        {"title": titles.get(vid, "Unknown"), "views": count} for vid, count in top
                    ]
            except Exception:
                metrics["popular_videos"] = []
    except Exception as exc:
        import logging

        logging.getLogger("NexusEdu").error("[Metrics Error] %s", exc)

    return metrics
