"""
Shared in-process state for the NexusEdu backend.

This module is the single owner of mutable process-global state (caches,
Telegram client handles, catalog indexes, concurrency counters). Keeping it
in one place prevents circular imports between routers, services and the
lifespan bootstrapper, and makes the state easy to reset in tests.

Nothing in here performs I/O at import time.
"""
from __future__ import annotations

import time
from collections import OrderedDict, defaultdict
from typing import Optional

import httpx

try:  # Supabase is optional at import time — the app degrades without it.
    from supabase import AsyncClient as SupabaseClient  # type: ignore
except Exception:  # pragma: no cover - import guard
    SupabaseClient = None  # type: ignore


class LRUDict:
    """Bounded LRU dict with per-entry TTL (seconds)."""

    def __init__(self, max_size: int = 300, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._store: "OrderedDict" = OrderedDict()

    def __setitem__(self, key, value):
        if key in self._store:
            del self._store[key]
        elif len(self._store) >= self.max_size:
            self._store.popitem(last=False)
        self._store[key] = (value, time.time())

    def __getitem__(self, key):
        if key not in self._store:
            raise KeyError(key)
        value, ts = self._store[key]
        if time.time() - ts > self.ttl:
            del self._store[key]
            raise KeyError(key)
        self._store.move_to_end(key)
        return value

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def __contains__(self, key):
        try:
            self[key]
            return True
        except KeyError:
            return False

    def __len__(self):
        return len(self._store)


# ── Supabase ────────────────────────────────────────────────────
# The async Supabase client is created during lifespan startup.
supabase_client: "Optional[SupabaseClient]" = None  # type: ignore[valid-type]

# ── Telegram (Pyrogram) clients ─────────────────────────────────
# Primary + optional secondary/fallback MTProto client used for streaming.
tg = None
tg2 = None
_tg_check_ts: float = 0.0
_tg_check_ok: bool = False

# ── Catalog in-memory view ──────────────────────────────────────
# catalog_cache mirrors the public /api/catalog payload; video_map maps a
# video id to its streaming coordinates; chapter_lookup drives authz.
catalog_cache: dict = {"data": None, "timestamp": 0}
video_map: dict = {}
chapter_lookup: dict = {}
message_cache: LRUDict = LRUDict(max_size=300, ttl_seconds=3600)
resolved_channels: set = set()

# ── Auth / authz caches ─────────────────────────────────────────
_TOKEN_CACHE = LRUDict(max_size=5000, ttl_seconds=300)
_BLOCKED_CACHE = LRUDict(max_size=5000, ttl_seconds=60)

# ── Concurrency / metrics ───────────────────────────────────────
concurrent_user_streams: "defaultdict" = defaultdict(int)
channel_usage_stats: dict = {}
_last_refresh_time: float = 0.0

# ── Shared HTTP client (connection pooling) ─────────────────────
_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=10.0)
    return _http_client


def get_shared_http() -> httpx.AsyncClient:
    """Backwards-compatible alias used on hot auth/streaming paths."""
    return get_http_client()


async def close_http_client() -> None:
    """Close the shared httpx client on shutdown (called from lifespan)."""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
