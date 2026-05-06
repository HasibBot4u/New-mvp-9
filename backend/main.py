"""
NexusEdu Backend — Fixed Version v1.2.0
- Non-blocking Telegram startup
- Graceful fallback when credentials missing
- Better error handling and logging
"""
import asyncio
import math
import time
import os
import logging
import traceback

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('NexusEdu')

import sys
from contextlib import asynccontextmanager
from typing import Optional, Tuple
from collections import OrderedDict
from functools import wraps
from pydantic import BaseModel, constr, Field

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, Response, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pyrogram import Client
from pyrogram.errors import FloodWait

from backend.core.security import secrets_manager, verify_admin_signature, generate_secure_hex
from backend.core.rate_limiter import check_rate_limit, rate_limiter
from backend.middleware.audit_middleware import AuditMiddleware
from backend.services.telegram_upload_service import init_telegram_upload_service
from backend.services.notification_service import init_notification_service
from backend.workers.upload_worker import UploadWorker
from bot_manager import bot_manager
from backend.api.admin.upload import router as upload_router


def with_retry(max_retries=3, base_delay=1):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    delay = base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)
        return wrapper
    return decorator


# ─── CONFIG ───────────────────────────────────────────────────

API_ID_STR = os.environ.get("TELEGRAM_API_ID", "0")
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")
SESSION_STRING = os.environ.get("PYROGRAM_SESSION_STRING", "")
SESSION_STRING_2 = os.environ.get("PYROGRAM_SESSION_STRING_2", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Safe integer conversion — NEVER crash the app
try:
    API_ID = int(API_ID_STR) if API_ID_STR and API_ID_STR != "0" else 0
except ValueError:
    logger.error(f"[NexusEdu] TELEGRAM_API_ID is not a valid integer: '{API_ID_STR}'. Telegram will be disabled.")
    API_ID = 0

HAS_TELEGRAM_CREDS = API_ID != 0 and API_HASH and SESSION_STRING

if not HAS_TELEGRAM_CREDS:
    logger.warning("[NexusEdu] Telegram credentials incomplete. Running WITHOUT Telegram support.")
    logger.warning("[NexusEdu] Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and PYROGRAM_SESSION_STRING to enable Telegram.")

CHANNEL_MAP = {
    'physics-c1': int(os.getenv('PHY_C1_CHANNEL_ID', '0') or '0'),
    'physics-c2': int(os.getenv('PHY_C2_CHANNEL_ID', '0') or '0'),
    'physics-c3': int(os.getenv('PHY_C3_CHANNEL_ID', '0') or '0'),
    'physics-c4': int(os.getenv('PHY_C4_CHANNEL_ID', '0') or '0'),
    'physics-c5': int(os.getenv('PHY_C5_CHANNEL_ID', '0') or '0'),
    'physics-c6': int(os.getenv('PHY_C6_CHANNEL_ID', '0') or '0'),
    'chemistry-c1': int(os.getenv('CHE_C1_CHANNEL_ID', '0') or '0'),
    'chemistry-c2': int(os.getenv('CHE_C2_CHANNEL_ID', '0') or '0'),
    'chemistry-c3': int(os.getenv('CHE_C3_CHANNEL_ID', '0') or '0'),
    'chemistry-c4': int(os.getenv('CHE_C4_CHANNEL_ID', '0') or '0'),
    'chemistry-c5': int(os.getenv('CHE_C5_CHANNEL_ID', '0') or '0'),
    'chemistry-c6': int(os.getenv('CHE_C6_CHANNEL_ID', '0') or '0'),
    'math-c1': int(os.getenv('HM_C1_CHANNEL_ID', '0') or '0'),
    'math-c2': int(os.getenv('HM_C2_CHANNEL_ID', '0') or '0'),
    'math-c3': int(os.getenv('HM_C3_CHANNEL_ID', '0') or '0'),
    'math-c4': int(os.getenv('HM_C4_CHANNEL_ID', '0') or '0'),
    'math-c5': int(os.getenv('HM_C5_CHANNEL_ID', '0') or '0'),
    'math-c6': int(os.getenv('HM_C6_CHANNEL_ID', '0') or '0'),
}

CHUNK_SIZE = 1024 * 1024
CATALOG_TTL = 300
INITIAL_BUFFER = 512 * 1024

# ─── STATE ────────────────────────────────────────────────────
class LRUDict:
    def __init__(self, max_size: int = 300, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._store: OrderedDict = OrderedDict()

    def __setitem__(self, key, value):
        if key in self._store:
            del self._store[key]
        elif len(self._store) >= self.max_size:
            self._store.popitem(last=False)
        self._store[key] = (value, time.time())

    def __getitem__(self, key):
        if key not in self._store:
            raise KeyError(key)
        value, ts = self._store[key]
        if time.time() - ts > self.ttl:
            del self._store[key]
            raise KeyError(key)
        self._store.move_to_end(key)
        return value

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def __contains__(self, key):
        try:
            self[key]
            return True
        except KeyError:
            return False

    def __len__(self):
        return len(self._store)


tg: Optional[Client] = None
tg2: Optional[Client] = None
_tg_check_ts: float = 0.0
_tg_check_ok: bool = False
catalog_cache = {"data": None, "timestamp": 0}
video_map = {}
message_cache: LRUDict = LRUDict(max_size=300, ttl_seconds=3600)
resolved_channels = set()
catalog_lock = asyncio.Lock()

_TOKEN_CACHE = LRUDict(max_size=5000, ttl_seconds=300)


# ─── TELEGRAM HELPERS ─────────────────────────────────────────

async def verify_supabase_token(authorization: str) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]

    if token in _TOKEN_CACHE:
        return _TOKEN_CACHE[token]

    try:
        supabase_url = os.environ.get("SUPABASE_URL")
        anon_key = os.environ.get("SUPABASE_ANON_KEY")
        if not supabase_url or not anon_key:
            return None
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": anon_key}
            )
            if resp.status_code == 200:
                user_data = resp.json()
                _TOKEN_CACHE[token] = user_data
                return user_data
            return None
    except Exception:
        return None


async def resolve_channel(channel_id: int | str) -> bool:
    try:
        cid = int(str(channel_id))
    except (ValueError, TypeError):
        return False
    if cid in resolved_channels:
        return True
    try:
        client = get_active_client()
        if client is None:
            return False
        await client.get_chat(cid)
        resolved_channels.add(cid)
        logger.info(f"[System] Resolved channel {cid}")
        return True
    except Exception as e:
        logger.info(f"[System] Could not resolve {cid}: {e}")
        return False


async def preload_channels():
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
                if dialog.chat.type in [ChatType.CHANNEL, ChatType.SUPERGROUP, ChatType.GROUP]:
                    resolved_channels.add(dialog.chat.id)
                    count += 1
            except Exception:
                pass
        logger.info(f"[System] {count} channels/groups loaded from dialogs.")
    except Exception as e:
        logger.info(f"[System] Dialog preload error: {e}")


async def get_message(channel_id: int, message_id: int):
    key = f"{channel_id}_{message_id}"
    if key not in message_cache:
        client = get_active_client()
        if client is None:
            raise Exception("No Telegram client available")
        msg = await client.get_messages(channel_id, message_id)
        if hasattr(msg, 'empty') and msg.empty:
            raise Exception("Telegram message is empty or was deleted")
        message_cache[key] = msg
    return message_cache.get(key)


async def get_file_info(channel_id: int, message_id: int, video_id: str = None) -> Tuple[int, str]:
    if video_id and SUPABASE_URL and SUPABASE_KEY:
        try:
            async with httpx.AsyncClient(timeout=3.0) as hclient:
                r = await hclient.get(
                    f"{SUPABASE_URL}/rest/v1/videos",
                    params={"id": f"eq.{video_id}", "select": "file_size_bytes,mime_type"},
                    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
                )
                if r.status_code == 200:
                    data = r.json()
                    if data and data[0].get("file_size_bytes"):
                        return int(data[0]["file_size_bytes"]), data[0].get("mime_type", "video/mp4")
        except Exception:
            pass

    msg = await get_message(channel_id, message_id)
    size = 0
    mime = "video/mp4"

    media = msg.video or msg.document
    if media:
        size = media.file_size or 0
        if hasattr(media, 'mime_type') and media.mime_type:
            mime = media.mime_type
        else:
            file_name = getattr(media, 'file_name', '') or ''
            file_name_lower = file_name.lower()
            if file_name_lower.endswith('.mkv'):
                mime = 'video/x-matroska'
            elif file_name_lower.endswith('.avi'):
                mime = 'video/x-msvideo'
            elif file_name_lower.endswith('.webm'):
                mime = 'video/webm'
            elif file_name_lower.endswith('.mov'):
                mime = 'video/quicktime'

    if video_id and size > 0 and SUPABASE_URL and SUPABASE_KEY:
        asyncio.create_task(_save_file_metadata(video_id, size, mime))
    return size, mime


async def _save_file_metadata(video_id: str, size: int, mime: str):
    try:
        import json as _json
        async with httpx.AsyncClient(timeout=5.0) as hclient:
            await hclient.patch(
                f"{SUPABASE_URL}/rest/v1/videos",
                params={"id": f"eq.{video_id}"},
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                content=_json.dumps({
                    "file_size_bytes": size,
                    "mime_type": mime,
                    "telegram_fetched_at": "now()"
                })
            )
    except Exception as e:
        logger.info(f"[NexusEdu] Failed to cache file metadata: {e}")


# ─── SUPABASE FETCH ───────────────────────────────────────────

async def fetch_supabase(path: str, client: httpx.AsyncClient) -> list:
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    for attempt in range(3):
        try:
            r = await client.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(2 ** attempt)


async def fetch_all_videos(client: httpx.AsyncClient) -> list:
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    all_videos, offset = [], 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/videos"
            f"?is_active=eq.true&order=display_order"
            f"&select=id,chapter_id,title,title_bn,source_type,drive_file_id,youtube_video_id,size_mb,duration,display_order"
            f"&offset={offset}&limit=1000"
        )
        for attempt in range(3):
            try:
                r = await client.get(url, headers=headers, timeout=30)
                r.raise_for_status()
                batch = r.json()
                break
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)

        if not batch:
            break
        all_videos.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return all_videos


async def fetch_video_secrets(client: httpx.AsyncClient) -> dict:
    if not SUPABASE_KEY:
        return {}
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    secrets = {}
    offset = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/videos?is_active=eq.true"
            f"&select=id,telegram_channel_id,telegram_message_id,thumbnail_telegram_message_id"
            f"&offset={offset}&limit=1000"
        )
        for attempt in range(3):
            try:
                r = await client.get(url, headers=headers, timeout=30)
                r.raise_for_status()
                batch = r.json()
                break
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)

        if not batch:
            break
        for v in batch:
            secrets[v["id"]] = {
                "channel_id": v.get("telegram_channel_id", ""),
                "message_id": v.get("telegram_message_id", 0),
                "thumbnail_message_id": v.get("thumbnail_telegram_message_id", 0)
            }
        if len(batch) < 1000:
            break
        offset += 1000
    return secrets


# ─── CATALOG BUILD ────────────────────────────────────────────

async def refresh_catalog():
    global catalog_cache, video_map

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.info("[NexusEdu] Supabase not configured — skipping catalog.")
        return

    try:
        async with httpx.AsyncClient() as client:
            subjects_task = fetch_supabase("subjects?is_active=eq.true&order=display_order", client)
            cycles_task = fetch_supabase("cycles?is_active=eq.true&order=display_order", client)
            chapters_task = fetch_supabase("chapters?is_active=eq.true&order=display_order", client)
            videos_task = fetch_all_videos(client)
            secrets_task = fetch_video_secrets(client)

            subjects, cycles, chapters, videos, secrets = await asyncio.gather(
                subjects_task, cycles_task, chapters_task, videos_task, secrets_task
            )

            new_map = {}
            for v in videos:
                sec = secrets.get(v["id"], {})
                new_map[v["id"]] = {
                    "source_type": v.get("source_type", "telegram"),
                    "drive_file_id": v.get("drive_file_id", ""),
                    "channel_id": sec.get("channel_id", ""),
                    "message_id": sec.get("message_id", 0),
                    "thumbnail_message_id": sec.get("thumbnail_message_id", 0)
                }

            for cid in {c.get("telegram_channel_id") for c in cycles if c.get("telegram_channel_id")}:
                await resolve_channel(cid)

            result = []
            for subj in subjects:
                s_cycles = sorted(
                    [c for c in cycles if c["subject_id"] == subj["id"]],
                    key=lambda x: x.get("display_order", 0),
                )
                subj_data = {**subj, "cycles": []}
                for cyc in s_cycles:
                    c_chapters = sorted(
                        [ch for ch in chapters if ch["cycle_id"] == cyc["id"]],
                        key=lambda x: x.get("display_order", 0),
                    )
                    cyc_data = {**cyc, "chapters": []}
                    for chap in c_chapters:
                        c_videos = sorted(
                            [v for v in videos if v["chapter_id"] == chap["id"]],
                            key=lambda x: x.get("display_order", 0),
                        )
                        cyc_data["chapters"].append({
                            **chap,
                            "videos": [
                                {
                                    "id": v["id"],
                                    "title": v["title"],
                                    "title_bn": v.get("title_bn", ""),
                                    "duration": v.get("duration", "00:00:00"),
                                    "size_mb": v.get("size_mb", 0),
                                }
                                for v in c_videos
                            ],
                        })
                    subj_data["cycles"].append(cyc_data)
                result.append(subj_data)

            async with catalog_lock:
                catalog_cache = {
                    "data": {"subjects": result, "total_videos": len(videos)},
                    "timestamp": time.time(),
                }
                video_map = new_map
            logger.info(f"[NexusEdu] Catalog loaded: {len(videos)} video(s).")

    except Exception as e:
        logger.error(f"[NexusEdu] Catalog load error: {e}")
        logger.error(traceback.format_exc())


# ─── TELEGRAM CLIENT MANAGEMENT ───────────────────────────────

ensure_tg_lock = asyncio.Lock()

async def ensure_telegram_connected() -> bool:
    global tg, tg2, _tg_check_ts, _tg_check_ok
    now = time.time()

    if _tg_check_ok and (now - _tg_check_ts) < 20:
        return True

    async with ensure_tg_lock:
        if _tg_check_ok and (time.time() - _tg_check_ts) < 20:
            return True

        if tg is not None:
            try:
                if tg.is_connected:
                    _tg_check_ok = True
                    _tg_check_ts = time.time()
                    return True
            except Exception:
                pass

        if tg2 is not None:
            try:
                if tg2.is_connected:
                    logger.info("[System] Primary down, secondary client is connected.")
                    _tg_check_ok = True
                    _tg_check_ts = time.time()
                    return True
            except Exception:
                pass

        logger.info("[System] Telegram disconnected — reconnecting...")
        try:
            if tg is not None:
                try:
                    await asyncio.wait_for(tg.stop(), timeout=5)
                except Exception:
                    pass
            if API_ID and API_HASH and SESSION_STRING:
                tg = Client("nexusedu_session", api_id=API_ID, api_hash=API_HASH,
                            session_string=SESSION_STRING, in_memory=True)
                await asyncio.wait_for(tg.start(), timeout=30)
                logger.info("[System] Primary Telegram reconnected.")
                asyncio.create_task(preload_channels())
                _tg_check_ok = True
                _tg_check_ts = time.time()
                return True
        except Exception as e:
            logger.info(f"[System] Primary reconnect failed: {e}")

        if SESSION_STRING_2:
            try:
                if tg2 is not None:
                    try:
                        await asyncio.wait_for(tg2.stop(), timeout=5)
                    except Exception:
                        pass
                tg2 = Client("nexusedu_session2", api_id=API_ID, api_hash=API_HASH,
                             session_string=SESSION_STRING_2, in_memory=True, timeout=8)
                await asyncio.wait_for(tg2.start(), timeout=30)
                logger.info("[NexusEdu] Secondary Telegram connected as fallback.")
                _tg_check_ok = True
                _tg_check_ts = now
                return True
            except Exception as e2:
                logger.info(f"[NexusEdu] Secondary reconnect also failed: {e2}")

        _tg_check_ok = False
        return False


async def telegram_watchdog():
    fail_count = 0
    while True:
        try:
            await ensure_telegram_connected()
            fail_count = 0
            await asyncio.sleep(60)
        except Exception as e:
            fail_count += 1
            fail_count = min(fail_count, 10)
            wait = min(60 * (2 ** (fail_count - 1)), 120)
            logger.info(f"[System] watchdog: fail #{fail_count}, retry in {wait}s: {e}")
            await asyncio.sleep(wait)


async def _start_telegram_clients():
    """Background task to start Telegram clients without blocking app startup."""
    global tg, tg2

    if not HAS_TELEGRAM_CREDS:
        logger.info("[NexusEdu] Skipping Telegram client startup (credentials not configured).")
        return

    try:
        logger.info("[NexusEdu] Starting Telegram client (background)...")
        tg = Client(
            "nexusedu_session",
            api_id=API_ID,
            api_hash=API_HASH,
            session_string=SESSION_STRING,
            in_memory=True,
            timeout=8
        )
        await asyncio.wait_for(tg.start(), timeout=30)
        logger.info("[NexusEdu] Telegram client started successfully.")
        await preload_channels()
    except Exception as e:
        logger.error(f"[NexusEdu] TELEGRAM STARTUP FAILED: {e}")
        logger.error("[NexusEdu] Backend will run WITHOUT Telegram. Videos will not stream.")
        tg = None

    if SESSION_STRING_2 and API_ID and API_HASH:
        try:
            tg2 = Client("nexusedu_session2", api_id=API_ID, api_hash=API_HASH,
                         session_string=SESSION_STRING_2, in_memory=True, timeout=8)
            await asyncio.wait_for(tg2.start(), timeout=30)
            logger.info("[NexusEdu] Secondary Telegram client started.")
        except Exception as e:
            logger.info(f"[NexusEdu] Secondary client failed to start: {e}")
            tg2 = None


# ─── LIFESPAN ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[NexusEdu] ===== BACKEND STARTING =====")
    logger.info(f"[NexusEdu] Python version: {sys.version}")
    logger.info(f"[NexusEdu] Telegram credentials present: {HAS_TELEGRAM_CREDS}")
    logger.info(f"[NexusEdu] Supabase URL configured: {bool(SUPABASE_URL)}")

    # Start Telegram clients in BACKGROUND — don't block startup
    tg_task = asyncio.create_task(_start_telegram_clients())

    # Initialize bot manager FIRST (non-blocking)
    bot_ok = await bot_manager.initialize()
    if bot_ok:
        logger.info("[NexusEdu] ✅ Bot manager initialized")
    else:
        logger.warning("[NexusEdu] ⚠️ Bot manager failed to initialize - bot commands won't work")

    # Wait a bit for Telegram to connect, but don't block forever
    try:
        await asyncio.wait_for(tg_task, timeout=10)
    except asyncio.TimeoutError:
        logger.warning("[NexusEdu] Telegram startup taking longer than 10s, continuing without it...")

    # Start upload worker if Telegram is available
    upload_worker_task = None
    if tg is not None:
        try:
            init_notification_service(tg)
            upload_service = init_telegram_upload_service(tg)
            upload_service.set_channels(list(CHANNEL_MAP.values()))
            worker = UploadWorker(tg)
            upload_worker_task = asyncio.create_task(worker.start())
        except Exception as e:
            logger.error(f"[NexusEdu] Upload worker init failed: {e}")

    # Refresh catalog
    try:
        await refresh_catalog()
    except Exception as e:
        logger.error(f"[NexusEdu] Initial catalog refresh failed: {e}")

    # Background tasks
    asyncio.create_task(telegram_watchdog())

    async def catalog_refresher():
        while True:
            await asyncio.sleep(600)
            try:
                await refresh_catalog()
            except Exception as e:
                logger.info(f"[NexusEdu] Background catalog refresh failed: {e}")

    async def memory_monitor():
        import psutil
        process = psutil.Process()
        while True:
            await asyncio.sleep(300)
            memory_info = process.memory_info()
            logger.info(f"Memory Usage: {memory_info.rss / 1024 / 1024:.2f} MB")

    asyncio.create_task(catalog_refresher())
    asyncio.create_task(memory_monitor())

    logger.info("[NexusEdu] ===== BACKEND READY =====")
    yield  # FastAPI serves requests here

    # Shutdown
    logger.info("[NexusEdu] ===== BACKEND SHUTTING DOWN =====")
    if upload_worker_task:
        try:
            worker.stop()
            await upload_worker_task
        except Exception:
            pass

    if tg is not None:
        try:
            await tg.stop()
        except Exception:
            pass

    if tg2 is not None:
        try:
            await tg2.stop()
        except Exception:
            pass

    await bot_manager.shutdown()


# ─── APP ──────────────────────────────────────────────────────
app = FastAPI(title="NexusEdu Backend", lifespan=lifespan)

app.include_router(upload_router, prefix="/api/admin", tags=["admin/upload"])


class TimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await asyncio.wait_for(call_next(request), timeout=30.0)
        except asyncio.TimeoutError:
            return JSONResponse({"detail": "Request timeout"}, status_code=504)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "frame-src https://www.youtube.com https://drive.google.com; "
            "media-src 'self' blob:; "
            "img-src 'self' https: data: blob:; "
            "connect-src 'self' https://*.supabase.co https://*.onrender.com;"
        )
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int = 50 * 1024 * 1024):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        if request.headers.get("content-length"):
            try:
                content_length = int(request.headers.get("content-length", 0))
                if content_length > self.max_upload_size:
                    return JSONResponse({"detail": "Request body too large"}, status_code=413)
            except ValueError:
                pass
        return await call_next(request)


class ConditionalGZipMiddleware:
    def __init__(self, app, minimum_size: int = 1000):
        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=minimum_size)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/api/stream/"):
                await self.app(scope, receive, send)
                return
        await self.gzip(scope, receive, send)


app.add_middleware(TimeoutMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(BodySizeLimitMiddleware, max_upload_size=50 * 1024 * 1024)
app.add_middleware(ConditionalGZipMiddleware, minimum_size=1000)

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "https://nexusedu.netlify.app").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "HEAD", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Range", "Accept-Ranges", "X-Admin-Token", "X-Admin-Signature", "X-Admin-Timestamp"],
    expose_headers=[
        "Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"
    ],
)


@with_retry(max_retries=5, base_delay=2)
async def safe_upload_video(channel_id, file_path, caption):
    client = get_active_client()
    if not client:
        raise Exception("No active Telegram client.")
    try:
        return await client.send_video(channel_id, file_path, caption=caption)
    except FloodWait as e:
        await asyncio.sleep(e.value)
        raise


# ─── STREAMING CORE ───────────────────────────────────────────

def get_active_client() -> Optional[Client]:
    if tg is not None:
        try:
            if tg.is_connected:
                return tg
        except Exception:
            pass
    if tg2 is not None:
        try:
            if tg2.is_connected:
                return tg2
        except Exception:
            pass
    return None


# ─── ENDPOINTS ────────────────────────────────────────────────

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"service": "NexusEdu Backend", "version": "v1.2.0", "status": "running"}


import io

@app.get("/api/thumbnail/{video_id}")
async def get_thumbnail(video_id: str, request: Request):
    try:
        await check_rate_limit(request, limit=100, window=60, prefix="thumbnail")
    except HTTPException:
        return RedirectResponse("/placeholder-video.jpg")

    if video_id not in video_map:
        await refresh_catalog()
        if video_id not in video_map:
            return RedirectResponse("/placeholder-video.jpg")

    info = video_map[video_id]
    if info.get("source_type") != "telegram":
        return RedirectResponse("/placeholder-video.jpg")

    cid_str = info.get("channel_id", "")
    message_id = info.get("message_id", 0)

    if not cid_str or not message_id:
        return RedirectResponse("/placeholder-video.jpg")

    try:
        cid = int(cid_str)
        await resolve_channel(cid)

        client = get_active_client()
        if client is None:
            return RedirectResponse("/placeholder-video.jpg")

        thumb_msg_id = info.get("thumbnail_message_id", 0)
        thumb_channel_str = os.environ.get("THUMBNAIL_CHANNEL_ID")

        if thumb_msg_id and thumb_channel_str:
            try:
                thumb_channel_id = int(thumb_channel_str)
                await resolve_channel(thumb_channel_id)
                thumb_msg = await get_message(thumb_channel_id, thumb_msg_id)
                if not getattr(thumb_msg, 'empty', True) and thumb_msg.photo:
                    thumb_bytes = await client.download_media(thumb_msg.photo.file_id, in_memory=True)
                    return StreamingResponse(
                        io.BytesIO(thumb_bytes.getbuffer()),
                        media_type="image/jpeg"
                    )
            except Exception as e:
                logger.info(f"[NexusEdu] Thumbnail channel fetch error: {e}")

        msg = await get_message(cid, message_id)
        if hasattr(msg, 'empty') and msg.empty:
            return RedirectResponse("/placeholder-video.jpg")

        media = msg.video or msg.document
        if not getattr(media, 'thumbs', None):
            return RedirectResponse("/placeholder-video.jpg")

        thumb_bytes = await client.download_media(media.thumbs[0].file_id, in_memory=True)
        return StreamingResponse(
            io.BytesIO(thumb_bytes.getbuffer()),
            media_type="image/jpeg"
        )
    except Exception as e:
        logger.info(f"[NexusEdu] Thumbnail fetch error: {e}")
        return RedirectResponse("/placeholder-video.jpg")


@app.api_route("/api/ping", methods=["GET", "HEAD"])
async def ping(request: Request):
    return JSONResponse({"status": "ok", "time": time.time()})


@app.post("/api/bot_webhook")
async def telegram_webhook(request: Request):
    """Receive webhook updates from Telegram"""
    try:
        data = await request.json()
        success = await bot_manager.process_webhook(data)
        return JSONResponse(content={"ok": success}, status_code=200)
    except Exception as e:
        logger.error(f"[Webhook] Error: {e}")
        return JSONResponse(content={"ok": False}, status_code=200)

@app.get("/api/setup_webhook")
async def setup_webhook():
    """Manually trigger webhook setup"""
    try:
        success = await bot_manager._set_webhook()
        return {
            "success": success,
            "webhook_url": bot_manager.config.WEBHOOK_URL,
            "info": bot_manager.get_webhook_info()
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health(request: Request):
    try:
        await check_rate_limit(request, limit=20, window=60, prefix="health")
    except HTTPException:
        return JSONResponse({"status": "rate_limited"}, status_code=429)

    is_conn = False
    try:
        client = get_active_client()
        if client is not None:
            is_conn = True
    except Exception:
        pass

    tg_status = "connected" if is_conn else ("reconnecting" if tg is not None else "disconnected")

    sb_status = "ok"
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        try:
            async with httpx.AsyncClient(timeout=2.0) as hclient:
                r = await hclient.get(
                    f"{SUPABASE_URL}/rest/v1/subjects?limit=1",
                    headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"}
                )
                if r.status_code != 200:
                    sb_status = "error"
        except Exception:
            sb_status = "error"
    else:
        sb_status = "unconfigured"

    overall = "ok" if (is_conn and sb_status == "ok") else "degraded"

    tg2_status = "not_configured"
    if SESSION_STRING_2:
        try:
            tg2_status = "connected" if (tg2 is not None and tg2.is_connected) else "disconnected"
        except Exception:
            tg2_status = "disconnected"

    return JSONResponse({
        "status": overall,
        "version": "v1.2.0",
        "telegram": tg_status,
        "telegram_secondary": tg2_status,
        "supabase": sb_status,
        "telegram_configured": HAS_TELEGRAM_CREDS
    })


channel_usage_stats = {}

@app.api_route("/api/channels/health", methods=["GET"])
async def channel_health(request: Request, authorization: str = Header(None)):
    try:
        await check_rate_limit(request, limit=20, window=60, prefix="channel_health")
    except HTTPException:
        return {"status": "rate_limited"}

    auth_val = authorization
    user = await verify_supabase_token(auth_val)
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")

    client = get_active_client()
    if not client:
        return {"status": "error", "error": "No telegram client active"}

    results = {}
    for name, cid in CHANNEL_MAP.items():
        if not cid:
            continue
        try:
            chan = await client.get_chat(cid)
            usage = channel_usage_stats.get(cid, 0)
            results[name] = {"status": "ok", "title": chan.title, "members": chan.members_count or 0, "usage": usage}
        except Exception as e:
            results[name] = {"status": "error", "error": str(e)}

    return {"status": "ok", "channels": results}


@app.get("/api/catalog")
async def catalog(request: Request, authorization: str = Header(None)):
    try:
        await check_rate_limit(request, limit=30, window=60, prefix="catalog")
    except HTTPException:
        raise HTTPException(status_code=429, detail="Too many requests")

    auth_val = authorization
    user = await verify_supabase_token(auth_val)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    now = time.time()
    async with catalog_lock:
        data = catalog_cache["data"]
        ts = catalog_cache["timestamp"]

        if data is None or now - ts > CATALOG_TTL:
            await refresh_catalog()
            async with catalog_lock:
                data = catalog_cache["data"]

    return data or {"subjects": [], "total_videos": 0}


_last_refresh_time = 0.0

@app.get("/api/refresh")
async def force_refresh(request: Request):
    await check_rate_limit(request, limit=5, window=60, prefix="refresh")

    global _last_refresh_time
    now = time.time()
    if now - _last_refresh_time < 60:
        return {"status": "throttled", "retry_after": round(60 - (now - _last_refresh_time))}
    _last_refresh_time = now
    await refresh_catalog()
    return {"status": "refreshed", "videos": len(video_map)}


@app.api_route("/api/warmup", methods=["GET", "POST"])
async def warmup(request: Request):
    try:
        await check_rate_limit(request, limit=10, window=60, prefix="warmup")
    except HTTPException:
        return {"status": "rate_limited"}

    if not video_map:
        await refresh_catalog()
    return {"status": "ok", "videos": len(video_map)}


@app.get("/api/prefetch/{video_id}")
async def prefetch_video(video_id: str, request: Request):
    try:
        await check_rate_limit(request, limit=50, window=60, prefix="prefetch")
    except HTTPException:
        return {"status": "rate_limited"}

    if video_id not in video_map:
        await refresh_catalog()
        if video_id not in video_map:
            return {"status": "not_found", "cached": False}

    info = video_map[video_id]
    cid_str = info.get("channel_id", "")
    message_id = info.get("message_id", 0)

    if not cid_str or not message_id:
        return {"status": "not_linked", "cached": False}

    key = f"{cid_str}_{message_id}"
    if key in message_cache:
        return {"status": "already_cached", "cached": True}

    try:
        cid = int(cid_str)
        await resolve_channel(cid)
        client = get_active_client()
        if client is None:
            return {"status": "error", "cached": False, "error": "No telegram client"}
        msg = await client.get_messages(cid, message_id)
        if hasattr(msg, 'empty') and msg.empty:
            return {"status": "message_empty", "cached": False}
        if msg:
            message_cache[key] = msg
            media = msg.video or msg.document
            size_mb = round(media.file_size / 1024 / 1024, 1) if media else 0
            return {"status": "cached", "cached": True, "size_mb": size_mb}
        return {"status": "message_empty", "cached": False}
    except Exception as e:
        return {"status": "error", "cached": False, "error": str(e)}


async def _stream_telegram(channel_id: int, message_id: int, start: int, end: int, total: int):
    chunk_offset = start // CHUNK_SIZE
    skip_bytes = start % CHUNK_SIZE
    needed = math.ceil((end - start + 1 + skip_bytes) / CHUNK_SIZE)

    msg = await get_message(channel_id, message_id)

    bytes_sent = 0
    target = end - start + 1
    first_chunk = True

    client = get_active_client()
    if client is None:
        raise Exception("No Telegram client available")

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
    except Exception as e:
        if "flood" in str(e).lower() or "FloodWait" in type(e).__name__:
            logger.info(f"[NexusEdu] Telegram FloodWait on stream: {e}")
        else:
            logger.info(f"[NexusEdu] Stream error: {e}")


def _parse_range(range_header: str, total: int) -> Tuple[int, int]:
    try:
        val = range_header.replace("bytes=", "").strip()
        parts = val.split("-")
        start = int(parts[0]) if parts[0].strip() else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1].strip() else total - 1
        start = max(0, min(start, total - 1))
        end = max(start, min(end, total - 1))
        return start, end
    except (ValueError, IndexError):
        return 0, total - 1


import re
from collections import defaultdict
concurrent_user_streams = defaultdict(int)


@app.api_route("/api/stream/{video_id}", methods=["GET", "HEAD"])
async def stream_video(video_id: str, request: Request, token: str = None, authorization: str = Header(None)):
    auth_val = authorization or (f"Bearer {token}" if token else None)
    user = await verify_supabase_token(auth_val)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")

    user_id = user.get("sub") or user.get("id")
    if concurrent_user_streams[user_id] >= 3:
        raise HTTPException(status_code=429, detail="Maximum 3 concurrent streams allowed")

    if not re.match(r'^[a-zA-Z0-9_-]{1,64}$', video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID format")

    await check_rate_limit(request, limit=120, window=60, prefix="stream")

    try:
        if video_id not in video_map:
            await refresh_catalog()
            if video_id not in video_map:
                raise HTTPException(status_code=404, detail="Video not found in active catalog.")

        video = video_map[video_id]
        source_type = video.get("source_type", "telegram")
        channel_id_str = video.get("channel_id", "")
        message_id_str = video.get("message_id", 0)

        if source_type == "drive":
            drive_file_id = video.get("drive_file_id")
            if not drive_file_id:
                raise HTTPException(status_code=400, detail="Drive file ID missing")
            if not re.match(r'^[a-zA-Z0-9_-]{10,100}$', drive_file_id):
                raise HTTPException(status_code=400, detail="Invalid Drive file ID format")
            worker_url = os.environ.get("VITE_CLOUDFLARE_WORKER_URL", "https://nexusedu-proxy.mdhosainp414.workers.dev")
            return RedirectResponse(url=f"{worker_url}/drive/{drive_file_id}", status_code=302)

        if source_type == "youtube":
            raise HTTPException(status_code=400, detail="YouTube videos stream directly on client")

        connected = await ensure_telegram_connected()
        if not connected:
            raise HTTPException(status_code=503, detail="Telegram client is not connected.")

        if not channel_id_str or not message_id_str:
            raise HTTPException(status_code=400, detail="Video not linked to Telegram")

        channel_id = int(channel_id_str)
        message_id = int(message_id_str)

        channel_usage_stats[channel_id] = channel_usage_stats.get(channel_id, 0) + 1

        await resolve_channel(channel_id)

        tg_client = get_active_client()
        if not tg_client:
            raise HTTPException(status_code=503, detail="No active Pyrogram client found")

        message = await get_message(channel_id, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="Telegram message not found")

        media = message.video or message.document
        if not media:
            raise HTTPException(status_code=404, detail="Message has no media")

        file_size = media.file_size

        if media and hasattr(media, 'mime_type') and media.mime_type:
            mime_type = media.mime_type
        else:
            file_name = getattr(media, 'file_name', '') or ''
            file_name_lower = file_name.lower()
            if file_name_lower.endswith('.mkv'):
                mime_type = 'video/x-matroska'
            elif file_name_lower.endswith('.avi'):
                mime_type = 'video/x-msvideo'
            elif file_name_lower.endswith('.webm'):
                mime_type = 'video/webm'
            elif file_name_lower.endswith('.mov'):
                mime_type = 'video/quicktime'
            else:
                mime_type = 'video/mp4'

        if request.method == "HEAD":
            return Response(
                status_code=200,
                media_type=mime_type,
                headers={
                    "Content-Length": str(file_size),
                    "Accept-Ranges": "bytes",
                    "Content-Type": mime_type,
                    "Cache-Control": "no-cache",
                }
            )

        range_header = request.headers.get("Range")
        start, end = _parse_range(range_header or "", file_size)

        MAX_RANGE_SIZE = 50 * 1024 * 1024
        if end - start + 1 > MAX_RANGE_SIZE:
            end = start + MAX_RANGE_SIZE - 1

        length = end - start + 1

        async def _tracked_stream():
            try:
                concurrent_user_streams[user_id] += 1
                async for chunk in _stream_telegram(channel_id, message_id, start, end, file_size):
                    yield chunk
            finally:
                concurrent_user_streams[user_id] -= 1

        return StreamingResponse(
            _tracked_stream(),
            status_code=206 if range_header else 200,
            media_type=mime_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(length),
                "Content-Type": mime_type,
                "Cache-Control": "public, max-age=31536000",
                "X-Content-Type-Options": "nosniff",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.info(f"[NexusEdu] Stream endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


class DeleteUserReq(BaseModel):
    user_id: constr(min_length=36, max_length=36)
    confirmation_text: constr(min_length=1, max_length=50)


class GenerateChapterCodeReq(BaseModel):
    chapter_id: constr(min_length=36, max_length=36)
    notes: Optional[str] = ""
    label: Optional[str] = ""
    max_uses: int = 1


@app.post("/api/admin/verify")
async def verify_admin(request: Request):
    await check_rate_limit(request, limit=10, window=60, prefix="admin_verify")
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await verify_supabase_token(auth_header)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        anon_key = secrets_manager.get_secret("supabase_anon_key")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{supabase_url}/rest/v1/profiles?select=role&id=eq.{user['sub']}",
                headers={"apikey": anon_key, "Authorization": auth_header}
            )
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0 and data[0].get("role") == "admin":
                    return {"is_admin": True}
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")

    return {"is_admin": False}


@app.post("/api/admin/delete_user")
async def delete_user_account(req: DeleteUserReq, request: Request):
    await check_rate_limit(request, limit=5, window=60, prefix="admin_action")
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(401, "Unauthorized")

    is_admin = False
    user = await verify_supabase_token(authorization)
    if user:
        try:
            supabase_url = secrets_manager.get_secret("supabase_url")
            anon_key = secrets_manager.get_secret("supabase_anon_key")
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{supabase_url}/rest/v1/profiles?select=role&id=eq.{user['sub']}",
                    headers={"apikey": anon_key, "Authorization": authorization}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    is_admin = (data and len(data) > 0 and data[0].get("role") == "admin")
        except Exception:
            pass

    if not is_admin:
        raise HTTPException(status_code=401, detail="Unauthorized")

    x_admin_signature = request.headers.get("X-Admin-Signature")
    x_admin_timestamp = request.headers.get("X-Admin-Timestamp")

    if not x_admin_signature or not x_admin_timestamp:
        raise HTTPException(status_code=403, detail="Missing secure admin signature")

    if not verify_admin_signature(x_admin_signature, req.model_dump_json(), x_admin_timestamp):
        raise HTTPException(status_code=403, detail="Invalid admin signature")

    if req.confirmation_text != f"DELETE-{req.user_id}":
        raise HTTPException(400, "Invalid confirmation text")

    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                "DELETE",
                f"{supabase_url}/auth/v1/admin/users/{req.user_id}",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
            )
            if resp.status_code not in (200, 204, 404):
                raise HTTPException(500, "Failed to delete user via Supabase admin")
            return {"status": "User deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/admin/generate_chapter_code")
async def admin_generate_chapter_code(req: GenerateChapterCodeReq, request: Request):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_action")
    authorization = request.headers.get("Authorization")
    user = await verify_supabase_token(authorization)
    if not user:
        raise HTTPException(401, "Unauthorized")

    is_admin = False
    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        anon_key = secrets_manager.get_secret("supabase_anon_key")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{supabase_url}/rest/v1/profiles?select=role&id=eq.{user['sub']}",
                headers={"apikey": anon_key, "Authorization": authorization}
            )
            if resp.status_code == 200:
                data = resp.json()
                is_admin = (data and len(data) > 0 and data[0].get("role") == "admin")
    except Exception:
        pass

    if not is_admin:
        raise HTTPException(status_code=401, detail="Unauthorized")

    secure_code = f"{generate_secure_hex(3)}-{generate_secure_hex(3)}"

    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{supabase_url}/rest/v1/enrollment_codes",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                json={
                    "chapter_id": req.chapter_id,
                    "code": secure_code,
                    "max_uses": req.max_uses,
                    "notes": req.notes,
                    "label": req.label,
                    "generated_by": user['sub'],
                    "created_by": user['sub']
                }
            )
            resp.raise_for_status()
            return {"code": secure_code}
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── RUN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    logger.info(f"[NexusEdu] Starting server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
