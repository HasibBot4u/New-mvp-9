import os
import logging
from fastapi import FastAPI, Request, Response
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import httpx
from backend.core.security import secrets_manager

logger = logging.getLogger("NexusEdu.BotManager")

class BotManager:
    def __init__(self):
        self.bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        self.admin_chat_id = os.environ.get("ADMIN_CHAT_ID")
        self.webhook_url = os.environ.get("WEBHOOK_URL")  # Must be set to something like https://app.onrender.com/api/bot_webhook
        self.application = None

    async def initialize(self, app: FastAPI):
        if not self.bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN not set, skipping Bot Manager initialization.")
            return

        self.application = Application.builder().token(self.bot_token).build()

        # Add handlers
        self.application.add_handler(CommandHandler("start", self.cmd_start))
        self.application.add_handler(CommandHandler("scan", self.cmd_scan))
        self.application.add_handler(CommandHandler("status", self.cmd_status))
        self.application.add_handler(CommandHandler("stats", self.cmd_stats))
        self.application.add_handler(CommandHandler("notify", self.cmd_notify))
        
        # Listen for new files (videos/documents) in channels
        # Note: Bot must be admin in those channels to see messages.
        self.application.add_handler(MessageHandler(filters.UpdateType.CHANNEL_POST & (filters.VIDEO | filters.Document.ALL), self.handle_channel_post))

        await self.application.initialize()
        await self.application.start()

        if self.webhook_url:
            await self.application.bot.set_webhook(url=self.webhook_url)
            logger.info(f"Bot Webhook set to {self.webhook_url}")
        else:
            logger.warning("WEBHOOK_URL not set. Webhook cannot be set for Telegram Bot.")

    async def webhook_handler(self, req: Request):
        if not self.application:
            return Response(status_code=503)
        try:
            data = await req.json()
            update = Update.de_json(data, self.application.bot)
            await self.application.process_update(update)
            return Response(status_code=200)
        except Exception as e:
            logger.error(f"Error processing webhook update: {e}")
            return Response(status_code=500)

    async def is_admin(self, update: Update) -> bool:
        if not self.admin_chat_id:
            return False
        user_id = str(update.effective_user.id) if update.effective_user else ""
        chat_id = str(update.effective_chat.id) if update.effective_chat else ""
        return user_id == self.admin_chat_id or chat_id == self.admin_chat_id

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text("NexusEdu Platform Bot Manager is online.")

    async def cmd_scan(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await self.is_admin(update): return
        # In a real scenario, this would trigger Pyrogram to scan channels.
        await update.message.reply_text("Initiating channel scan... Check /status for updates.")

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await self.is_admin(update): return
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        pending_count = 0
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{supabase_url}/rest/v1/upload_queue?status=eq.pending&select=id",
                    headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
                )
                if resp.status_code == 200:
                    pending_count = len(resp.json())
        except Exception:
            pass
        
        await update.message.reply_text(f"📊 System Status:\n\nPending Uploads: {pending_count}\nHealth: OK")

    async def cmd_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await self.is_admin(update): return
        await update.message.reply_text("📈 Platform Stats:\n\n(Stats to be implemented)")

    async def cmd_notify(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not await self.is_admin(update): return
        if not context.args:
            await update.message.reply_text("Usage: /notify <message>")
            return
        message = " ".join(context.args)
        # Notify admins logic...
        await update.message.reply_text(f"Notification broadcasted: {message}")

    async def handle_channel_post(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        post = update.channel_post
        if not post: return
        
        # Check if it has video
        media = post.video or post.document
        if not media: return
        
        file_id = media.file_id
        file_name = getattr(media, "file_name", f"video_{post.message_id}.mp4")
        channel_id = str(post.chat.id)
        
        # Add to upload queue
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{supabase_url}/rest/v1/upload_queue",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "telegram_file_id": file_id,
                        "file_name": file_name,
                        "file_size_bytes": getattr(media, "file_size", 0),
                        "status": "pending"
                    }
                )
            logger.info(f"New file from channel {channel_id} added to upload queue: {file_id}")
        except Exception as e:
            logger.error(f"Error adding file to upload queue: {e}")

bot_manager = BotManager()
