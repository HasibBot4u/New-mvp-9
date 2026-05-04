import json
from typing import Any, Optional, Union
import aioredis
from backend.config import get_settings

settings = get_settings()

class MultiLayerCache:
    """
    Multi-layer caching strategy:
    Layer 4: In-memory dictionary (fastest, smallest capacity)
    Layer 3: Redis cache (shared across instances, larger capacity)
    Layer 2/1: CDN and Browser (handled via headers)
    """
    def __init__(self):
        self._memory_cache = {}
        self._redis: Optional[aioredis.Redis] = None
        self._memory_ttl = 240 # 4 minutes
        self._redis_ttl = 3600 # 1 hour

    async def connect(self):
        if settings.redis_url and not self._redis:
            try:
                self._redis = await aioredis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
            except:
                pass

    async def close(self):
        if self._redis:
            await self._redis.close()

    async def get(self, key: str) -> Optional[Any]:
        # Layer 4
        if key in self._memory_cache:
            return self._memory_cache[key]

        # Layer 3
        if self._redis:
            val = await self._redis.get(key)
            if val:
                try:
                    data = json.loads(val)
                except:
                    data = val
                self._memory_cache[key] = data
                return data

        return None

    async def set(self, key: str, value: Any, ttl: int = None):
        # Layer 4
        self._memory_cache[key] = value

        # Layer 3
        if self._redis:
            str_val = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
            await self._redis.set(key, str_val, ex=ttl or self._redis_ttl)

    async def delete(self, key: str):
        if key in self._memory_cache:
            del self._memory_cache[key]
        if self._redis:
            await self._redis.delete(key)

cache = MultiLayerCache()

# For backwards compatibility with other modules that might use `Cache`
class Cache:
    @classmethod
    async def get(cls, key: str):
        return await cache.get(key)
        
    @classmethod
    async def set(cls, key: str, value: Any, ttl: int = 3600):
        await cache.set(key, value, ttl)
