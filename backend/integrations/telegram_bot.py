"""
Telegram Bot API integration (webhook bot via python-telegram-bot).

This is separate from ``telegram_client`` (Pyrogram/MTProto streaming).
It owns:
  * bot configuration from environment,
  * the ``Application`` lifecycle,
  * command handlers (/start, /status, /stats, /notify, /scan ...),
  * webhook registration and inbound update processing.

The /stats and /scan commands need read access to catalog/telegram state;
they import those lazily from :mod:`backend.state` and
:mod:`backend.integrations.telegram_client` to avoid a circular import at
module load time (previously they imported ``backend.main``).
"""
from __future__ import annotations

import asyncio
import html
import logging
import os
import time
import traceback
from datetime import datetime
from typing import Any, Dict, Optional

from telegram import Update
from telegram.constants import ParseMode
from telegram.error import RetryAfter
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
)

logger = logging.getLogger(__name__)


class BotConfig:
    def __init__(self):
        self.TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        self.ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "").strip()
        self.WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "").strip()
        # Note: Supabase access in bot commands uses the shared client in
        # backend.state (lazily imported), not credentials stored here.

        self.ADMIN_IDS: list[str] = []
        if self.ADMIN_CHAT_ID:
            for aid in self.ADMIN_CHAT_ID.split(","):
                aid = aid.strip()
                if aid:
                    try:
                        self.ADMIN_IDS.append(str(int(aid)))
                    except ValueError:
                        logger.warning("Invalid ADMIN_CHAT_ID value: %s", aid)

        self.NOTIFY_ON_START = os.environ.get("BOT_NOTIFY_ON_START", "true").lower() == "true"

    def is_valid(self) -> bool:
        return bool(self.TOKEN) and bool(self.WEBHOOK_URL)

    def is_admin(self, user_id: int) -> bool:
        return str(user_id) in self.ADMIN_IDS


class BotManager:
    def __init__(self):
        self.config = BotConfig()
        self.application: Optional[Application] = None
        self._initialized = False
        self._webhook_set = False
        self._startup_message_sent = False
        self._scan_running = False

    # ── lifecycle ───────────────────────────────────────────────
    async def initialize(self) -> bool:
        if self._initialized:
            return True
        if not self.config.is_valid():
            logger.error("[BotManager] missing TELEGRAM_BOT_TOKEN or WEBHOOK_URL")
            return False
        try:
            self.application = (
                ApplicationBuilder().token(self.config.TOKEN).updater(None).build()
            )
            self._register_handlers()
            await self.application.initialize()
            await self._set_webhook()
            await self.application.start()
            self._initialized = True
            logger.info("[BotManager] bot initialized and webhook set")
            if self.config.NOTIFY_ON_START and self.config.ADMIN_IDS:
                await self._send_startup_notification()
            return True
        except Exception as exc:
            logger.error("[BotManager] failed to initialize: %s", exc)
            logger.error(traceback.format_exc())
            self.application = None
            return False

    async def shutdown(self) -> None:
        if self.application and self._initialized:
            try:
                await self.application.stop()
                await self.application.shutdown()
            except Exception as exc:
                logger.error("[BotManager] shutdown error: %s", exc)
            finally:
                self._initialized = False
                self.application = None

    async def _set_webhook(self) -> bool:
        if not self.application or self._webhook_set:
            return False
        try:
            base = self.config.WEBHOOK_URL.rstrip("/")
            webhook_path = base if base.endswith("/api/bot_webhook") else f"{base}/api/bot_webhook"
            await self.application.bot.delete_webhook(drop_pending_updates=True)
            result = await self.application.bot.set_webhook(
                url=webhook_path,
                allowed_updates=Update.ALL_TYPES,
                max_connections=40,
            )
            if result:
                self._webhook_set = True
                logger.info("[BotManager] webhook set: %s", webhook_path)
                return True
            return False
        except Exception as exc:
            logger.error("[BotManager] failed to set webhook: %s", exc)
            return False

    # ── handlers ────────────────────────────────────────────────
    def _register_handlers(self) -> None:
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
            CommandHandler("scan_cancel", self.cmd_scan_cancel),
        ]
        for h in handlers:
            self.application.add_handler(h)

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        try:
            user = update.effective_user
            is_admin = self.config.is_admin(user.id)
            text = (
                f"👋 <b>Welcome to NexusEdu Manager!</b>\n\n"
                f"User: {user.first_name}\nID: <code>{user.id}</code>\n"
                f"Admin: {'✅ Yes' if is_admin else '❌ No'}\n\n"
                f"Commands:\n/ping - alive check\n/help - all commands\n"
            )
            if is_admin:
                text += (
                    "\n<b>Admin:</b>\n/status - system status\n/stats - platform stats\n"
                    "/notify - broadcast\n/scan - scan channels\n/scan_cancel - cancel scan\n"
                )
            await update.message.reply_html(text)
        except Exception:
            await self._safe_reply(update, "⚠️ An error occurred. Please try again.")

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_html(
            "📋 <b>NexusEdu Bot Commands</b>\n\n"
            "<b>Public:</b>\n/start - start\n/help - this message\n/ping - alive\n\n"
            "<b>Admin:</b>\n/status - system status\n/stats - platform statistics\n"
            "/notify - broadcast notification\n/scan - scan channels\n/scan_cancel - cancel scan"
        )

    async def cmd_ping(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text("🏓 Pong! Bot is alive.")

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admins only.")
            return
        bot_info = await self.application.bot.get_me()
        await update.message.reply_html(
            f"📊 <b>System Status</b>\n\nBot: @{bot_info.username}\n"
            f"Webhook: {'✅ Set' if self._webhook_set else '❌ Not Set'}\n"
            f"Initialized: {'✅ Yes' if self._initialized else '❌ No'}\n"
            f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )

    async def cmd_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admins only.")
            return
        try:
            from backend import state
            from backend.integrations import telegram_client as tg

            users = videos = subjects = chapters = today_videos = most_watched = "N/A"
            if state.supabase_client is not None:
                try:
                    sb = state.supabase_client
                    uc = await sb.table("profiles").select("id", count="exact").limit(1).execute()
                    users = getattr(uc, "count", "Error")
                    vc = await sb.table("videos").select("id", count="exact").limit(1).execute()
                    videos = getattr(vc, "count", "Error")
                    sc = await sb.table("subjects").select("id", count="exact").limit(1).execute()
                    subjects = getattr(sc, "count", "Error")
                    cc = await sb.table("chapters").select("id", count="exact").limit(1).execute()
                    chapters = getattr(cc, "count", "Error")
                    yesterday = (datetime.now() - __import__("datetime").timedelta(days=1)).isoformat()
                    vt = await sb.table("videos").select("id", count="exact").gte("created_at", yesterday).limit(1).execute()
                    today_videos = getattr(vt, "count", "Error")
                    mv = await sb.table("videos").select("title,views").order("views", desc=True).limit(1).execute()
                    if mv.data:
                        most_watched = f"{mv.data[0].get('title')} ({mv.data[0].get('views', 0)} views)"
                except Exception as exc:
                    logger.error("Stats subquery error: %s", exc)

            client_status = "✅ Connected" if tg.get_active_client() else "❌ Disconnected"
            mem = psutil_memory()
            c_len = len(state.catalog_cache.get("data", {})) if state.catalog_cache.get("data") else 0
            c_time = (
                datetime.fromtimestamp(state.catalog_cache.get("timestamp", 0)).strftime("%H:%M:%S")
                if state.catalog_cache.get("timestamp") else "Never"
            )
            await update.message.reply_html(
                f"📈 <b>Platform Statistics</b>\n\n"
                f"👥 Users: {users}\n📚 Subjects: {subjects}\n📑 Chapters: {chapters}\n"
                f"🎥 Videos: {videos}\n🆕 Added Today: {today_videos}\n🔥 Most Watched: {most_watched}\n\n"
                f"🤖 <b>Bot / System</b>\nTelegram Client: {client_status}\n"
                f"Webhook Active: {self._webhook_set}\nRam Usage: {mem}\n"
                f"Catalog Cache: {c_len} items (updated {c_time})\n"
                f"Admin Count: {len(self.config.ADMIN_IDS)}\n"
                f"Timestamp: {datetime.now().isoformat()}"
            )
        except Exception as exc:
            logger.error("cmd_stats error: %s", exc)
            await update.message.reply_text(f"⚠️ Error: {exc}")

    async def cmd_notify(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admin only.")
            return
        args = context.args
        if not args:
            await update.message.reply_text("Usage: /notify <message>")
            return
        message = " ".join(args)
        if len(message) > 4000:
            await update.message.reply_text("❌ Message too long (max 4000 chars).")
            return

        channels = list({v for k, v in os.environ.items() if k.endswith("_CHANNEL_ID")})
        status_msg = await update.message.reply_text(f"📢 Sending to {len(channels)} channels...")
        success = failed = 0
        for cid_str in channels:
            try:
                channel_id = int(cid_str)
                if channel_id == 0:
                    continue
                await self.application.bot.send_message(channel_id, message, parse_mode="HTML")
                success += 1
            except RetryAfter as e:
                await asyncio.sleep(e.retry_after + 1)
                try:
                    await self.application.bot.send_message(channel_id, message, parse_mode="HTML")
                    success += 1
                except Exception:
                    failed += 1
            except Exception as exc:
                logger.error("notify %s failed: %s", cid_str, exc)
                failed += 1
            await asyncio.sleep(1)
        await status_msg.edit_text(
            f"📢 <b>Notification Complete</b>\n\nSent: {success}\nFailed: {failed}\n\n{message}",
            parse_mode="HTML",
        )

    async def cmd_scan_cancel(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admin only.")
            return
        if not self._scan_running:
            await update.message.reply_text("ℹ️ No scan running.")
            return
        self._scan_running = False
        await update.message.reply_text("🛑 Scan cancellation requested.")

    async def cmd_scan(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self.config.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admin only.")
            return
        from backend.integrations import telegram_client as tg

        if self._scan_running:
            await update.message.reply_text("⚠️ A scan is already running.")
            return
        client = tg.get_active_client()
        if not client:
            await update.message.reply_text("❌ No active Pyrogram client.")
            return

        status_msg = await update.message.reply_text("🔍 <b>Initializing channel scan...</b>", parse_mode="HTML")
        channels_to_scan = []
        for key, val in os.environ.items():
            if key.endswith("_CHANNEL_ID"):
                try:
                    cid = int(val.strip())
                    if cid != 0 and cid not in [c[1] for c in channels_to_scan]:
                        channels_to_scan.append((key, cid))
                except ValueError:
                    pass
        if not channels_to_scan:
            await status_msg.edit_text("❌ <b>No channels configured.</b>", parse_mode="HTML")
            return

        self._scan_running = True
        total_scanned = total_videos = total_documents = total_errors = 0
        per_channel: dict = {}
        last_update = time.time()
        try:
            for env_key, cid in channels_to_scan:
                if not self._scan_running:
                    break
                per_channel[env_key] = {"cid": cid, "videos": 0, "documents": 0, "total": 0, "error": None}
                try:
                    async for msg in client.get_chat_history(cid, limit=100):
                        if not self._scan_running:
                            break
                        media = msg.video or msg.document
                        if media:
                            mime = getattr(media, "mime_type", "").lower()
                            file_name = getattr(media, "file_name", "").lower()
                            is_video = (
                                msg.video is not None
                                or mime.startswith("video/")
                                or file_name.endswith((".mp4", ".mkv", ".avi", ".mov", ".webm"))
                            )
                            if is_video:
                                per_channel[env_key]["videos"] += 1
                                per_channel[env_key]["total"] += 1
                                total_videos += 1
                            else:
                                per_channel[env_key]["documents"] += 1
                                per_channel[env_key]["total"] += 1
                                total_documents += 1
                        if time.time() - last_update > 10:
                            current = total_videos + total_documents
                            await status_msg.edit_text(
                                f"⏳ <b>Scanning...</b>\nCurrent: {html.escape(env_key)}\n"
                                f"Scanned: {total_scanned}/{len(channels_to_scan)}\n"
                                f"Found: {current} items\nErrors: {total_errors}",
                                parse_mode="HTML",
                            )
                            last_update = time.time()
                    total_scanned += 1
                except Exception as exc:
                    total_errors += 1
                    per_channel[env_key]["error"] = str(exc)
        except Exception as exc:
            await update.message.reply_text(f"❌ <b>Critical error:</b>\n<pre>{html.escape(str(exc))}</pre>", parse_mode="HTML")
        finally:
            cancelled = not self._scan_running
            self._scan_running = False
            total_items = total_videos + total_documents
            report = (
                f"{'🛑 <b>Scan Cancelled</b>' if cancelled else '✅ <b>Scan Complete</b>'}\n"
                f"Channels Scanned: {total_scanned}/{len(channels_to_scan)}\n"
                f"Total Items: {total_items}\n  • Videos: {total_videos}\n  • Documents: {total_documents}\n"
                f"Errors: {total_errors}\n\n<b>Per-Channel:</b>\n"
            )
            for env_key, stats in per_channel.items():
                report += f"🔹 <b>{html.escape(env_key)}</b> (<code>{stats['cid']}</code>)\n"
                if stats.get("error"):
                    report += f"   ❌ {html.escape(stats['error'])}\n"
                else:
                    report += f"   Total: {stats['total']} | V: {stats['videos']} | D: {stats['documents']}\n"
            await self._send_long_html(status_msg, report.strip())

    async def _send_long_html(self, message, text: str) -> None:
        parts = []
        while len(text) > 4000:
            idx = text.rfind("\n", 0, 4000)
            if idx == -1:
                idx = 4000
            parts.append(text[:idx])
            text = text[idx:]
        parts.append(text)
        for i, part in enumerate(parts):
            if i == 0:
                await message.edit_text(part, parse_mode="HTML")
            else:
                await message.reply_html(part)

    # ── webhook processing ──────────────────────────────────────
    async def process_webhook(self, request_data: dict) -> bool:
        if not self.application or not self._initialized:
            logger.warning("[BotManager] cannot process webhook: not initialized")
            return False
        try:
            update = Update.de_json(data=request_data, bot=self.application.bot)
            if not update:
                return False
            logger.debug("[BotManager] processing update %s", update.update_id)
            await self.application.process_update(update)
            return True
        except Exception as exc:
            logger.error("[BotManager] webhook error: %s", exc)
            logger.error(traceback.format_exc())
            return False

    async def _safe_reply(self, update: Update, text: str) -> None:
        try:
            if update and update.message:
                await update.message.reply_text(text)
        except Exception:
            pass

    async def _send_startup_notification(self) -> None:
        if not self.application or not self.config.ADMIN_IDS:
            return
        try:
            for admin_id_str in self.config.ADMIN_IDS:
                await self.application.bot.send_message(
                    int(admin_id_str),
                    "✅ <b>NexusEdu Bot is online!</b>\n\n"
                    f"Webhook URL: {self.config.WEBHOOK_URL}\n"
                    f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    parse_mode=ParseMode.HTML,
                )
        except Exception as exc:
            logger.error("Startup notification failed: %s", exc)

    def get_webhook_info(self) -> Dict[str, Any]:
        return {
            "initialized": self._initialized,
            "webhook_set": self._webhook_set,
            "token_present": bool(self.config.TOKEN),
            "webhook_url": self.config.WEBHOOK_URL,
            "admin_count": len(self.config.ADMIN_IDS),
        }


def psutil_memory() -> str:
    try:
        import psutil

        return f"{psutil.virtual_memory().percent}%"
    except ImportError:
        return "N/A"


bot_manager = BotManager()
