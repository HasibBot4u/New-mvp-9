"""
Mutable runtime references for the backend.

Application code imports the callables below (``runtime.verify_supabase_token``,
``runtime.is_user_blocked``, ...). Each wrapper first checks whether
``backend.main`` has an attribute of the same (legacy) name installed by a
test's ``monkeypatch.setattr(backend.main, ...)`` and delegates to it;
otherwise it calls the real domain implementation.

This preserves the historical test seam without requiring routers to
import ``backend.main`` (which would create a circular import). In normal
production operation there is zero per-call overhead beyond a dict lookup.
"""
from __future__ import annotations

import sys
from functools import wraps

from backend import state
from backend.domains import auth as _auth
from backend.domains import catalog as _catalog

# Mapping: runtime attribute -> legacy backend.main attribute name.
_MAIN_OVERRIDES = {
    "verify_supabase_token": "verify_supabase_token",
    "is_user_blocked": "_is_user_blocked",
    "is_user_admin": "_is_user_admin",
    "check_user_chapter_access": "_check_user_chapter_access",
    "refresh_catalog": "refresh_catalog",
}

_REAL = {
    "verify_supabase_token": _auth.verify_supabase_token,
    "is_user_blocked": _auth.is_user_blocked,
    "is_user_admin": _auth.is_user_admin,
    "check_user_chapter_access": _auth.check_user_chapter_access,
    "refresh_catalog": _catalog.refresh_catalog,
}


def _wrap(name: str):
    real = _REAL[name]
    legacy = _MAIN_OVERRIDES[name]

    @wraps(real)
    async def wrapper(*args, **kwargs):
        main = sys.modules.get("backend.main")
        # A test may install a replacement into main.__dict__ via
        # monkeypatch.setattr. Only delegate to it when it is genuinely
        # different from this wrapper (otherwise monkeypatch teardown,
        # which restores the getattr-resolved wrapper, would recurse).
        override = vars(main).get(legacy) if main is not None else None
        if override is not None and override is not wrapper:
            return await override(*args, **kwargs)
        return await real(*args, **kwargs)

    return wrapper


verify_supabase_token = _wrap("verify_supabase_token")
is_user_blocked = _wrap("is_user_blocked")
is_user_admin = _wrap("is_user_admin")
check_user_chapter_access = _wrap("check_user_chapter_access")
refresh_catalog = _wrap("refresh_catalog")


def get_state():
    """Return the live ``state`` module (callers read attributes off it)."""
    return state


# State attributes that tests historically patch on ``backend.main``. When
# a test installs one into ``backend.main.__dict__`` we return that value;
# otherwise we return the real process state.
_STATE_OVERRIDES = (
    "video_map",
    "chapter_lookup",
    "catalog_cache",
    "concurrent_user_streams",
    "channel_usage_stats",
    "supabase_client",
    "resolved_channels",
    "message_cache",
)


def _state_attr(name: str, default=None):
    main = sys.modules.get("backend.main")
    if main is not None and name in vars(main):
        return vars(main)[name]
    return getattr(state, name, default)


class _StateProxy:
    """Attribute proxy: test overrides on ``backend.main`` win."""

    def __getattr__(self, name):
        return _state_attr(name)


S = _StateProxy()
