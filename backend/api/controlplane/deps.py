"""Helpers shared by Control Plane endpoints.

Every endpoint authenticates the JWT, confirms the user is an admin, and
optionally checks a granular permission. All writes are recorded in
``admin_audit_events``. The backend uses the service role (which bypasses
RLS); nothing here trusts the frontend for authorization.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import HTTPException, Request

import backend.runtime as runtime
from backend.api.admin._deps import ensure_admin
from backend.integrations import supabase_integration as sb


async def require_permission(request: Request, permission: str) -> str:
    """Authenticate + authorize. Returns the admin user id.

    The owner (``profiles.role='admin'``) always passes via the
    ``has_admin_permission`` SQL helper; custom roles need the permission
    granted.
    """
    user_id = await ensure_admin(request)
    # Super-admin short-circuit is inside SQL, but we also check here for a
    # clear 403 (instead of an empty result).
    if not await _has_permission(user_id, permission):
        raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
    return user_id


async def _has_permission(user_id: str, permission: str) -> bool:
    try:
        resp = await sb.client().rpc(
            "has_admin_permission", {"p_permission": permission},
            headers=sb.service_headers(), timeout=5.0,
        )
        if resp.status_code == 200:
            return bool(resp.json())
    except Exception:  # pragma: no cover - fail-closed
        pass
    # Fallback: only the super-admin is allowed if the helper is unavailable.
    return await runtime.is_user_admin(user_id)


def _client_ip(request: Request) -> Optional[str]:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:45]
    return request.client.host if request.client else None


async def record_audit(
    request: Request,
    actor_id: str,
    action: str,
    resource: str,
    resource_id: Optional[str] = None,
    before: Any = None,
    after: Any = None,
    result: str = "success",
) -> None:
    """Best-effort immutable audit insert. Never blocks the response."""
    import asyncio

    payload = {
        "actor_id": actor_id,
        "action": action[:100],
        "resource": resource[:100],
        "resource_id": resource_id,
        "before_state": before,
        "after_state": after,
        "result": result[:30],
        "request_id": request.headers.get("x-request-id"),
        "ip_address": _client_ip(request),
        "user_agent": (request.headers.get("user-agent") or "")[:300],
    }
    asyncio.create_task(_write_audit(payload))


async def _write_audit(payload: dict) -> None:
    try:
        await sb.service_request(
            "POST", "/rest/v1/admin_audit_events", json=payload, timeout=5.0
        )
    except Exception:
        # Audit failures must not break the admin action; the operation
        # itself has already succeeded.
        import logging
        logging.getLogger("NexusEdu").warning("audit write failed: %s", payload.get("action"))


def is_sensitive_setting(key: str) -> bool:
    """Settings whose value must never be serialized back to clients."""
    k = key.lower()
    return any(t in k for t in ("secret", "token", "password", "session", "private_key", "service_key"))
