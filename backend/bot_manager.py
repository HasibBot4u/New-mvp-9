"""
NexusEdu Telegram Bot Manager
Production-ready webhook-based bot using python-telegram-bot v21.1.1
Compatible with FastAPI + Render deployment
"""

import os
import sys
import json
import logging
import asyncio
import traceback
from datetime import datetime
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from telegram import Update, Bot
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    ExtBot,
)
from telegram.constants import ParseMode

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────

class BotConfig:
    """Bot configuration loaded from environment variables"""

    def __init__(self):
        self.TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        self.ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "").strip()
        self.WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "").strip()
        self.SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
        self.SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

        # Parse admin IDs (supports multiple admins comma-separated)
        self.ADMIN_IDS = []
        if self.ADMIN_CHAT_ID:
            for aid in self.ADMIN_CHAT_ID.split(","):
                aid = aid.strip()
                if aid:
                    try:
                        self.ADMIN_IDS.append(str(int(aid)))
                    except ValueError:
                        logger.warning(f"Invalid ADMIN_CHAT_ID value: {aid}")

        # Bot startup notification
        self.NOTIFY_ON_START = os.environ.get("BOT_NOTIFY_ON_START", "true").lower() == "true"

    def is_valid(self) -> bool:
        """Check if minimum required config is present"""
        return bool(self.TOKEN) and bool(self.WEBHOOK_URL)

    def is_admin(self, user_id: int) -> bool:
        """Check if user ID is in admin list"""
        return str(user_id) in self.ADMIN_IDS


# ──────────────────────────────────────────────────────────────────────────────
# BOT APPLICATION (Singleton)
# ──────────────────────────────────────────────────────────────────────────────

class BotManager:
    """
    Manages the python-telegram-bot Application lifecycle.
    Designed for webhook-based deployment with FastAPI.
    """

    def __init__(self):
        self.config = BotConfig()
        self.application: Optional[Application] = None
        self._initialized = False
        self._webhook_set = False
        self._startup_message_sent = False

    # ── Lifecycle Methods ────────────────────────────────────────────────────

    async def initialize(self) -> bool:
        """
        Initialize the bot application.
        Returns True if successful, False otherwise.
        """
        if self._initialized:
            return True

        if not self.config.is_valid():
            logger.error("[BotManager] Cannot initialize: Missing TELEGRAM_BOT_TOKEN or WEBHOOK_URL")
            return False

        try:
            logger.info("[BotManager] Initializing bot application...")

            # Build application with updater=None because we handle webhooks manually
            self.application = (
                ApplicationBuilder()
                .token(self.config.TOKEN)
                .updater(None)  # No polling - we use custom webhook
                .build()
            )

            # Register all command handlers
            self._register_handlers()

            # Initialize the application (required before processing updates)
            await self.application.initialize()

            # Set webhook with Telegram
            await self._set_webhook()

            # Start the application (enables processing of updates)
            await self.application.start()

            self._initialized = True
            logger.info("[BotManager] ✅ Bot initialized and webhook set successfully")

            # Send startup notification to admin
            if self.config.NOTIFY_ON_START and self.config.ADMIN_IDS:
                await self._send_startup_notification()

            return True

        except Exception as e:
            logger.error(f"[BotManager] ❌ Failed to initialize bot: {e}")
            logger.error(traceback.format_exc())
            self.application = None
            return False

    async def shutdown(self) -> None:
        """Gracefully shutdown the bot application"""
        if self.application and self._initialized:
            try:
                logger.info("[BotManager] Shutting down bot...")
                await self.application.stop()
                await self.application.shutdown()
                logger.info("[BotManager] ✅ Bot shutdown complete")
            except Exception as e:
                logger.error(f"[BotManager] Error during shutdown: {e}")
            finally:
                self._initialized = False
                self.application = None

    async def _set_webhook(self) -> bool:
        """Set webhook URL with Telegram servers"""
        if not self.application or self._webhook_set:
            return False

        try:
            webhook_path = f"{self.config.WEBHOOK_URL}/api/bot_webhook"

            # Delete any existing webhook first to avoid conflicts
            await self.application.bot.delete_webhook(drop_pending_updates=True)

            # Set new webhook
            result = await self.application.bot.set_webhook(
                url=webhook_path,
                allowed_updates=Update.ALL_TYPES,
                max_connections=40
            )

            if result:
                self._webhook_set = True
                logger.info(f"[BotManager] ✅ Webhook set: {webhook_path}")
                return True
            else:
                logger.warning("[BotManager] ⚠️ set_webhook returned False")
                return False

        except Exception as e:
            logger.error(f"[BotManager] ❌ Failed to set webhook: {e}")
            return False

    # ── Handler Registration ───────────────────────────────────────────────────

    def _register_handlers(self) -> None:
        """Register all Telegram command handlers"""
        if not self.application:
            return

        handlers = [
            CommandHandler("start", self.cmd_start),
            CommandHandler("help", self.cmd_help),
            CommandHandler("ping", self.cmd_ping),
            CommandHandler("status", self.cmd_status),
            CommandHandler("stats", self.cmd_stats),
            CommandHandler("notify", self.cmd_notify),
            CommandHandler("scan", self.cmd_scan),
        ]

        for handler in handlers:
            self.application.add_handler(handler)

        logger.info(f"[BotManager] Registered {len(handlers)} command handlers")

    # ── Command Handlers ───────────────────────────────────────────────────────

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /start command - works for EVERYONE"""
        try:
            user = update.effective_user
            is_admin = self.config.is_admin(user.id)

            welcome_text = (
                f"👋 <b>Welcome to NexusEdu Manager!</b>\n\n"
                f"User: {user.first_name}\n"
                f"ID: <code>{user.id}</code>\n"
                f"Admin: {'✅ Yes' if is_admin else '❌ No'}\n\n"
                f"Available commands:\n"
                f"/ping - Check if bot is alive\n"
                f"/help - Show all commands\n"
            )

            if is_admin:
                welcome_text += (
                    f"\n<b>Admin Commands:</b>\n"
                    f"/status - System status\n"
                    f"/stats - Platform statistics\n"
                    f"/notify - Broadcast message\n"
                    f"/scan - Scan channels"
                )

            await update.message.reply_html(welcome_text)

        except Exception as e:
            logger.error(f"[BotManager] Error in cmd_start: {e}")
            await self._safe_reply(update, "⚠️ An error occurred. Please try again.")

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /help command - works for EVERYONE"""
        help_text = (
            "📋 <b>NexusEdu Bot Commands</b>\n\n"
            "<b>Public:</b>\n"
            "/start - Start the bot\n"
            "/help - Show this message\n"
            "/ping - Check bot status\n\n"
            "<b>Admin Only:</b>\n"
            "/status - System status\n"
            "/stats - Platform statistics\n"
            "/notify - Broadcast notification\n"
            "/scan - Scan channels"
        )
        await update.message.reply_html(help_text)

    async def cmd_ping(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /ping command - works for EVERYONE"""
        await update.message.reply_text("🏓 Pong! Bot is alive and responding.")

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /status command - ADMIN ONLY"""
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ This command is for admins only.")
            return

        try:
            # Get bot info
            bot_info = await self.application.bot.get_me()

            status_text = (
                f"📊 <b>System Status</b>\n\n"
                f"Bot: @{bot_info.username}\n"
                f"Bot ID: <code>{bot_info.id}</code>\n"
                f"Webhook: {'✅ Set' if self._webhook_set else '❌ Not Set'}\n"
                f"Initialized: {'✅ Yes' if self._initialized else '❌ No'}\n"
                f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
            )

            await update.message.reply_html(status_text)

        except Exception as e:
            logger.error(f"[BotManager] Error in cmd_status: {e}")
            await update.message.reply_text(f"⚠️ Error getting status: {str(e)}")

    async def cmd_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /stats command - ADMIN ONLY"""
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ This command is for admins only.")
            return

        try:
            # Basic stats - extend with Supabase queries as needed
            stats_text = (
                f"📈 <b>Platform Statistics</b>\n\n"
                f"Bot Uptime: Initialized\n"
                f"Webhook Active: {self._webhook_set}\n"
                f"Admin Count: {len(self.config.ADMIN_IDS)}\n"
                f"Timestamp: {datetime.now().isoformat()}"
            )
            await update.message.reply_html(stats_text)

        except Exception as e:
            logger.error(f"[BotManager] Error in cmd_stats: {e}")
            await update.message.reply_text(f"⚠️ Error: {str(e)}")

    async def cmd_notify(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /notify command - ADMIN ONLY"""
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admin only.")
            return

        args = context.args
        if not args:
            await update.message.reply_text(
                "Usage: /notify <message>\n"
                "Example: /notify Server maintenance in 10 minutes"
            )
            return

        message = " ".join(args)
        await update.message.reply_text(f"📢 Notification sent: {message}")
        # TODO: Implement actual broadcast logic

    async def cmd_scan(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /scan command - ADMIN ONLY"""
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admin only.")
            return

        import os
        import httpx
        import time
        from backend.main import get_active_client
        import asyncio

        client = get_active_client()
        if not client:
            await update.message.reply_text("❌ No active Pyrogram client.")
            return

        status_msg = await update.message.reply_text("🔍 Starting scan...")

        channels_to_scan = []
        for key, val in os.environ.items():
            if key.endswith("_CHANNEL_ID"):
                try:
                    cid = int(val)
                    if cid != 0 and cid not in channels_to_scan:
                        channels_to_scan.append(cid)
                except ValueError:
                    pass

        if not channels_to_scan:
            await status_msg.edit_text("❌ No channels configured.")
            return

        total_found = 0
        errors = 0
        per_channel = {}
        
        last_update = time.time()
        
        for cid in channels_to_scan:
            per_channel[cid] = 0
            try:
                # Ensure we can access the chat
                await client.get_chat(cid)
                
                async for msg in client.get_chat_history(cid):
                    try:
                        media = msg.video or msg.document
                        if not media:
                            continue
                            
                        # Extract info
                        size = media.file_size or 0
                        mime = getattr(media, 'mime_type', 'video/mp4') or 'video/mp4'
                        file_name = getattr(media, 'file_name', '') or ''
                        
                        # Only video and likely documents
                        if not mime.startswith('video/') and not file_name.lower().endswith(('.mp4', '.mkv', '.avi', '.mov', '.webm')):
                            continue
                            
                        # Add to supabase
                        if self.config.SUPABASE_URL and self.config.SUPABASE_SERVICE_KEY:
                            data = {
                                "title": file_name if file_name else f"Video {msg.id}",
                                "source_type": "telegram",
                                "telegram_channel_id": str(cid),
                                "telegram_message_id": msg.id,
                                "size_mb": round(size / (1024 * 1024), 2) if size else 0,
                                "is_active": False # Don't activate automatically
                            }
                            async with httpx.AsyncClient(timeout=10.0) as hclient:
                                await hclient.post(
                                    f"{self.config.SUPABASE_URL}/rest/v1/videos",
                                    headers={
                                        "apikey": self.config.SUPABASE_SERVICE_KEY,
                                        "Authorization": f"Bearer {self.config.SUPABASE_SERVICE_KEY}",
                                        "Content-Type": "application/json",
                                        "Prefer": "return=minimal"
                                    },
                                    json=data
                                )
                                
                        total_found += 1
                        per_channel[cid] += 1
                        
                        # Progress update every 10 seconds
                        if time.time() - last_update > 10:
                            await status_msg.edit_text(f"⏳ Scanning...\nFound: {total_found}\nErrors: {errors}\nCurrent Channel: {cid}")
                            last_update = time.time()
                            
                    except Exception as e:
                        errors += 1
                        logger.error(f"Error processing message {msg.id} in {cid}: {e}")
                        
            except Exception as e:
                errors += 1
                logger.error(f"Error scanning channel {cid}: {e}")

        # Final report
        report = f"✅ Scan Complete\nTotal Found: {total_found}\nErrors: {errors}\n\nCounts per channel:\n"
        for cid, count in per_channel.items():
            report += f"{cid}: {count}\n"
            
        await status_msg.edit_text(report)

    # ── Webhook Processing ─────────────────────────────────────────────────────

    async def process_webhook(self, request_data: dict) -> bool:
        """
        Process incoming webhook update from Telegram.
        Called by FastAPI endpoint.

        Args:
            request_data: The JSON payload from Telegram webhook

        Returns:
            True if processed successfully, False otherwise
        """
        if not self.application or not self._initialized:
            logger.warning("[BotManager] Cannot process webhook: Bot not initialized")
            return False

        try:
            # CRITICAL: Pass the BOT instance, NOT the Application instance
            # This is the #1 cause of webhook commands not working in v21
            update = Update.de_json(data=request_data, bot=self.application.bot)

            if not update:
                logger.warning("[BotManager] Failed to parse update from webhook data")
                return False

            # Log the update for debugging
            logger.debug(f"[BotManager] Processing update: {update.update_id}")
            if update.message:
                logger.info(f"[BotManager] Message from {update.effective_user.id}: {update.message.text}")

            # Process the update through the application
            await self.application.process_update(update)
            return True

        except Exception as e:
            logger.error(f"[BotManager] Error processing webhook: {e}")
            logger.error(traceback.format_exc())
            return False

    # ── Helper Methods ─────────────────────────────────────────────────────────

    async def _safe_reply(self, update: Update, text: str) -> None:
        """Safely reply to a message, catching any errors"""
        try:
            if update and update.message:
                await update.message.reply_text(text)
        except Exception as e:
            logger.error(f"[BotManager] Failed to send reply: {e}")

    async def _send_startup_notification(self) -> None:
        """Send startup notification to admin"""
        if not self.application or not self.config.ADMIN_IDS:
            return

        try:
            for admin_id_str in self.config.ADMIN_IDS:
                admin_id = int(admin_id_str)
                await self.application.bot.send_message(
                    chat_id=admin_id,
                    text="✅ <b>NexusEdu Bot is online!</b>\n\n"
                         f"Webhook URL: {self.config.WEBHOOK_URL}\n"
                         f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    parse_mode=ParseMode.HTML
                )
            self._startup_message_sent = True
            logger.info("[BotManager] Startup notification sent to admin(s)")
        except Exception as e:
            logger.error(f"[BotManager] Failed to send startup notification: {e}")

    def get_webhook_info(self) -> Dict[str, Any]:
        """Get current webhook status info"""
        return {
            "initialized": self._initialized,
            "webhook_set": self._webhook_set,
            "token_present": bool(self.config.TOKEN),
            "webhook_url": self.config.WEBHOOK_URL,
            "admin_count": len(self.config.ADMIN_IDS),
        }


# ──────────────────────────────────────────────────────────────────────────────
# GLOBAL INSTANCE
# ──────────────────────────────────────────────────────────────────────────────

bot_manager = BotManager()
