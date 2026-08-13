"""
NexusEdu Backend — ASGI entry point.

This module is intentionally thin. It constructs the FastAPI app via the
factory and exposes (and bridges) the historical attribute names so that:

  * ``uvicorn backend.main:app`` keeps working (Docker/Render/Procfile),
  * existing tests that ``monkeypatch.setattr(backend.main, ...)`` continue
    to affect running request handling.

Application code must NOT import from ``backend.main`` at module load time
(that would be circular). It imports behaviour from
:mod:`backend.runtime`, :mod:`backend.domains`, :mod:`backend.integrations`
and :mod:`backend.state` instead.
"""
from __future__ import annotations

import logging
import os
from types import ModuleType

import uvicorn

from backend import runtime, state
from backend.app_factory import create_app

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("NexusEdu")

app = create_app()

# Map of legacy main.* names -> (target module, target attribute).
_RUNTIME_FUNCS = {
    "verify_supabase_token": runtime,
    "_is_user_blocked": runtime,
    "_is_user_admin": runtime,
    "_check_user_chapter_access": runtime,
    "refresh_catalog": runtime,
}
_RUNTIME_FUNC_ALIASES = {
    "_is_user_blocked": "is_user_blocked",
    "_is_user_admin": "is_user_admin",
    "_check_user_chapter_access": "check_user_chapter_access",
}
_STATE_ATTRS = {
    "supabase_client",
    "catalog_cache",
    "video_map",
    "chapter_lookup",
    "message_cache",
    "resolved_channels",
    "concurrent_user_streams",
    "channel_usage_stats",
    "_last_refresh_time",
}


def __getattr__(name):
    if name in _RUNTIME_FUNCS:
        target = _RUNTIME_FUNC_ALIASES.get(name, name)
        return getattr(runtime, target)
    if name in _STATE_ATTRS:
        return getattr(state, name)
    if name == "tg":
        return state.tg
    if name == "tg2":
        return state.tg2
    raise AttributeError(f"module 'backend.main' has no attribute {name!r}")


def __setattr__(name, value):
    if name in _RUNTIME_FUNCS:
        target = _RUNTIME_FUNC_ALIASES.get(name, name)
        setattr(runtime, target, value)
        return
    if name in _STATE_ATTRS or name in ("tg", "tg2"):
        setattr(state, name, value)
        return
    globals()[name] = value


# Re-exported (static) symbols that are safe to import directly.
from backend.domains.auth import generate_stream_ticket, verify_stream_ticket  # noqa: E402,F401
from backend.integrations import telegram_client  # noqa: E402,F401
from backend.integrations.telegram_client import (  # noqa: E402,F402
    CHANNEL_MAP,
    HAS_TELEGRAM_CREDS,
    ensure_telegram_connected,
    get_active_client,
)


async def _ensure_admin(request):
    """Legacy adapter: admin authorization dependency."""
    from backend.api.admin._deps import ensure_admin

    return await ensure_admin(request)


_ensure_admin._is_default_adapter = True  # type: ignore[attr-defined]


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
