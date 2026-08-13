"""Shared helpers for admin routers."""
from __future__ import annotations

import re

from fastapi import HTTPException, Request

import backend.runtime as runtime
from backend.core.security import verify_admin_signature
from backend.integrations import supabase_integration as sb

_ENTITY_ID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


async def ensure_admin(request: Request) -> str:
    """Verify JWT + admin role. Returns the admin user id.

    Also stashes the user dict on ``request.state`` for audit logging.

    Test seam: if ``backend.main._ensure_admin`` has been replaced (e.g. by
    a ``monkeypatch`` fixture), delegate to it. This keeps the historical
    contract used by the validation test suite without routers importing
    ``backend.main`` at module load time.
    """
    import sys

    main = sys.modules.get("backend.main")
    override = vars(main).get("_ensure_admin") if main is not None else None
    # The default main._ensure_admin adapter delegates back here; only use a
    # different callable (e.g. one installed by a test fixture).
    if override is not None and getattr(override, "_is_default_adapter", False) is False:
        return await override(request)

    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = await runtime.verify_supabase_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        request.state.user = user
    except Exception:
        pass
    user_id = user.get("sub") or user.get("id")
    if not user_id or not await runtime.is_user_admin(user_id):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


def validate_entity_id(entity_id: str) -> None:
    if not entity_id or not _ENTITY_ID_RE.match(entity_id):
        raise HTTPException(status_code=400, detail="Invalid id format")


def ensure_admin_signature(request: Request, payload: str, required: bool = False) -> None:
    """Verify the optional HMAC second factor on admin mutations."""
    signature = request.headers.get("X-Admin-Signature")
    timestamp = request.headers.get("X-Admin-Timestamp")
    if not required and (not signature or not timestamp):
        return  # fall back to JWT admin role only
    if not signature or not timestamp:
        raise HTTPException(status_code=403, detail="Missing secure admin signature")
    if not verify_admin_signature(signature, payload, timestamp):
        raise HTTPException(status_code=403, detail="Invalid admin signature")


def filter_allowed(data: dict, allowed: set) -> dict:
    return {k: v for k, v in data.items() if k in allowed}


async def admin_rpc(method: str, endpoint: str, json_data=None):
    """Thin wrapper retained for readability inside admin routes."""
    return await sb.admin_request(method, endpoint, json_data=json_data)
