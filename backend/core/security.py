"""
Security primitives.

- ``secrets_manager``: thin adapter over configuration that returns secret
  strings by name. It centralises secret access so the rest of the codebase
  does not read ``os.environ`` for credentials.
- HMAC admin-request signature verification with replay protection.
- Secure hex / password helpers.
- ``APIException`` + handler for consistent domain-error responses.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from typing import Optional

import bcrypt
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

from backend.config import settings


class SecretsManager:
    """Centralised read-only view over configured secrets.

    Values are sourced from :class:`backend.config.Settings` (validated
    environment). A future implementation could fetch from a vault without
    changing callers.
    """

    def __init__(self):
        self.refresh()

    def refresh(self) -> None:
        def _secret(v) -> str:
            return v.get_secret_value() if v is not None else ""

        self._secrets = {
            "telegram_api_id": str(settings.telegram_api_id or 0),
            "telegram_api_hash": _secret(settings.telegram_api_hash),
            "telegram_session": _secret(settings.pyrogram_session_string),
            "telegram_session_2": _secret(settings.pyrogram_session_string_2),
            "supabase_url": str(settings.supabase_url or ""),
            "supabase_service_key": _secret(settings.supabase_service_key),
            "supabase_anon_key": _secret(settings.supabase_anon_key),
            "admin_token": _secret(settings.admin_token),
        }

    def get_secret(self, key: str) -> str:
        return self._secrets.get(key, "")

    def require_admin_token(self) -> str:
        admin_token = self.get_secret("admin_token")
        if not admin_token or len(admin_token) < 32:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ADMIN_TOKEN is required and must be at least 32 characters long.",
            )
        return admin_token

    def rotate_secret(self, key: str, new_value: str) -> None:
        self._secrets[key] = new_value


secrets_manager = SecretsManager()

# ── Admin HMAC request signatures (replay-protected) ────────────
_ADMIN_NONCE_CACHE: dict[str, float] = {}
_NONCE_MAX = 10000


def _cleanup_nonce_cache() -> None:
    now = time.time()
    expired = [k for k, exp in _ADMIN_NONCE_CACHE.items() if exp < now]
    for k in expired:
        _ADMIN_NONCE_CACHE.pop(k, None)
    if len(_ADMIN_NONCE_CACHE) > _NONCE_MAX:
        oldest = sorted(_ADMIN_NONCE_CACHE.items(), key=lambda x: x[1])[: _NONCE_MAX // 2]
        for k, _ in oldest:
            _ADMIN_NONCE_CACHE.pop(k, None)


def verify_admin_signature(signature: str, payload: str, timestamp: str) -> bool:
    """Verify an HMAC-SHA256 admin signature with a 60s timestamp window."""
    try:
        ts = float(timestamp)
    except (ValueError, TypeError):
        return False
    if abs(time.time() - ts) > 60:
        return False

    nonce_key = f"{signature}:{timestamp}"
    _cleanup_nonce_cache()
    if nonce_key in _ADMIN_NONCE_CACHE:
        return False

    try:
        secret = secrets_manager.require_admin_token().encode()
    except HTTPException:
        return False
    message = f"{payload}:{timestamp}".encode()
    expected_mac = hmac.new(secret, message, hashlib.sha256).hexdigest()
    valid = hmac.compare_digest(expected_mac, signature)
    if valid:
        _ADMIN_NONCE_CACHE[nonce_key] = time.time() + 70
    return valid


def generate_secure_hex(length: int = 6) -> str:
    """Cryptographically secure uppercase hex token (e.g. enrollment codes)."""
    return secrets.token_hex(length).upper()


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


# ── Domain exception type ───────────────────────────────────────
class APIException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


async def api_exception_handler(request: Request, exc: APIException):
    return JSONResponse(status_code=exc.status_code, content={"message": exc.message})
