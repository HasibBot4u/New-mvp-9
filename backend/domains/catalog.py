"""
Catalog domain.

Owns the in-memory catalog view (subjects → cycles → chapters → videos)
and its streaming-coordinate index. This is pure orchestration over the
Supabase integration; it contains no HTTP/telegram-framework code.

Responsibility
-------------
* Fetch active subjects/cycles/chapters/videos (+ telegram coordinates).
* Assemble the nested public catalog payload.
* Maintain ``state.video_map`` and ``state.chapter_lookup`` used by the
  streaming and authorization domains.
"""
from __future__ import annotations

import asyncio
import logging
import time
import traceback

from backend.integrations import supabase_integration as sb
from backend.integrations import telegram_client as tg_integration
from backend import state

logger = logging.getLogger("NexusEdu.Catalog")

CATALOG_TTL = 300
_catalog_lock = asyncio.Lock()


async def _fetch(path: str) -> list:
    return await sb.anon_get(path, timeout=30)


async def _fetch_all_videos() -> list:
    headers = {
        "apikey": sb.secrets_manager.get_secret("supabase_anon_key"),
        "Authorization": f"Bearer {sb.secrets_manager.get_secret('supabase_anon_key')}",
    }
    url = (
        f"{sb.base_url()}/rest/v1/videos"
        f"?is_active=eq.true&order=display_order"
        f"&select=id,chapter_id,title,title_bn,source_type,drive_file_id,"
        f"youtube_video_id,size_mb,duration,display_order"
    )
    all_videos: list = []
    offset = 0
    client = sb.client()
    while True:
        for attempt in range(3):
            try:
                r = await client.get(url, params={"offset": offset, "limit": 1000}, headers=headers, timeout=30)
                r.raise_for_status()
                batch = r.json()
                break
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(2**attempt)
        if not batch:
            break
        all_videos.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return all_videos


async def _fetch_video_secrets() -> dict:
    if not sb.secrets_manager.get_secret("supabase_service_key"):
        return {}
    headers = sb.service_headers()
    secrets: dict = {}
    offset = 0
    client = sb.client()
    while True:
        url = (
            f"{sb.base_url()}/rest/v1/videos?is_active=eq.true"
            f"&select=id,telegram_channel_id,telegram_message_id,thumbnail_telegram_message_id"
        )
        for attempt in range(3):
            try:
                r = await client.get(url, params={"offset": offset, "limit": 1000}, headers=headers, timeout=30)
                r.raise_for_status()
                batch = r.json()
                break
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(2**attempt)
        if not batch:
            break
        for v in batch:
            secrets[v["id"]] = {
                "channel_id": v.get("telegram_channel_id", ""),
                "message_id": v.get("telegram_message_id", 0),
                "thumbnail_message_id": v.get("thumbnail_telegram_message_id", 0),
            }
        if len(batch) < 1000:
            break
        offset += 1000
    return secrets


async def refresh_catalog() -> None:
    """(Re)build the catalog cache and indexes from Supabase."""
    if not sb.secrets_manager.get_secret("supabase_url") or not sb.secrets_manager.get_secret(
        "supabase_service_key"
    ):
        logger.info("[Catalog] Supabase not configured — skipping catalog.")
        return

    try:
        subjects_task = _fetch("subjects?is_active=eq.true&order=display_order")
        cycles_task = _fetch("cycles?is_active=eq.true&order=display_order")
        chapters_task = _fetch("chapters?is_active=eq.true&order=display_order")
        videos_task = _fetch_all_videos()
        secrets_task = _fetch_video_secrets()

        subjects, cycles, chapters, videos, secrets = await asyncio.gather(
            subjects_task, cycles_task, chapters_task, videos_task, secrets_task
        )

        new_map: dict = {}
        new_chapter_lookup: dict = {}
        for ch in chapters:
            new_chapter_lookup[ch["id"]] = {
                "requires_enrollment": bool(ch.get("requires_enrollment", False)),
                "cycle_id": ch.get("cycle_id"),
                "name": ch.get("name", ""),
            }
        for v in videos:
            sec = secrets.get(v["id"], {})
            new_map[v["id"]] = {
                "source_type": v.get("source_type", "telegram"),
                "drive_file_id": v.get("drive_file_id", ""),
                "youtube_video_id": v.get("youtube_video_id", ""),
                "chapter_id": v.get("chapter_id", ""),
                "channel_id": sec.get("channel_id", ""),
                "message_id": sec.get("message_id", 0),
                "thumbnail_message_id": sec.get("thumbnail_message_id", 0),
            }

        for cid in {c.get("telegram_channel_id") for c in cycles if c.get("telegram_channel_id")}:
            await tg_integration.resolve_channel(cid)

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
                    cyc_data["chapters"].append(
                        {
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
                        }
                    )
                subj_data["cycles"].append(cyc_data)
            result.append(subj_data)

        async with _catalog_lock:
            state.catalog_cache = {
                "data": {"subjects": result, "total_videos": len(videos)},
                "timestamp": time.time(),
            }
            state.video_map = new_map
            state.chapter_lookup = new_chapter_lookup
        logger.info(
            "[Catalog] loaded: %s video(s), %s chapter(s).",
            len(videos),
            len(new_chapter_lookup),
        )
    except Exception as exc:
        logger.error("[Catalog] load error: %s", exc)
        logger.error(traceback.format_exc())


def get_catalog() -> dict:
    return state.catalog_cache


def is_fresh(max_age: float = CATALOG_TTL) -> bool:
    data = state.catalog_cache.get("data")
    ts = state.catalog_cache.get("timestamp", 0)
    return bool(data and (time.time() - ts < max_age))
