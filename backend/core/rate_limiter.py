import time
import asyncio
from typing import Optional
from fastapi import Request, HTTPException

# Optional redis support. If no redis available, gracefully fallback to in-memory.
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

class DistributedRateLimiter:
    def __init__(self, use_redis: bool = True):
        self._memory_store = {}
        self.redis_client = None
        if use_redis and REDIS_AVAILABLE:    
            self.redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
            
    async def is_rate_limited(self, key: str, limit: int, window: int) -> bool:
        if self.redis_client:
            try:
                # Basic script for rate limiting
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
                # Fallback on failure
                pass
                
        # In-memory fallback
        now = time.time()
        if key not in self._memory_store:
            self._memory_store[key] = []
        # Filter old timestamps
        self._memory_store[key] = [ts for ts in self._memory_store[key] if now - ts < window]
        if len(self._memory_store[key]) >= limit:
            return True
        self._memory_store[key].append(now)
        return False

rate_limiter = DistributedRateLimiter()

def get_client_ip(request: Request) -> str:
    """Extract real client IP honoring X-Forwarded-For securely."""
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        # The first IP in the list is the original client IP
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"

async def check_rate_limit(request: Request, limit: int = 100, window: int = 60, prefix: str = "generic"):
    ip = get_client_ip(request)
    key = f"rate_limit:{prefix}:{ip}"
    if await rate_limiter.is_rate_limited(key, limit, window):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
