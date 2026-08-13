"""
Reusable FastAPI dependencies.

These thin wrappers adapt the framework-agnostic auth domain to FastAPI's
dependency-injection system. Routes can depend on ``get_current_user`` /
``get_current_admin``, and tests remain free to call the domain functions
directly or monkeypatch them.
"""
from __future__ import annotations

import hashlib
import time
from typing import Dict, Optional

import httpx
from fastapi import Depends, Header, HTTPException, status

from backend.config import settings
from backend.integrations import supabase_integration as sb

# A dedicated short-timeout client for the per-request auth path.
_HTTP_CLIENT = httpx.AsyncClient(timeout=5.0)


class SimpleTTLCache:
    def __init__(self, ttl_seconds: int = 60, max_entries: int = 1000):
        self.ttl = ttl_seconds
        self.max_entries = max_entries
        self.cache: Dict[str, tuple[float, dict]] = {}

    def get(self, key: str) -> Optional[dict]:
        if key in self.cache:
            expires_at, val = self.cache[key]
            if time.time() < expires_at:
                return val
            del self.cache[key]
        return None

    def set(self, key: str, value: dict) -> None:
        if len(self.cache) >= self.max_entries:
            expired = [k for k, (exp, _) in self.cache.items() if time.time() >= exp]
            for k in expired:
                del self.cache[k]
            if len(self.cache) >= self.max_entries:
                self.cache.pop(next(iter(self.cache)), None)
        self.cache[key] = (time.time() + self.ttl, value)


_TOKEN_CACHE = SimpleTTLCache(ttl_seconds=60, max_entries=1000)


async def verify_token(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    cached = _TOKEN_CACHE.get(token_hash)
    if cached is not None:
        return cached

    try:
        resp = await _HTTP_CLIENT.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key.get_secret_value(),
                "Authorization": f"Bearer {token}",
            },
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Authentication service timeout")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_data = resp.json()
    _TOKEN_CACHE.set(token_hash, user_data)
    return user_data


async def get_current_user(token_data: dict = Depends(verify_token)) -> dict:
    return token_data


async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    user_id = user.get("id") or user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID missing from token")
    if not await sb.is_user_admin(user_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
