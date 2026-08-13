"""Operations & system-control service (Stage 34).

Builds a structured, secret-free operational report by wrapping the
existing health, Telegram, and streaming checks. It never executes
arbitrary code/SQL/Telegram methods, and it degrades gracefully when
external services are unreachable.
"""
from __future__ import annotations

import os
import time
from typing import Any, Optional

from fastapi import HTTPException

from backend.api.controlplane import telegram_service as tg_svc
from backend.api.controlplane import streaming_service as stream_svc
from backend.config import settings
from backend.integrations import supabase_integration as sb
from backend.integrations import telegram_client as tg
from backend.integrations.telegram_bot import bot_manager

# Process start time (set on first import).
STARTED_AT = time.time()

# Status vocabulary used across the Operations Control Plane.
HEALTHY = "healthy"
WARNING = "warning"
CRITICAL = "critical"
NOT_CONFIGURED = "not_configured"
UNREACHABLE = "unreachable"
UNKNOWN = "unknown"


def _component(status: str, label: str, detail: Optional[str] = None, **extra: Any) -> dict:
    out = {"status": status, "label": label}
    if detail:
        out["detail"] = detail
    out.update(extra)
    return out


async def backend_component() -> dict:
    import backend.runtime as rt
    route_count = 0
    try:
        app = getattr(rt, "_app", None)
        if app is not None:
            route_count = len([r for r in app.routes if hasattr(r, "path")])
    except Exception:
        pass
    uptime = int(time.time() - STARTED_AT)
    return _component(
        HEALTHY, "Backend", "Application process running",
        version="v1.2.1", uptime_seconds=uptime, routes=route_count,
        environment=os.environ.get("RENDER_EXTERNAL_HOSTNAME", "unknown"),
    )


async def database_component() -> dict:
    if not (settings.supabase_url and settings.supabase_service_key):
        return _component(NOT_CONFIGURED, "Database", "Supabase URL or service key missing")
    try:
        # A minimal bounded query against a known core table.
        rows = await sb.admin_request("GET", "subjects?select=id&limit=1", timeout=4.0)
        if rows is not None:
            return _component(HEALTHY, "Database", "Supabase reachable, core table readable")
        return _component(UNREACHABLE, "Database", "Empty response from Supabase")
    except Exception as e:
        # Connection errors are environmental, not code failures.
        return _component(UNREACHABLE, "Database", f"Could not reach Supabase: {type(e).__name__}")


async def auth_component() -> dict:
    # Structural/locally-verifiable checks; no secrets.
    try:
        import backend.domains.auth as auth_mod  # noqa: F401
        has_ticket = hasattr(auth_mod, "generate_stream_ticket")
        return _component(
            HEALTHY if has_ticket else CRITICAL, "Authentication",
            "JWT verification and stream tickets present" if has_ticket else "Stream ticket machinery missing",
        )
    except Exception as e:
        return _component(CRITICAL, "Authentication", str(e))


async def telegram_component() -> dict:
    if not tg.HAS_TELEGRAM_CREDS:
        return _component(NOT_CONFIGURED, "Telegram", "Pyrogram credentials not configured")
    try:
        diag = await tg_svc.run_diagnostics()
        pyro = diag.get("pyrogram", UNKNOWN)
        if pyro == "connected":
            return _component(HEALTHY, "Telegram", "Pyrogram connected", channels=diag.get("channels", []))
        if pyro in ("not initialized", "unavailable"):
            return _component(WARNING, "Telegram", f"Pyrogram {pyro}")
        return _component(UNREACHABLE, "Telegram", str(pyro), channels=diag.get("channels", []))
    except Exception as e:
        return _component(UNREACHABLE, "Telegram", type(e).__name__)


async def streaming_component() -> dict:
    try:
        status = await stream_svc.streaming_status()
        counts = status.get("counts", {})
        missing = counts.get("missing_mapping", 0)
        state = HEALTHY if missing == 0 else WARNING
        return _component(state, "Streaming",
                          f"{missing} video(s) missing Telegram mapping",
                          limits=status.get("limits"), counts=counts)
    except Exception as e:
        return _component(UNREACHABLE, "Streaming", type(e).__name__)


def configuration_component() -> dict:
    checks = {
        "SUPABASE_URL": bool(settings.supabase_url),
        "SUPABASE_SERVICE_KEY": bool(settings.supabase_service_key),
        "JWT_SECRET": bool(getattr(settings, "jwt_secret", None)),
        "ADMIN_TOKEN": bool(getattr(settings, "admin_token", None)),
        "TELEGRAM_API_ID": bool(settings.telegram_api_id),
        "TELEGRAM_BOT_TOKEN": bool(settings.telegram_bot_token),
        "WEBHOOK_URL": bool(settings.webhook_url),
    }
    required_ok = all(checks[k] for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "JWT_SECRET"))
    optional = sum(1 for k, v in checks.items() if v)
    return _component(
        HEALTHY if required_ok else CRITICAL, "Configuration",
        f"{optional}/{len(checks)} configuration groups present",
        checks=checks,
    )


def deployment_component() -> dict:
    # Local/structural checks only. Remote service reachability is owner-verified.
    files_present = all(
        os.path.exists(p) for p in ("render.yaml", "netlify.toml", "Dockerfile",
                                     ".github/workflows/ci.yml")
    )
    return _component(
        HEALTHY if files_present else WARNING, "Deployment",
        "Local deployment configuration valid" if files_present else "Some deployment files missing",
        remote_verified=False,
    )


def backups_component() -> dict:
    workflow_exists = os.path.exists("docs/operations/db-backup.workflow.yml")
    has_secret_env = bool(os.environ.get("SUPABASE_DB_URI"))
    if not workflow_exists:
        return _component(WARNING, "Backups", "Backup workflow file not found")
    if has_secret_env:
        return _component(HEALTHY, "Backups", "SUPABASE_DB_URI present")
    return _component(WARNING, "Backups",
                      "Workflow present; SUPABASE_DB_URI GitHub secret must be set by owner",
                      secret_configured=False)


def monitoring_component() -> dict:
    keepalive = os.path.exists(".github/workflows/keep-alive.yml")
    backend_url = bool(os.environ.get("BACKEND_URL"))
    return _component(
        HEALTHY if keepalive else WARNING, "Monitoring",
        "Keep-alive workflow present" if keepalive else "No keep-alive workflow",
        external_monitor_configured=backend_url,
    )


async def full_diagnostics() -> dict:
    """Run all components with bounded timeouts where possible."""
    components = {}
    components["backend"] = await backend_component()
    components["database"] = await database_component()
    components["auth"] = await auth_component()
    components["telegram"] = await telegram_component()
    components["streaming"] = await streaming_component()
    components["configuration"] = configuration_component()
    components["deployment"] = deployment_component()
    components["backups"] = backups_component()
    components["monitoring"] = monitoring_component()

    overall = _overall(components)
    return {
        "overall_status": overall,
        "checked_at": int(time.time()),
        "components": components,
    }


def _overall(components: dict[str, dict]) -> str:
    statuses = {c["status"] for c in components.values()}
    if CRITICAL in statuses:
        return CRITICAL
    if UNREACHABLE in statuses or WARNING in statuses or NOT_CONFIGURED in statuses:
        return WARNING
    return HEALTHY


# ── Safe operational control: maintenance mode (settings-backed) ──
async def set_maintenance(enabled: bool, actor: str) -> dict:
    from backend.api.controlplane.settings import update_setting
    result = await update_setting("maintenance.enabled", enabled, actor,
                                   reason="Operations control plane")
    return {"maintenance_enabled": enabled, "result": result}


async def get_maintenance() -> bool:
    from backend.api.controlplane.settings import get_settings
    data = await get_settings()
    return bool(data.get("maintenance.enabled", False))


async def reinitialize_bot() -> dict:
    """Safe reuse of Stage 32 webhook reinitialization."""
    if not (settings.telegram_bot_token and settings.webhook_url):
        raise HTTPException(status_code=400, detail="Bot token or webhook URL not configured")
    ok = await bot_manager.initialize()
    return {"reinitialized": ok}
