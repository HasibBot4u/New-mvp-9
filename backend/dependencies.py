import hashlib
import time
from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, Header, status
import httpx
from backend.config import settings

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

    def set(self, key: str, value: dict):
        if len(self.cache) >= self.max_entries:
            now = time.time()
            expired_keys = [k for k, (exp, _) in self.cache.items() if now >= exp]
            for k in expired_keys:
                del self.cache[k]
            if len(self.cache) >= self.max_entries:
                first_key = next(iter(self.cache))
                del self.cache[first_key]
        self.cache[key] = (time.time() + self.ttl, value)

_TOKEN_CACHE = SimpleTTLCache(ttl_seconds=60, max_entries=1000)

async def verify_token(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header"
        )
    
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing auth token"
        )

    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    cached_user = _TOKEN_CACHE.get(token_hash)
    if cached_user is not None:
        return cached_user

    anon_key = settings.supabase_anon_key.get_secret_value() if hasattr(settings.supabase_anon_key, 'get_secret_value') else str(settings.supabase_anon_key)

    try:
        resp = await _HTTP_CLIENT.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {token}"
            }
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service timeout"
        )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user_data = resp.json()
    _TOKEN_CACHE.set(token_hash, user_data)
    return user_data

async def get_current_user(token_data: dict = Depends(verify_token)) -> dict:
    return token_data

async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    user_id = user.get("id") or user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID missing from token"
        )

    service_key = settings.supabase_service_key.get_secret_value() if hasattr(settings.supabase_service_key, 'get_secret_value') else str(settings.supabase_service_key)
    
    try:
        resp = await _HTTP_CLIENT.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "role"},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}"
            }
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service timeout"
        )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not verify user role"
        )

    profiles = resp.json()
    if not profiles or not isinstance(profiles, list) or len(profiles) == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found"
        )

    role = profiles[0].get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user

