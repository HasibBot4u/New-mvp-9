import logging
from pyrogram import Client
from typing import Optional

logger = logging.getLogger("NexusEdu.NotificationService")

class NotificationService:
    def __init__(self, app: Client):
        self.app = app
        self.admin_chat_id = None # Set this to an admin group or user ID

    def set_admin_chat_id(self, chat_id: int):
        self.admin_chat_id = chat_id

    async def notify_upload_complete(self, file_name: str, variants: list, metadata: dict):
        if not self.admin_chat_id:
            return
        
        text = f"â **Upload Complete**\n\n"
        text += f"**File:** {file_name}\n"
        text += f"**Duration:** {metadata.get('duration')}s\n"
        text += f"**Variants:** {', '.join(variants)}\n"
        
        try:
            await self.app.send_message(self.admin_chat_id, text)
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")

    async def notify_error(self, message: str, error_details: str):
        if not self.admin_chat_id:
            return
            
        text = f"â **Processing Error**\n\n"
        text += f"**Message:** {message}\n"
        text += f"**Details:** `{error_details}`\n"
        
        try:
            await self.app.send_message(self.admin_chat_id, text)
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")

    async def check_channel_capacity(self, channel_id: int):
        if not self.admin_chat_id:
            return
            
        # Placeholder logic: Telegram groups/channels theoretically have no hard file size limit
        # but maybe we limit to 1000 messages or similar estimated metric. Let's assume we warn at 90%
        # of our internal threshold.
        # e.g., if we limit a channel to 500GB total space used:
        # Just send a stub warning for now.
        pass
        
notification_service = None

def init_notification_service(app: Client):
    global notification_service
    notification_service = NotificationService(app)
    return notification_service
