"""
System / operational endpoints: root, health, ping, warmup, Prometheus
metrics and channel-health. These are infrastructure concerns, grouped
here so they do not pollute feature routers.
"""
from __future__ import annotations

import time

import httpx
import psutil
from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from backend.config import settings
from backend.core.rate_limiter import check_rate_limit
from backend.core.security import secrets_manager
import backend.runtime as runtime
from backend.integrations import supabase_integration as sb
from backend.integrations import telegram_client as tg
import backend.runtime as _runtime_mod

router = APIRouter()


@router.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"service": "NexusEdu Backend", "version": "v1.2.1", "status": "running"}


@router.get("/health")
async def basic_health():
    return {"status": "healthy"}


@router.api_route("/api/health", methods=["GET", "HEAD"])
async def health():
    start = time.time()
    sb_status = "unconfigured"
    url = secrets_manager.get_secret("supabase_url")
    key = secrets_manager.get_secret("supabase_service_key")
    if url and key:
        if _runtime_mod.S.supabase_client is not None:
            try:
                await _runtime_mod.S.supabase_client.table("subjects").select("id").limit(1).execute()
                sb_status = "connected"
            except Exception:
                sb_status = "error"
        else:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    r = await client.get(
                        f"{url}/rest/v1/",
                        headers={"apikey": key, "Authorization": f"Bearer {key}"},
                    )
                    sb_status = "connected" if r.status_code in (200, 204) else "error"
            except Exception:
                sb_status = "error"

    return JSONResponse(
        {
            "status": "healthy" if sb_status != "error" else "degraded",
            "version": "v1.2.1",
            "response_time_ms": round((time.time() - start) * 1000),
            "telegram_configured": "configured" if tg.HAS_TELEGRAM_CREDS else "not_configured",
            "services": {"supabase": {"status": sb_status}},
        }
    )


@router.get("/api/ping")
async def ping():
    return {"status": "ok", "timestamp": __import__("datetime").datetime.now().isoformat()}


@router.get("/metrics")
async def metrics(request: Request, authorization: str = Header(None)):
    admin_token = secrets_manager.get_secret("admin_token")
    x_admin_token = request.headers.get("X-Admin-Token")
    if admin_token and x_admin_token:
        import hmac

        if hmac.compare_digest(x_admin_token, admin_token):
            return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    user = await runtime.verify_supabase_token(authorization)
    if user and await runtime.is_user_admin(user.get("sub") or user.get("id")):
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    raise HTTPException(status_code=403, detail="Forbidden: admin access required for metrics")


@router.api_route("/api/warmup", methods=["GET", "POST"])
async def warmup(request: Request):
    try:
        await check_rate_limit(request, limit=10, window=60, prefix="warmup")
    except HTTPException:
        return {"status": "rate_limited"}

    start = time.time()
    sb_status = "ok"
    url = secrets_manager.get_secret("supabase_url")
    anon = secrets_manager.get_secret("supabase_anon_key")
    if url and anon:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.options(f"{url}/rest/v1/")
                sb_status = "ok" if r.status_code in (200, 204) else "error"
        except Exception:
            sb_status = "error"
    else:
        sb_status = "unconfigured"

    if not _runtime_mod.S.video_map:
        await runtime.refresh_catalog()

    return {
        "status": "ok",
        "videos": len(_runtime_mod.S.video_map),
        "supabase": sb_status,
        "elapsed_ms": round((time.time() - start) * 1000),
    }


@router.get("/api/channels/health")
async def channel_health(request: Request, authorization: str = Header(None)):
    try:
        await check_rate_limit(request, limit=20, window=60, prefix="channel_health")
    except HTTPException:
        return {"status": "rate_limited"}

    user = await runtime.verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")

    client = tg.get_active_client()
    if not client:
        return {"status": "error", "error": "No telegram client active"}

    results = {}
    for name, cid in tg.CHANNEL_MAP.items():
        if not cid:
            continue
        try:
            chan = await client.get_chat(cid)
            results[name] = {
                "status": "ok",
                "title": chan.title,
                "members": chan.members_count or 0,
                "usage": _runtime_mod.S.channel_usage_stats.get(cid, 0),
            }
        except Exception as exc:
            results[name] = {"status": "error", "error": str(exc)}
    return {"status": "ok", "channels": results}
