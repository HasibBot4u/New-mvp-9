"""
Authentication & authorization domain.

Owns:
  * Supabase JWT verification (with a short in-process cache),
  * server-side block enforcement (profiles.is_blocked),
  * admin-role resolution (profiles.role + user_roles fallback),
  * chapter-enrollment authorization (chapter_access + admin override),
  * short-lived HMAC stream tickets (so the long-lived Supabase JWT never
    appears in a <video src> URL).

These functions are framework-agnostic: they take plain values and return
plain values, so they can be unit-tested without FastAPI.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import time
from typing import Optional, Tuple

import backend.runtime as runtime
from backend import state
from backend.config import settings
from backend.integrations import supabase_integration as sb

logger = logging.getLogger("NexusEdu.Auth")

_TICKET_TTL_SECONDS = 6 * 3600
_USER_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


# ── JWT verification ────────────────────────────────────────────
async def verify_supabase_token(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    if token in state._TOKEN_CACHE:
        return state._TOKEN_CACHE[token]
    user = await sb.verify_token(token)
    return user


# ── Block / admin / chapter access ──────────────────────────────
async def is_user_blocked(user_id: str) -> bool:
    return await sb.is_user_blocked(user_id)


async def is_user_admin(user_id: str) -> bool:
    return await sb.is_user_admin(user_id)


async def check_user_chapter_access(user_id: str, chapter_id: str) -> bool:
    """True if the user may watch a chapter (open chapter, valid
    chapter_access row, or admin). Fails CLOSED on unknown chapters after
    one catalog refresh."""
    if not chapter_id:
        return True
    chap_info = runtime.S.chapter_lookup.get(chapter_id)
    if chap_info and not chap_info.get("requires_enrollment"):
        return True

    if not chap_info:
        logger.info("[AuthZ] chapter_lookup miss for %s; refreshing catalog", chapter_id)
        try:
            from backend.domains import catalog

            await catalog.refresh_catalog()
        except Exception as exc:
            logger.error("[AuthZ] catalog refresh failed during access check: %s", exc)
        chap_info = runtime.S.chapter_lookup.get(chapter_id)
        if not chap_info:
            logger.warning(
                "[AuthZ] chapter %s still unknown after refresh — denying (fail-closed)",
                chapter_id,
            )
            return False
        if not chap_info.get("requires_enrollment"):
            return True

    try:
        resp = await sb.client().get(
            f"{sb.base_url()}/rest/v1/chapter_access"
            f"?user_id=eq.{user_id}&chapter_id=eq.{chapter_id}"
            f"&is_blocked=eq.false&select=id",
            headers=sb.service_headers(),
            timeout=5.0,
        )
        if resp.status_code == 200 and resp.json():
            return True
        if await is_user_admin(user_id):
            return True
    except Exception as exc:
        logger.error("[AuthZ] check_user_chapter_access error: %s", exc)
    return False


# ── Stream tickets ──────────────────────────────────────────────
def _ticket_secret() -> bytes:
    raw = ""
    if settings.jwt_secret:
        raw = settings.jwt_secret.get_secret_value()
    elif settings.admin_token:
        raw = settings.admin_token.get_secret_value()
    raw = (raw or "").strip()
    if raw:
        return raw.encode()
    # Per-boot random secret: tickets don't survive restarts but nothing leaks.
    if not hasattr(_ticket_secret, "_boot"):
        import secrets as _secrets

        _ticket_secret._boot = _secrets.token_bytes(32)  # type: ignore[attr-defined]
        logger.warning("[AuthZ] JWT_SECRET not set — stream tickets use an ephemeral secret.")
    return _ticket_secret._boot  # type: ignore[attr-defined]


def _ticket_ttl() -> int:
    """Ticket lifetime (seconds). The configured value is applied where an
    async context is available; ticket generation uses the safe constant."""
    return _TICKET_TTL_SECONDS


def generate_stream_ticket(user_id: str, video_id: str) -> Tuple[str, int]:
    ttl = _ticket_ttl()
    exp = int(time.time()) + ttl
    msg = f"{user_id}:{video_id}:{exp}".encode()
    sig = hmac.new(_ticket_secret(), msg, hashlib.sha256).hexdigest()
    return f"{user_id}:{exp}:{sig}", ttl


def verify_stream_ticket(video_id: str, ticket: str) -> Optional[str]:
    """Return the user_id encoded in a valid ticket for video_id, else None."""
    try:
        user_id, exp_str, sig = ticket.split(":", 2)
    except ValueError:
        return None
    if not user_id or not _USER_ID_RE.match(user_id):
        return None
    try:
        exp = int(exp_str)
    except ValueError:
        return None
    if exp < int(time.time()):
        return None
    msg = f"{user_id}:{video_id}:{exp}".encode()
    expected = hmac.new(_ticket_secret(), msg, hashlib.sha256).hexdigest()
    if hmac.compare_digest(expected, sig):
        return user_id
    return None
