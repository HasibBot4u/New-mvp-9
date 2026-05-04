import os
import time
import logging
import httpx
import asyncio
from typing import Optional

logger = logging.getLogger("NexusEdu.NotificationService")

class NotificationService:
    def __init__(self):
        self.bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        self.admin_chat_id = os.environ.get("ADMIN_CHAT_ID")
        
        if not self.admin_chat_id:
            logger.warning("ADMIN_CHAT_ID is not set. Notifications will only be logged, not sent to Telegram.")
        if not self.bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN is not set. Telegram notifications are disabled.")

        self.notification_timestamps = []
        self._lock = asyncio.Lock()

    async def _send_telegram_message(self, text: str):
        if not self.admin_chat_id or not self.bot_token:
            logger.info(f"Fallback log (no bot setup): {text}")
            return

        # Rate limiting: max 10 per minute
        now = time.time()
        async with self._lock:
            # Remove timestamps older than 60 seconds
            self.notification_timestamps = [t for t in self.notification_timestamps if now - t < 60]
            
            if len(self.notification_timestamps) >= 10:
                logger.warning("Notification rate limit exceeded (10/min). Dropping message.")
                logger.info(f"Fallback log (rate limited): {text}")
                return
            
            self.notification_timestamps.append(now)

        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            payload = {
                "chat_id": self.admin_chat_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to send Telegram notification: {e}")
            logger.info(f"Fallback log (error): {text}")

    async def notify_admin(self, message: str):
        await self._send_telegram_message(message)

    async def notify_upload_complete(self, video_id: str, title: str):
        text = f"✅ **Upload Complete**\n\n**Video ID:** `{video_id}`\n**Title:** {title}"
        await self._send_telegram_message(text)

    async def notify_upload_error(self, video_id: str, error: str):
        text = f"❌ **Upload Error**\n\n**Video ID:** `{video_id}`\n**Error:** `{error}`"
        await self._send_telegram_message(text)

    async def notify_channel_full(self, channel_id: str):
        text = f"⚠️ **Channel Capacity Warning**\n\n**Channel ID:** `{channel_id}` is near capacity. Please allocate a new storage channel."
        await self._send_telegram_message(text)

notification_service = NotificationService()

def init_notification_service(app=None):
    global notification_service
    return notification_service

# --- Usage Examples ---
# from backend.services.notification_service import notification_service
# await notification_service.notify_admin("System is starting up...")
# await notification_service.notify_upload_complete("vid_123", "Math Chapter 1")
# await notification_service.notify_upload_error("vid_123", "File too large")
# await notification_service.notify_channel_full("-100123456789")
