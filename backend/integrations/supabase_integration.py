"""
Supabase integration boundary.

All HTTP access to the Supabase REST / Auth / PostgREST APIs goes through
this module. It hides:
  * base URLs and service vs. anon keys,
  * connection pooling (one shared httpx client),
  * small retry helpers,

so domain/route code never constructs Supabase URLs or reads keys directly.
This makes the database dependency replaceable and testable (tests can
patch ``supabase_client`` / ``http_call``).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from backend.config import settings
from backend.core.security import secrets_manager
from backend import state

logger = logging.getLogger("NexusEdu.Supabase")


def base_url() -> str:
    return secrets_manager.get_secret("supabase_url").rstrip("/")


def service_headers() -> dict[str, str]:
    key = secrets_manager.get_secret("supabase_service_key")
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def anon_headers(token: Optional[str] = None) -> dict[str, str]:
    key = secrets_manager.get_secret("supabase_anon_key")
    headers = {"apikey": key, "Authorization": f"Bearer {token or key}"}
    return headers


def client() -> httpx.AsyncClient:
    """Shared pooled httpx client for outbound Supabase calls."""
    return state.get_http_client()


# ── Auth ────────────────────────────────────────────────────────
async def verify_token(token: str) -> Optional[dict]:
    """Validate a Supabase JWT against /auth/v1/user. Returns user dict or None."""
    if not token:
        return None
    if token in state._TOKEN_CACHE:
        return state._TOKEN_CACHE[token]
    try:
        resp = await client().get(
            f"{base_url()}/auth/v1/user",
            headers=anon_headers(token),
            timeout=5.0,
        )
        if resp.status_code == 200:
            user = resp.json()
            state._TOKEN_CACHE[token] = user
            return user
    except Exception as exc:
        logger.debug("[Supabase] token verify failed: %s", exc)
    return None


async def get_profile_role(user_id: str) -> Optional[str]:
    try:
        resp = await client().get(
            f"{base_url()}/rest/v1/profiles?select=role&id=eq.{user_id}",
            headers=service_headers(),
            timeout=5.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data[0].get("role")
    except Exception as exc:
        logger.error("[Supabase] role lookup failed: %s", exc)
    return None


async def is_user_blocked(user_id: str) -> bool:
    if user_id in state._BLOCKED_CACHE:
        return bool(state._BLOCKED_CACHE.get(user_id))
    blocked = False
    try:
        resp = await client().get(
            f"{base_url()}/rest/v1/profiles?select=is_blocked&id=eq.{user_id}",
            headers=service_headers(),
            timeout=5.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            blocked = bool(data and data[0].get("is_blocked"))
    except Exception as exc:
        logger.error("[Supabase] blocked-check error: %s", exc)
    state._BLOCKED_CACHE[user_id] = blocked
    return blocked


async def is_user_admin(user_id: str) -> bool:
    role = await get_profile_role(user_id)
    if role == "admin":
        return True
    # Fallback: legacy user_roles table.
    try:
        resp = await client().get(
            f"{base_url()}/rest/v1/user_roles"
            f"?select=role&user_id=eq.{user_id}&role=eq.admin",
            headers=service_headers(),
            timeout=5.0,
        )
        if resp.status_code == 200 and resp.json():
            return True
    except Exception:
        pass
    return False


# ── Generic PostgREST helper used by admin routes ───────────────
async def admin_request(
    method: str,
    endpoint: str,
    json_data: Optional[dict | list] = None,
    timeout: float = 10.0,
    extra_headers: Optional[dict[str, str]] = None,
) -> Any:
    """Perform a service-role PostgREST call.

    ``endpoint`` is the part after ``/rest/v1/`` (e.g. ``subjects?id=eq.x``).
    Callers are responsible for passing only validated/whitelisted input.
    ``extra_headers`` lets callers set PostgREST directives such as
    ``Prefer: resolution=merge-duplicates`` for upserts.
    """
    headers = service_headers()
    headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    kwargs: dict[str, Any] = {"headers": headers, "timeout": timeout}
    if json_data is not None:
        kwargs["json"] = json_data
    resp = await client().request(method, f"{base_url()}/rest/v1/{endpoint}", **kwargs)
    if resp.status_code >= 400:
        from fastapi import HTTPException

        raise HTTPException(resp.status_code, resp.text)
    return resp.json() if resp.text else None


async def anon_get(path: str, timeout: float = 30.0) -> Any:
    resp = await client().get(
        f"{base_url()}/rest/v1/{path}", headers=anon_headers(), timeout=timeout
    )
    resp.raise_for_status()
    return resp.json()
