import logging
import asyncio
from typing import Optional, AsyncGenerator

logger = logging.getLogger("NexusEdu.StreamService")

class StreamService:
    def __init__(self, clients: list):
        self.clients = [c for c in clients if c]
        self.session_index = 0
        self.segment_cache = {}  # Smart chunk caching (cache hot segments in Memory/Redis)
        
    def get_client(self):
        """Session pooling: Rotate through active Pyrogram sessions."""
        if not self.clients:
            return None
        client = self.clients[self.session_index]
        self.session_index = (self.session_index + 1) % len(self.clients)
        return client

    async def stream_byte_range(self, file_id: str, offset: int, limit: int) -> AsyncGenerator[bytes, None]:
        """Multi-connection download simulation by yielding bytes from MTProto stream."""
        # For true multi-connection, Pyrogram handles MTProto pooling internally, 
        # but we can explicitly use multiple clients.
        client = self.get_client()
        if not client:
            raise RuntimeError("No active Telegram sessions")
        
        # Stream Media using Pyrogram's native ability
        async for chunk in client.stream_media(file_id, limit=limit, offset=offset):
            yield chunk
            
    async def get_cached_segment(self, cache_key: str) -> Optional[bytes]:
        return self.segment_cache.get(cache_key)
        
    async def set_cached_segment(self, cache_key: str, data: bytes):
        # Evict old segments if memory grows (simple bounded cache)
        if len(self.segment_cache) > 200:
            self.segment_cache.clear()
        self.segment_cache[cache_key] = data

stream_service = None

def init_stream_service(clients: list):
    global stream_service
    stream_service = StreamService(clients)
    return stream_service
