"""
Optional multi-layer cache (in-process memory + Redis).

Redis is used only when ``REDIS_URL`` is configured AND the ``redis``
package is available; otherwise the cache degrades silently to an
in-process dict. This module is self-contained and never imports the
application's request layer, so it can be unit-tested in isolation.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from backend.config import settings

logger = logging.getLogger("NexusEdu.Cache")

try:
    import redis.asyncio as aioredis  # type: ignore

    _REDIS_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    aioredis = None  # type: ignore
    _REDIS_AVAILABLE = False


class MultiLayerCache:
    """Layer 4 = in-memory dict, Layer 3 = Redis (when available)."""

    def __init__(self):
        self._memory_cache: dict[str, Any] = {}
        self._redis: Any = None
        self._memory_ttl = 240
        self._redis_ttl = 3600

    async def connect(self) -> None:
        if settings.redis_url and _REDIS_AVAILABLE:
            try:
                self._redis = aioredis.from_url(
                    settings.redis_url, encoding="utf-8", decode_responses=True
                )
                await self._redis.ping()
                logger.info("[Cache] Connected to Redis")
            except Exception as exc:
                logger.warning("[Cache] Redis unavailable, using memory only: %s", exc)
                self._redis = None

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.close()
            except Exception:
                pass

    async def get(self, key: str) -> Optional[Any]:
        if key in self._memory_cache:
            return self._memory_cache[key]
        if self._redis is not None:
            val = await self._redis.get(key)
            if val is not None:
                try:
                    data = json.loads(val)
                except Exception:
                    data = val
                self._memory_cache[key] = data
                return data
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        self._memory_cache[key] = value
        if self._redis is not None:
            str_val = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
            await self._redis.set(key, str_val, ex=ttl or self._redis_ttl)

    async def delete(self, key: str) -> None:
        self._memory_cache.pop(key, None)
        if self._redis is not None:
            await self._redis.delete(key)


cache = MultiLayerCache()


class Cache:
    """Backwards-compatible class-style accessor."""

    @classmethod
    async def get(cls, key: str):
        return await cache.get(key)

    @classmethod
    async def set(cls, key: str, value: Any, ttl: int = 3600):
        return await cache.set(key, value, ttl)
