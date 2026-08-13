"""
Admin user-inspection endpoints (read-only views over a single user).

* GET /api/admin/users/{id}/profile
* GET /api/admin/users/{id}/activity
* GET /api/admin/users/{id}/watch-history
* GET /api/admin/users/{id}/stats
* GET /api/admin/users/{id}/notes
* GET /api/admin/users/{id}/sessions
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.api.admin._deps import ensure_admin
from backend.core.rate_limiter import check_rate_limit
from backend.integrations import supabase_integration as sb

router = APIRouter()


@router.get("/users/{user_id}/profile")
async def admin_get_user_profile(user_id: UUID, request: Request):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_user_track")
    await ensure_admin(request)
    url = sb.base_url()
    key = sb.secrets_manager.get_secret("supabase_service_key")
    async with sb.client() as client:
        resp = await client.get(
            f"{url}/rest/v1/profiles?id=eq.{user_id}&select=*",
            headers=sb.service_headers(),
        )
        if resp.status_code == 200 and len(resp.json()) > 0:
            profile = resp.json()[0]
            auth_resp = await client.get(
                f"{url}/auth/v1/admin/users/{user_id}",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
            )
            if auth_resp.status_code == 200:
                auth_user = auth_resp.json()
                profile["email"] = auth_user.get("email")
                profile["created_at"] = auth_user.get("created_at")
                profile["last_active"] = auth_user.get("last_sign_in_at")
                profile["is_blocked"] = auth_user.get("banned_until") is not None
            return JSONResponse(profile)
        return JSONResponse({"error": "User not found"}, status_code=404)


@router.get("/users/{user_id}/activity")
async def admin_get_user_activity(user_id: UUID, request: Request, page: int = 1, limit: int = 50):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_user_track")
    await ensure_admin(request)
    offset = (page - 1) * limit
    return await sb.admin_request(
        "GET",
        f"activity_logs?user_id=eq.{user_id}&order=created_at.desc&limit={limit}&offset={offset}",
    )


@router.get("/users/{user_id}/watch-history")
async def admin_get_user_watch_history(user_id: UUID, request: Request):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_user_track")
    await ensure_admin(request)
    data = await sb.admin_request(
        "GET",
        f"watch_history?user_id=eq.{user_id}&select=*,videos(title,chapter_id)"
        f"&order=updated_at.desc",
    )
    results = []
    for item in data:
        res = {
            "progress_percent": item.get("progress_percent"),
            "completed": item.get("completed"),
            "watched_at": item.get("watched_at") or item.get("updated_at"),
            "times_watched": item.get("times_watched", 1),
        }
        v = item.get("videos")
        res["video_title"] = v.get("title") if isinstance(v, dict) else "Unknown Video"
        results.append(res)
    return JSONResponse(results)


@router.get("/users/{user_id}/stats")
async def admin_get_user_stats(user_id: UUID, request: Request):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_user_track")
    await ensure_admin(request)
    history = await sb.admin_request(
        "GET",
        f"watch_history?user_id=eq.{user_id}&select=progress_seconds,completed",
    )
    total_watch_time = sum(h.get("progress_seconds", 0) for h in history if isinstance(h, dict))
    videos_completed = sum(1 for h in history if isinstance(h, dict) and h.get("completed"))
    videos_in_progress = len(history) - videos_completed

    logs = await sb.admin_request(
        "GET", f"activity_logs?user_id=eq.{user_id}&select=created_at"
    )
    engagement_score = min(100, len(logs) + videos_completed * 5)

    logs_sorted = sorted(logs, key=lambda x: x.get("created_at") or "")
    sessions = 0
    last_time = None
    from dateutil import parser

    for lg in logs_sorted:
        try:
            dt = parser.parse(lg.get("created_at")).timestamp()
            if not last_time or (dt - last_time) > 1800:
                sessions += 1
            last_time = dt
        except Exception:
            pass

    return JSONResponse(
        {
            "total_watch_time": total_watch_time,
            "videos_completed": videos_completed,
            "videos_in_progress": videos_in_progress,
            "total_videos_enrolled": len(history),
            "engagement_score": engagement_score,
            "favorite_subject": "N/A",
            "peak_study_hour": "N/A",
            "total_sessions": max(1, sessions),
        }
    )


@router.get("/users/{user_id}/notes")
async def admin_get_user_notes(user_id: UUID, request: Request):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_user_track")
    await ensure_admin(request)
    data = await sb.admin_request(
        "GET",
        f"video_notes?user_id=eq.{user_id}&select=content,created_at,videos(title)",
    )
    results = []
    for item in data:
        v = item.get("videos")
        results.append(
            {
                "content": item.get("content"),
                "created_at": item.get("created_at"),
                "video_title": v.get("title") if isinstance(v, dict) else "Unknown",
            }
        )
    return JSONResponse(results)


@router.get("/users/{user_id}/sessions")
async def admin_get_user_sessions(user_id: UUID, request: Request):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_user_track")
    await ensure_admin(request)
    data = await sb.admin_request(
        "GET",
        f"activity_logs?user_id=eq.{user_id}&action=eq.login"
        f"&order=created_at.desc&limit=100",
    )
    results = []
    for log in data:
        details = log.get("details") or {}
        results.append(
            {
                "created_at": log.get("created_at"),
                "ip_address": log.get("ip_address"),
                "user_agent": log.get("user_agent"),
                "duration_minutes": details.get("duration_minutes", 0),
            }
        )
    return JSONResponse(results)
