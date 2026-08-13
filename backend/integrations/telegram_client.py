"""
Telegram MTProto integration (Pyrogram).

This is the ONLY place in the codebase that knows about Pyrogram client
objects, session strings, reconnection, dialog preloading and media
streaming. The rest of the application depends on the small public surface
exposed here (``get_active_client``, ``ensure_connected``, ``stream_range``,
``get_thumbnail_bytes``, ...), so Telegram can be replaced or disabled
without touching business logic.

When credentials are absent the module simply reports "not connected" and
all streaming endpoints degrade gracefully (503 / placeholder redirect).
"""
from __future__ import annotations

import asyncio
import io
import logging
import math
import os
import time
from typing import AsyncIterator, Optional, Tuple

from pyrogram import Client  # type: ignore

from backend.config import settings
from backend.core.security import secrets_manager
from backend import state

logger = logging.getLogger("NexusEdu.Telegram")

CHUNK_SIZE = 1024 * 1024
INITIAL_BUFFER = 512 * 1024


def _has_creds() -> bool:
    return bool(
        settings.telegram_api_id
        and settings.telegram_api_hash
        and settings.pyrogram_session_string
        and settings.pyrogram_session_string.get_secret_value()
    )


HAS_TELEGRAM_CREDS = _has_creds()

if not HAS_TELEGRAM_CREDS:
    logger.warning(
        "[Telegram] credentials incomplete. Running WITHOUT Telegram support."
    )


def _channel_map() -> dict[str, int]:
    """Subject/channel coordinates from *_CHANNEL_ID env vars."""
    mapping = {
        "physics-c1": "PHY_C1_CHANNEL_ID",
        "physics-c2": "PHY_C2_CHANNEL_ID",
        "physics-c3": "PHY_C3_CHANNEL_ID",
        "physics-c4": "PHY_C4_CHANNEL_ID",
        "physics-c5": "PHY_C5_CHANNEL_ID",
        "physics-c6": "PHY_C6_CHANNEL_ID",
        "chemistry-c1": "CHE_C1_CHANNEL_ID",
        "chemistry-c2": "CHE_C2_CHANNEL_ID",
        "chemistry-c3": "CHE_C3_CHANNEL_ID",
        "chemistry-c4": "CHE_C4_CHANNEL_ID",
        "chemistry-c5": "CHE_C5_CHANNEL_ID",
        "chemistry-c6": "CHE_C6_CHANNEL_ID",
        "math-c1": "HM_C1_CHANNEL_ID",
        "math-c2": "HM_C2_CHANNEL_ID",
        "math-c3": "HM_C3_CHANNEL_ID",
        "math-c4": "HM_C4_CHANNEL_ID",
        "math-c5": "HM_C5_CHANNEL_ID",
        "math-c6": "HM_C6_CHANNEL_ID",
    }
    out = {}
    for name, env_key in mapping.items():
        try:
            out[name] = int(os.getenv(env_key, "0") or "0")
        except ValueError:
            out[name] = 0
    return out


CHANNEL_MAP = _channel_map()

_connect_lock = asyncio.Lock()


def get_active_client() -> Optional[Client]:
    """Return a connected primary or fallback Pyrogram client, else None."""
    for client in (state.tg, state.tg2):
        if client is not None:
            try:
                if client.is_connected:
                    return client
            except Exception:
                pass
    return None


async def resolve_channel(channel_id: int | str) -> bool:
    """Verify the bot/session can see a channel (caches positives)."""
    try:
        cid = int(str(channel_id))
    except (ValueError, TypeError):
        return False
    if cid in state.resolved_channels:
        return True
    client = get_active_client()
    if client is None:
        return False
    try:
        await client.get_chat(cid)
        state.resolved_channels.add(cid)
        logger.info("[Telegram] Resolved channel %s", cid)
        return True
    except Exception as exc:
        logger.info("[Telegram] Could not resolve %s: %s", cid, exc)
        return False


async def preload_channels() -> None:
    """Pre-populate the resolved-channel set from recent dialogs."""
    try:
        from pyrogram.enums import ChatType

        client = get_active_client()
        if client is None:
            return
        count = 0
        async for dialog in client.get_dialogs():
            if count >= 100:
                break
            try:
                if dialog.chat.type in (ChatType.CHANNEL, ChatType.SUPERGROUP, ChatType.GROUP):
                    state.resolved_channels.add(dialog.chat.id)
                    count += 1
            except Exception:
                pass
        logger.info("[Telegram] %s channels/groups preloaded from dialogs.", count)
    except Exception as exc:
        logger.info("[Telegram] dialog preload error: %s", exc)


async def get_message(channel_id: int, message_id: int):
    key = f"{channel_id}_{message_id}"
    if key not in state.message_cache:
        client = get_active_client()
        if client is None:
            raise RuntimeError("No Telegram client available")
        msg = await client.get_messages(channel_id, message_id)
        if hasattr(msg, "empty") and msg.empty:
            raise RuntimeError("Telegram message is empty or was deleted")
        state.message_cache[key] = msg
    return state.message_cache.get(key)


# Backwards-compatible alias (legacy name used by main.py and callers).
ensure_telegram_connected = None  # assigned below


async def ensure_connected() -> bool:
    """Connect/reconnect Telegram clients, with a 20s positive cache."""
    now = time.time()
    if state._tg_check_ok and (now - state._tg_check_ts) < 20:
        return True

    async with _connect_lock:
        if state._tg_check_ok and (time.time() - state._tg_check_ts) < 20:
            return True

        if get_active_client() is not None:
            state._tg_check_ok = True
            state._tg_check_ts = time.time()
            return True

        logger.info("[Telegram] disconnected — reconnecting...")
        api_id = settings.telegram_api_id or 0
        api_hash = (
            settings.telegram_api_hash.get_secret_value()
            if settings.telegram_api_hash
            else ""
        )
        session = (
            settings.pyrogram_session_string.get_secret_value()
            if settings.pyrogram_session_string
            else ""
        )
        session_2 = (
            settings.pyrogram_session_string_2.get_secret_value()
            if settings.pyrogram_session_string_2
            else ""
        )

        try:
            if state.tg is not None:
                try:
                    await asyncio.wait_for(state.tg.stop(), timeout=5)
                except Exception:
                    pass
            if api_id and api_hash and session:
                state.tg = Client(
                    "nexusedu_session",
                    api_id=api_id,
                    api_hash=api_hash,
                    session_string=session,
                    in_memory=True,
                )
                await asyncio.wait_for(state.tg.start(), timeout=30)
                logger.info("[Telegram] primary reconnected.")
                asyncio.create_task(preload_channels())
                state._tg_check_ok = True
                state._tg_check_ts = time.time()
                return True
        except Exception as exc:
            logger.info("[Telegram] primary reconnect failed: %s", exc)

        if session_2:
            try:
                if state.tg2 is not None:
                    try:
                        await asyncio.wait_for(state.tg2.stop(), timeout=5)
                    except Exception:
                        pass
                state.tg2 = Client(
                    "nexusedu_session2",
                    api_id=api_id,
                    api_hash=api_hash,
                    session_string=session_2,
                    in_memory=True,
                    timeout=8,
                )
                await asyncio.wait_for(state.tg2.start(), timeout=30)
                logger.info("[Telegram] secondary client connected as fallback.")
                state._tg_check_ok = True
                state._tg_check_ts = now
                return True
            except Exception as exc:
                logger.info("[Telegram] secondary reconnect also failed: %s", exc)

        state._tg_check_ok = False
        return False


async def start_clients() -> None:
    """Background startup: connect primary + fallback clients without
    blocking application boot."""
    if not HAS_TELEGRAM_CREDS:
        logger.info("[Telegram] skipping client startup (credentials not configured).")
        return

    api_id = settings.telegram_api_id or 0
    api_hash = (
        settings.telegram_api_hash.get_secret_value()
        if settings.telegram_api_hash
        else ""
    )
    session = (
        settings.pyrogram_session_string.get_secret_value()
        if settings.pyrogram_session_string
        else ""
    )
    session_2 = (
        settings.pyrogram_session_string_2.get_secret_value()
        if settings.pyrogram_session_string_2
        else ""
    )

    try:
        logger.info("[Telegram] starting primary client (background)...")
        state.tg = Client(
            "nexusedu_session",
            api_id=api_id,
            api_hash=api_hash,
            session_string=session,
            in_memory=True,
            timeout=8,
        )
        await asyncio.wait_for(state.tg.start(), timeout=30)
        logger.info("[Telegram] primary client started.")
        await preload_channels()
    except Exception as exc:
        logger.error("[Telegram] PRIMARY STARTUP FAILED: %s", exc)
        state.tg = None

    if session_2 and api_id and api_hash:
        try:
            state.tg2 = Client(
                "nexusedu_session2",
                api_id=api_id,
                api_hash=api_hash,
                session_string=session_2,
                in_memory=True,
                timeout=8,
            )
            await asyncio.wait_for(state.tg2.start(), timeout=30)
            logger.info("[Telegram] secondary client started.")
        except Exception as exc:
            logger.info("[Telegram] secondary client failed to start: %s", exc)
            state.tg2 = None


async def stop_clients() -> None:
    for client in (state.tg, state.tg2):
        if client is not None:
            try:
                await client.stop()
            except Exception:
                pass


async def watchdog(on_change=None) -> None:
    """Periodically ensure a Telegram client is connected."""
    fail_count = 0
    while True:
        try:
            ok = await ensure_connected()
            if on_change is not None:
                on_change(ok)
            fail_count = 0
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            fail_count += 1
            fail_count = min(fail_count, 10)
            wait = min(60 * (2 ** (fail_count - 1)), 120)
            logger.info("[Telegram] watchdog fail #%s, retry in %ss: %s", fail_count, wait, exc)
            await asyncio.sleep(wait)


# ── Streaming ───────────────────────────────────────────────────
async def stream_range(
    channel_id: int, message_id: int, start: int, end: int, total: int
) -> AsyncIterator[bytes]:
    chunk_offset = start // CHUNK_SIZE
    skip_bytes = start % CHUNK_SIZE
    needed = math.ceil((end - start + 1 + skip_bytes) / CHUNK_SIZE)

    msg = await get_message(channel_id, message_id)
    client = get_active_client()
    if client is None:
        raise RuntimeError("No Telegram client available")

    bytes_sent = 0
    target = end - start + 1
    first_chunk = True

    try:
        async for chunk in client.stream_media(msg, offset=chunk_offset, limit=needed):
            data = bytes(chunk)
            if first_chunk and skip_bytes:
                data = data[skip_bytes:]
                first_chunk = False
            remaining = target - bytes_sent
            if len(data) > remaining:
                data = data[:remaining]
            if not data:
                break
            bytes_sent += len(data)
            yield data
            if bytes_sent >= target:
                break
    except Exception as exc:
        if "flood" in str(exc).lower() or "FloodWait" in type(exc).__name__:
            logger.info("[Telegram] FloodWait on stream: %s", exc)
        else:
            logger.info("[Telegram] stream error: %s", exc)


def _mime_from_media(media) -> str:
    if getattr(media, "mime_type", None):
        return media.mime_type
    file_name = (getattr(media, "file_name", "") or "").lower()
    if file_name.endswith(".mkv"):
        return "video/x-matroska"
    if file_name.endswith(".avi"):
        return "video/x-msvideo"
    if file_name.endswith(".webm"):
        return "video/webm"
    if file_name.endswith(".mov"):
        return "video/quicktime"
    return "video/mp4"


async def get_file_info(channel_id: int, message_id: int, video_id: str = None) -> Tuple[int, str]:
    if video_id:
        try:
            from backend.integrations import supabase_integration as sb

            data = await sb.admin_request(
                "GET",
                f"videos?id=eq.{video_id}&select=file_size_bytes,mime_type",
                timeout=3.0,
            )
            if data and data[0].get("file_size_bytes"):
                return int(data[0]["file_size_bytes"]), data[0].get("mime_type", "video/mp4")
        except Exception:
            pass

    msg = await get_message(channel_id, message_id)
    size = 0
    media = msg.video or msg.document
    if media:
        size = media.file_size or 0
    mime = _mime_from_media(media) if media else "video/mp4"

    if video_id and size > 0:
        asyncio.create_task(_save_file_metadata(video_id, size, mime))
    return size, mime


async def _save_file_metadata(video_id: str, size: int, mime: str) -> None:
    try:
        from backend.integrations import supabase_integration as sb

        await sb.admin_request(
            "PATCH",
            f"videos?id=eq.{video_id}",
            json_data={
                "file_size_bytes": size,
                "mime_type": mime,
                "telegram_fetched_at": "now()",
            },
            timeout=5.0,
        )
    except Exception as exc:
        logger.info("[Telegram] failed to cache file metadata: %s", exc)


async def get_thumbnail_bytes(
    channel_id: int, message_id: int, thumbnail_message_id: int = 0
) -> Optional[bytes]:
    """Return JPEG thumbnail bytes for a video, or None if unavailable."""
    client = get_active_client()
    if client is None:
        return None
    await resolve_channel(channel_id)

    thumb_channel_str = settings.thumbnail_channel_id
    if thumbnail_message_id and thumb_channel_str:
        try:
            thumb_channel_id = int(thumb_channel_str)
            await resolve_channel(thumb_channel_id)
            thumb_msg = await get_message(thumb_channel_id, thumbnail_message_id)
            if not getattr(thumb_msg, "empty", True) and thumb_msg.photo:
                return await client.download_media(thumb_msg.photo.file_id, in_memory=True)
        except Exception as exc:
            logger.info("[Telegram] thumbnail-channel fetch error: %s", exc)

    try:
        msg = await get_message(channel_id, message_id)
        if getattr(msg, "empty", False):
            return None
        media = msg.video or msg.document
        if not getattr(media, "thumbs", None):
            return None
        return await client.download_media(media.thumbs[0].file_id, in_memory=True)
    except Exception as exc:
        logger.info("[Telegram] thumbnail fetch error: %s", exc)
        return None


# Legacy alias
ensure_telegram_connected = ensure_connected
