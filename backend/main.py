# NexusEdu Backend — canonical file. Root main.py is deleted.
import asyncio
import math
import time
import os
import sys
from contextlib import asynccontextmanager
from typing import Optional, Tuple
from collections import OrderedDict

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, Response, RedirectResponse
from pyrogram import Client

# ─── CONFIG ───────────────────────────────────────────────────
def _require_env(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"[NexusEdu] FATAL: {key} environment variable is not set. Backend cannot start.", flush=True)
        sys.exit(1)
    return val

API_ID_STR  = _require_env("TELEGRAM_API_ID")
API_HASH    = _require_env("TELEGRAM_API_HASH")
SESSION_STRING = _require_env("PYROGRAM_SESSION_STRING")
SESSION_STRING_2 = os.environ.get("PYROGRAM_SESSION_STRING_2", "").strip()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Safe integer conversion — prevents int(None) crash
try:
    API_ID = int(API_ID_STR)
except ValueError:
    print("[NexusEdu] FATAL: TELEGRAM_API_ID must be an integer", flush=True)
    sys.exit(1)

CHUNK_SIZE      = 1024 * 1024        # 1 MB per chunk from Telegram
CATALOG_TTL     = 300                # 5 min cache
INITIAL_BUFFER  = 512 * 1024         # 512 KB first response — starts playing fast

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
            self._store.popitem(last=False)  # Remove oldest (O(1))
        self._store[key] = (value, time.time())
    
    def __getitem__(self, key):
        if key not in self._store:
            raise KeyError(key)
        value, ts = self._store[key]
        if time.time() - ts > self.ttl:
            del self._store[key]
            raise KeyError(key)
        self._store.move_to_end(key)  # O(1) LRU update
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
tg2: Optional[Client] = None   # Second Telegram client for failover
_tg_check_ts: float = 0.0
_tg_check_ok: bool = False
catalog_cache   = {"data": None, "timestamp": 0}
video_map       = {}          # uuid → {channel_id, message_id}
message_cache: LRUDict = LRUDict(max_size=300, ttl_seconds=3600)
resolved_channels = set()
catalog_lock = asyncio.Lock()

# ─── TELEGRAM HELPERS ─────────────────────────────────────────

import time

_TOKEN_CACHE = {}

async def verify_supabase_token(authorization: str) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    
    now = time.time()
    if token in _TOKEN_CACHE:
        cached_user, expires_at = _TOKEN_CACHE[token]
        if now < expires_at:
            return cached_user

    try:
        supabase_url = os.environ.get("SUPABASE_URL")
        anon_key = os.environ.get("SUPABASE_ANON_KEY")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": anon_key}
            )
            if resp.status_code == 200:
                user_data = resp.json()
                _TOKEN_CACHE[token] = (user_data, now + 300)
                return user_data
            return None
    except Exception:
        return None

async def resolve_channel(channel_id: int | str) -> bool:
    cid = int(str(channel_id))
    if cid in resolved_channels:
        return True
    try:
        client = get_active_client()
        if client is None:
            return False
        await client.get_chat(cid)
        resolved_channels.add(cid)
        print(f"[System] Resolved channel {cid}")
        return True
    except Exception as e:
        print(f"[System] Could not resolve {cid}: {e}")
        return False


async def preload_channels():
    try:
        from pyrogram.enums import ChatType
        client = get_active_client()
        if client is None: return
        count = 0
        async for dialog in client.get_dialogs():
            try:
                if dialog.chat.type in [ChatType.CHANNEL, ChatType.SUPERGROUP, ChatType.GROUP]:
                    resolved_channels.add(dialog.chat.id)
                    count += 1
            except Exception:
                pass
        print(f"[System] {count} channels/groups loaded from dialogs.")
    except Exception as e:
        print(f"[System] Dialog preload error: {e}")


async def get_message(channel_id: int, message_id: int):
    """Fetch and cache a Telegram message object."""
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
    """Get file size and MIME type, with Supabase caching to avoid repeated Telegram API calls."""
    # Check Supabase cache first (avoids hitting Telegram API every play)
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
            pass  # Fall through to Telegram fetch
    # Fetch from Telegram
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
            
    # Cache to Supabase (fire and forget — don't block streaming)
    if video_id and size > 0 and SUPABASE_URL and SUPABASE_KEY:
        asyncio.create_task(_save_file_metadata(video_id, size, mime))
    return size, mime

async def _save_file_metadata(video_id: str, size: int, mime: str):
    """Save file metadata to Supabase so we never fetch from Telegram again for this video."""
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
        print(f"[NexusEdu] Failed to cache file metadata: {e}", flush=True)


# ─── SUPABASE FETCH ───────────────────────────────────────────
async def fetch_supabase(path: str, client: httpx.AsyncClient) -> list:
    headers = {
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    for attempt in range(3):
        try:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, timeout=30
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(2 ** attempt)

async def fetch_all_videos(client: httpx.AsyncClient) -> list:
    """Paginated — handles 1,458+ videos reliably."""
    headers = {
        "apikey":        SUPABASE_ANON_KEY,
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
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    secrets = {}
    offset = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/videos?is_active=eq.true"
            f"&select=id,telegram_channel_id,telegram_message_id"
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
                "message_id": v.get("telegram_message_id", 0)
            }
        if len(batch) < 1000:
            break
        offset += 1000
    return secrets

# ─── CATALOG BUILD ────────────────────────────────────────────
async def refresh_catalog():
    global catalog_cache, video_map

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[NexusEdu] Supabase not configured — skipping catalog.")
        return

    try:
        async with httpx.AsyncClient() as client:
            subjects_task = fetch_supabase("subjects?is_active=eq.true&order=display_order", client)
            cycles_task   = fetch_supabase("cycles?is_active=eq.true&order=display_order", client)
            chapters_task = fetch_supabase("chapters?is_active=eq.true&order=display_order", client)
            videos_task   = fetch_all_videos(client)
            secrets_task  = fetch_video_secrets(client)

            subjects, cycles, chapters, videos, secrets = await asyncio.gather(
                subjects_task, cycles_task, chapters_task, videos_task, secrets_task
            )

        # Build video_map for O(1) stream lookups
        new_map = {}
        for v in videos:
            sec = secrets.get(v["id"], {})
            new_map[v["id"]] = {
                "source_type": v.get("source_type", "telegram"),
                "drive_file_id": v.get("drive_file_id", ""),
                "channel_id": sec.get("channel_id", ""),
                "message_id": sec.get("message_id", 0),
            }
        video_map = new_map

        # Resolve all Telegram channels found in cycles
        for cid in {c.get("telegram_channel_id") for c in cycles
                    if c.get("telegram_channel_id")}:
            await resolve_channel(cid)

        # Assemble nested hierarchy
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
                                "id":       v["id"],
                                "title":    v["title"],
                                "title_bn": v.get("title_bn", ""),
                                "duration": v.get("duration", "00:00:00"),
                                "size_mb":  v.get("size_mb", 0),
                            }
                            for v in c_videos
                        ],
                    })
                subj_data["cycles"].append(cyc_data)
            result.append(subj_data)

        async with catalog_lock:
            catalog_cache = {
                "data":      {"subjects": result, "total_videos": len(videos)},
                "timestamp": time.time(),
            }
            # Swap safely inside lock!
            video_map.clear()
            video_map.update(new_map)
        print(f"[NexusEdu] Catalog loaded: {len(videos)} video(s).")

    except Exception as e:
        print(f"[NexusEdu] Catalog load error: {e}")


# ─── LIFESPAN ─────────────────────────────────────────────────
ensure_tg_lock = asyncio.Lock()

async def ensure_telegram_connected() -> bool:
    global tg, tg2, _tg_check_ts, _tg_check_ok
    now = time.time()
    
    if _tg_check_ok and (now - _tg_check_ts) < 20:
        return True
        
    async with ensure_tg_lock:
        if _tg_check_ok and (time.time() - _tg_check_ts) < 20:
            return True
            
        # Check primary client
        if tg is not None:
            try:
                if tg.is_connected:
                    _tg_check_ok = True
                    _tg_check_ts = time.time()
                    return True
            except Exception:
                pass
                
        # Check secondary client
        if tg2 is not None:
            try:
                if tg2.is_connected:
                    print("[System] Primary down, secondary client is connected.", flush=True)
                    _tg_check_ok = True
                    _tg_check_ts = time.time()
                    return True
            except Exception:
                pass
                
        # Need to reconnect primary
        print("[System] Telegram disconnected — reconnecting...", flush=True)
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
                print("[System] Primary Telegram reconnected.", flush=True)
                asyncio.create_task(preload_channels())
                _tg_check_ok = True
                _tg_check_ts = time.time()
                return True
        except Exception as e:
            print(f"[System] Primary reconnect failed: {e}", flush=True)
        # Try secondary as fallback
        if SESSION_STRING_2:
        try:
            if tg2 is not None:
                try:
                    await asyncio.wait_for(tg2.stop(), timeout=5)
                except Exception:
                    pass
            tg2 = Client("nexusedu_session2", api_id=API_ID, api_hash=API_HASH,
                          session_string=SESSION_STRING_2, in_memory=True)
            await asyncio.wait_for(tg2.start(), timeout=30)
            print("[NexusEdu] Secondary Telegram connected as fallback.", flush=True)
            _tg_check_ok = True
            _tg_check_ts = now
            return True
        except Exception as e2:
            print(f"[NexusEdu] Secondary reconnect also failed: {e2}", flush=True)
    _tg_check_ok = False
    return False

async def telegram_watchdog():
    """Monitor Telegram connection with exponential backoff."""
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
            print(f"[System] watchdog: fail #{fail_count}, retry in {wait}s: {e}")
            await asyncio.sleep(wait)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tg, tg2
    api_id   = API_ID
    api_hash = API_HASH
    session  = SESSION_STRING

    if not session or not api_id or not api_hash:
        print("[NexusEdu] WARNING: Telegram credentials not set. Starting without Telegram.", flush=True)
    else:
        print("[NexusEdu] Starting Telegram client...", flush=True)
        try:
            tg = Client(
                "nexusedu_session",
                api_id=api_id,
                api_hash=api_hash,
                session_string=session,
                in_memory=True,
            )
            await tg.start()
            print("[NexusEdu] Telegram client started successfully.", flush=True)
            await preload_channels()
        except Exception as e:
            print(f"[NexusEdu] TELEGRAM STARTUP FAILED: {e}", flush=True)
            print("[NexusEdu] Backend starting WITHOUT Telegram. Videos will not stream.", flush=True)
            tg = None  # Reset to None so health endpoint shows disconnected cleanly

    # Start secondary client if available
    if SESSION_STRING_2 and API_ID and API_HASH:
        try:
            tg2 = Client("nexusedu_session2", api_id=API_ID, api_hash=API_HASH,
                          session_string=SESSION_STRING_2, in_memory=True)
            await asyncio.wait_for(tg2.start(), timeout=30)
            print("[NexusEdu] Secondary Telegram client started.", flush=True)
        except Exception as e:
            print(f"[NexusEdu] Secondary client failed to start: {e}", flush=True)
            tg2 = None

    await refresh_catalog()
    asyncio.create_task(telegram_watchdog())
    yield  # FastAPI serves requests here

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


# ─── APP ──────────────────────────────────────────────────────
app = FastAPI(title="NexusEdu Backend", lifespan=lifespan)

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import math

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware, max_upload_size=50 * 1024 * 1024)
app.add_middleware(ConditionalGZipMiddleware, minimum_size=1000)

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "https://nexusedu.netlify.app,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "HEAD"],
    allow_headers=["Authorization", "Content-Type", "Range", "Accept-Ranges", "X-Admin-Token"],
    expose_headers=[
        "Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"
    ],
)


# ─── STREAMING CORE ───────────────────────────────────────────
def get_active_client() -> Optional[Client]:
    """Return the first connected Telegram client available."""
    if tg is not None:
        try:
            if tg.is_connected: return tg
        except Exception: pass
    if tg2 is not None:
        try:
            if tg2.is_connected: return tg2
        except Exception: pass
    return None  # Return None if no client is connected to properly fail and trigger reconnect upstream


# ─── ENDPOINTS ────────────────────────────────────────────────

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"service": "NexusEdu Backend", "version": "v1.1.0", "status": "running"}


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip + "_health", limit=20, window_seconds=60):
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
        "version": "v1.1.0",
        "telegram": tg_status,
        "telegram_secondary": tg2_status,
        "supabase": sb_status
    })


# Simple rate limiter for endpoints
import time
rate_limits = LRUDict(max_size=5000, ttl_seconds=3600)

def check_rate_limit(client_ip: str, limit: int = 5, window_seconds: int = 60) -> bool:
    now = time.time()
    times = rate_limits.get(client_ip, [])
    # Clean up old timestamps
    times = [t for t in times if now - t < window_seconds]
    if len(times) >= limit:
        rate_limits[client_ip] = times
        return False
    times.append(now)
    rate_limits[client_ip] = times
    return True


@app.get("/api/catalog")
async def catalog(request: Request, authorization: str = Header(None)):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip + "_catalog", limit=30, window_seconds=60):
        # We don't raise HTTPException so frontend can fallback easily, but returning 429 is correct
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
            
    # We already removed channel_id and message_id from the JSON returned in refresh_catalog
    return data or {"subjects": [], "total_videos": 0}


_last_refresh_time = 0.0

@app.get("/api/refresh")
async def force_refresh(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip + "_refresh", limit=5, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many refresh requests")

    global _last_refresh_time
    now = time.time()
    if now - _last_refresh_time < 60:
        return {"status": "throttled", "retry_after": round(60 - (now - _last_refresh_time))}
    _last_refresh_time = now
    await refresh_catalog()
    return {"status": "refreshed", "videos": len(video_map)}


@app.api_route("/api/warmup", methods=["GET", "POST"])
async def warmup(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip + "_warmup", limit=10, window_seconds=60):
        return {"status": "rate_limited"}

    """
    Called by frontend on app startup.
    Triggers catalog refresh if needed.
    """
    if not video_map:
        await refresh_catalog()
    return {"status": "ok", "videos": len(video_map)}


@app.get("/api/prefetch/{video_id}")
async def prefetch_video(video_id: str, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip + "_prefetch", limit=50, window_seconds=60):
        return {"status": "rate_limited"}

    """
    Warms the message cache for a single video without streaming bytes.
    Frontend calls this for every video when a chapter list loads,
    so by the time user taps play the message is already cached.
    """
    if video_id not in video_map:
        await refresh_catalog()
    if video_id not in video_map:
        return {"status": "not_found", "cached": False}

    info       = video_map[video_id]
    cid_str    = info.get("channel_id", "")
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
        if client is None: return {"status": "error", "cached": False, "error": "No telegram client"}
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

async def _stream_telegram(
    channel_id: int, message_id: int,
    start: int, end: int, total: int
):
    """
    Async generator — pulls 1MB chunks from Telegram and yields bytes.
    Byte-accurate: handles non-aligned range starts via skip_bytes.
    """
    chunk_offset = start // CHUNK_SIZE
    skip_bytes   = start % CHUNK_SIZE
    needed       = math.ceil((end - start + 1 + skip_bytes) / CHUNK_SIZE)

    msg = await get_message(channel_id, message_id)

    bytes_sent  = 0
    target      = end - start + 1
    first_chunk = True

    client = get_active_client()
    if client is None:
        raise Exception("No Telegram client available")
    
    try:
        async for chunk in client.stream_media(msg, offset=chunk_offset, limit=needed):
            data = bytes(chunk)
            if first_chunk and skip_bytes:
                data        = data[skip_bytes:]
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
            print(f"[NexusEdu] Telegram FloodWait on stream: {e}", flush=True)
        else:
            print(f"[NexusEdu] Stream error: {e}", flush=True)

def _parse_range(range_header: str, total: int) -> Tuple[int, int]:
    """Parse 'bytes=X-Y' or 'bytes=X-' into (start, end)."""
    try:
        val   = range_header.replace("bytes=", "").strip()
        parts = val.split("-")
        start = int(parts[0]) if parts[0].strip() else 0
        end   = int(parts[1]) if len(parts) > 1 and parts[1].strip() else total - 1
        start = max(0, min(start, total - 1))
        end   = max(start, min(end, total - 1))
        return start, end
    except (ValueError, IndexError):
        return 0, total - 1

import re

from fastapi import FastAPI, HTTPException, Request, Header

@app.api_route("/api/stream/{video_id}", methods=["GET", "HEAD"])
async def stream_video(
    video_id: str,
    request: Request,
    source: str = None,
    authorization: str = Header(None)
):
    """
    Stream video from Telegram using MTProto (bypasses 20MB limit)
    """
    auth_val = authorization
    user = await verify_supabase_token(auth_val)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")

    if not re.match(r'^[a-zA-Z0-9_-]{1,64}$', video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID format")
        
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip + "_stream", limit=120, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many stream requests. Try again later.")

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
                worker_url = os.environ.get("VITE_CLOUDFLARE_WORKER_URL", "https://nexusedu-proxy.mdhosainp414.workers.dev")
                return RedirectResponse(url=f"{worker_url}/drive/{drive_file_id}", status_code=302)

        if source_type == "youtube":
            raise HTTPException(status_code=400, detail="YouTube videos stream directly on client")

        # 2. Get active Telegram client
        connected = await ensure_telegram_connected()
        if not connected:
            raise HTTPException(status_code=503, detail="Telegram client is not connected.")

        if not channel_id_str or not message_id_str:
            raise HTTPException(status_code=400, detail="Video not linked to Telegram")

        channel_id = int(channel_id_str)
        message_id = int(message_id_str)
        
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
        
        # Detect actual MIME type from file content or extension
        if media and hasattr(media, 'mime_type') and media.mime_type:
            mime_type = media.mime_type
        else:
            # Fallback based on file name extension
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
                mime_type = 'video/mp4'  # Safe fallback

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
        
        # 3. Parse Range header
        range_header = request.headers.get("Range")
        start, end = _parse_range(range_header or "", file_size)

        # Cap range size per request to 50MB to prevent memory exhaustion
        MAX_RANGE_SIZE = 50 * 1024 * 1024
        if end - start + 1 > MAX_RANGE_SIZE:
            end = start + MAX_RANGE_SIZE - 1
            
        length = end - start + 1

        # 4. Stream chunks
        return StreamingResponse(
            _stream_telegram(channel_id, message_id, start, end, file_size),
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
        print(f"[NexusEdu] Stream endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ─── RUN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"[NexusEdu] Starting server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
