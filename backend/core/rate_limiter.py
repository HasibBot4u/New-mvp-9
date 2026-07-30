import os
import time
import logging
from typing import Optional
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

# Number of trusted reverse proxy hops (Render sits in front of the app and appends the real client IP to the right end of X-Forwarded-For)
TRUSTED_PROXY_HOPS = int(os.environ.get("TRUSTED_PROXY_HOPS", "1"))

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

class DistributedRateLimiter:
    def __init__(self, use_redis: bool = True):
        self._memory_store = {}
        self.max_memory_keys = 10_000
        self.redis_client = None
        self.use_redis = use_redis
        if use_redis and REDIS_AVAILABLE:
            redis_url = os.environ.get("REDIS_URL")
            if redis_url:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
            else:
                logger.warning("REDIS_URL environment variable is not set. Attempting localhost fallback.")
                self.redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

    async def connect(self):
        """Called during application startup (FastAPI lifespan) to test Redis connection."""
        if self.redis_client:
            try:
                await self.redis_client.ping()
                logger.info("[RateLimiter] Successfully connected to Redis.")
            except Exception as e:
                logger.warning(
                    f"[RateLimiter] WARNING: Redis connection failed ({e}). "
                    "Rate limiting falling back to IN-MEMORY mode (per-process only, non-distributed)."
                )
                self.redis_client = None
        else:
            logger.warning(
                "[RateLimiter] WARNING: Redis client is not initialized. "
                "Rate limiting running in IN-MEMORY mode (per-process only, non-distributed)."
            )

    async def is_rate_limited(self, key: str, limit: int, window: int) -> bool:
        if self.redis_client:
            try:
                script = """
                local current = redis.call("incr", KEYS[1])
                if current == 1 then
                    redis.call("expire", KEYS[1], ARGV[1])
                end
                if current > tonumber(ARGV[2]) then
                    return 1
                end
                return 0
                """
                result = await self.redis_client.eval(script, 1, key, window, limit)
                return bool(result)
            except Exception:
                pass

        # In-memory fallback
        now = time.time()
        
        # Cleanup expired keys if memory store gets large
        if key not in self._memory_store and len(self._memory_store) >= self.max_memory_keys:
            expired_keys = [
                k for k, timestamps in self._memory_store.items()
                if not timestamps or (now - timestamps[-1] >= window)
            ]
            for k in expired_keys:
                del self._memory_store[k]
            
            if len(self._memory_store) >= self.max_memory_keys:
                first_key = next(iter(self._memory_store))
                del self._memory_store[first_key]

        timestamps = self._memory_store.get(key, [])
        valid_timestamps = [ts for ts in timestamps if now - ts < window]

        if not valid_timestamps:
            if key in self._memory_store:
                del self._memory_store[key]
        else:
            self._memory_store[key] = valid_timestamps

        if len(valid_timestamps) >= limit:
            return True

        if key not in self._memory_store:
            self._memory_store[key] = []
        self._memory_store[key].append(now)
        return False

rate_limiter = DistributedRateLimiter()

def get_client_ip(request: Request) -> str:
    """
    Extract real client IP honoring X-Forwarded-For securely.
    Render sits in front of the app and appends the real client IP to the right side of X-Forwarded-For.
    Reading TRUSTED_PROXY_HOPS from the right prevents client-controlled spoofed IP headers on the left.
    """
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        parts = [p.strip() for p in x_forwarded_for.split(",") if p.strip()]
        if parts:
            idx = -TRUSTED_PROXY_HOPS
            if abs(idx) <= len(parts):
                return parts[idx]
            return parts[0]
            
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()
        
    return request.client.host if request.client else "127.0.0.1"

async def check_rate_limit(request: Request, limit: int = 100, window: int = 60, prefix: str = "generic"):
    ip = get_client_ip(request)
    key = f"rate_limit:{prefix}:{ip}"
    if await rate_limiter.is_rate_limited(key, limit, window):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

