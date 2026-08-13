"""Admin Control Plane — Security governance (Stage 35).

Read-only security posture plus bounded, non-bypassable settings.
Fundamental protections (auth, RLS, ticket signing, enrollment, owner
recovery) are intentionally NOT toggleable and are reported as always-on.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Request

from backend.api.controlplane import operations as ops
from backend.api.controlplane import streaming_service as stream
from backend.api.controlplane.deps import require_permission
from backend.config import settings as app_settings

router = APIRouter(prefix="/control-plane/security", tags=["control-plane/security"])

_ALWAYS_ON = [
    "JWT authentication", "Server-side admin authorization", "RLS on Control Plane tables",
    "HMAC-signed stream tickets", "Enrollment/chapter enforcement",
    "Owner recovery protection", "Immutable audit log",
]


@router.get("/posture")
async def posture(request: Request) -> dict[str, Any]:
    await require_permission(request, "security.read")
    secrets = {
        "SUPABASE_SERVICE_KEY": bool(app_settings.supabase_service_key),
        "JWT_SECRET": bool(getattr(app_settings, "jwt_secret", None)),
        "ADMIN_TOKEN": bool(getattr(app_settings, "admin_token", None)),
        "TELEGRAM_API_HASH": bool(app_settings.telegram_api_hash),
        "TELEGRAM_BOT_TOKEN": bool(app_settings.telegram_bot_token),
        "PYROGRAM_SESSION": bool(app_settings.pyrogram_session_string),
        "WEBHOOK_SECRET": bool(app_settings.telegram_webhook_secret),
    }
    streaming_limits = None
    maintenance = None
    try:
        streaming = await stream.streaming_status()
        streaming_limits = streaming.get("limits")
    except Exception:
        streaming_limits = "unavailable"
    try:
        maintenance = await ops.get_maintenance()
    except Exception:
        maintenance = "unavailable"
    return {
        "always_on_protections": _ALWAYS_ON,
        "secrets_configured": secrets,
        "cors": {"allowed_origins": "configurable via ALLOWED_ORIGINS"},
        "streaming_limits": streaming_limits,
        "maintenance": maintenance,
    }


@router.get("/configuration")
async def configuration(request: Request):
    await require_permission(request, "security.read")
    # Reuse operations configuration component (booleans only).
    return ops.configuration_component()
