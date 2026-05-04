import logging
import asyncio
from typing import Dict, Any, Optional
from pyrogram import Client, filters
from pyrogram.types import Message
import httpx
from backend.core.security import secrets_manager

logger = logging.getLogger("NexusEdu.TelegramUploadService")

class TelegramUploadService:
    def __init__(self, app: Client):
        self.app = app
        self.channel_ids = []  # Load from env or DB
        self.supabase_url = secrets_manager.get_secret("supabase_url")
        self.supabase_key = secrets_manager.get_secret("supabase_service_key")
        
        self.app.on_message(filters.video | filters.document)(self._on_new_file)

    def set_channels(self, channel_ids: list[int]):
        self.channel_ids = channel_ids
        
    async def _on_new_file(self, client: Client, message: Message):
        chat_id = message.chat.id
        if self.channel_ids and chat_id not in self.channel_ids:
            return

        logger.info(f"New file detected in channel {chat_id}")
        
        video = message.video or message.document
        if not video:
            return
            
        mime_type = getattr(video, 'mime_type', 'application/octet-stream')
        if not mime_type.startswith('video/'):
            return

        file_id = video.file_id
        file_size = video.file_size
        file_name = getattr(video, 'file_name', f"video_{message.id}.mp4")
        duration = getattr(video, 'duration', 0)
        width = getattr(video, 'width', 0)
        height = getattr(video, 'height', 0)
        
        thumb_id = None
        if hasattr(video, 'thumbs') and video.thumbs:
            thumb_id = video.thumbs[0].file_id

        # Insert to upload_queue
        payload = {
            "telegram_message_id": message.id,
            "telegram_file_id": file_id,
            "telegram_channel_id": chat_id,
            "file_name": file_name,
            "file_size": file_size,
            "mime_type": mime_type,
            "duration": duration,
            "width": width,
            "height": height,
            "thumbnail_file_id": thumb_id,
            "status": "pending"
        }
        
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    f"{self.supabase_url}/rest/v1/upload_queue",
                    headers={
                        "apikey": self.supabase_key,
                        "Authorization": f"Bearer {self.supabase_key}",
                        "Prefer": "return=minimal"
                    },
                    json=payload
                )
            logger.info(f"Queued file {file_name} from {chat_id}")
            
            # Optionally trigger background worker via task or celery
        except Exception as e:
            logger.error(f"Failed to queue file {file_name}: {str(e)}")

# Initialize in main app
def init_telegram_upload_service(app: Client):
    TUS = TelegramUploadService(app)
    return TUS
