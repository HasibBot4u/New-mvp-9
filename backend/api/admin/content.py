"""
Admin content CRUD endpoints (subjects, cycles, chapters, videos).

All mutations:
  * require an authenticated admin,
  * validate UUID path ids (PostgREST filter-injection defence),
  * whitelist mutable fields,
  * optionally verify the HMAC second factor,
  * trigger an asynchronous catalog refresh.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.api.admin._deps import (
    ensure_admin,
    ensure_admin_signature,
    filter_allowed,
    validate_entity_id,
)
from backend.domains import catalog as catalog_domain
from backend.integrations import supabase_integration as sb

router = APIRouter()

ALLOWED_SUBJECT_FIELDS = {
    "name", "name_bn", "slug", "description", "description_bn", "icon",
    "color", "thumbnail_color", "display_order", "is_active",
}
ALLOWED_CYCLE_FIELDS = {
    "name", "name_bn", "description", "description_bn", "subject_id",
    "display_order", "is_active", "telegram_channel_id",
}
ALLOWED_CHAPTER_FIELDS = {
    "name", "name_bn", "description", "description_bn", "cycle_id",
    "display_order", "is_active", "requires_enrollment",
}
ALLOWED_VIDEO_FIELDS = {
    "title", "title_bn", "description", "description_bn", "chapter_id",
    "source_type", "source_url", "telegram_channel_id", "telegram_message_id",
    "youtube_video_id", "drive_file_id", "thumbnail_url", "duration",
    "size_mb", "file_size_bytes", "mime_type", "display_order", "is_active",
}


class ContentMutateReq(BaseModel):
    data: dict = Field(..., description="Validated payload for admin content mutation")

    def model_post_init(self, __context):
        for k in self.data.keys():
            if k.startswith("_") or "$" in k or "__" in k:
                raise ValueError(f"Invalid field name: {k}")


def _schedule_refresh() -> None:
    asyncio.create_task(catalog_domain.refresh_catalog())


async def _mutate(method: str, endpoint: str, req: ContentMutateReq, request: Request,
                  allowed: set, entity_id: str | None = None):
    ensure_admin_signature(request, req.model_dump_json(), required=False)
    if entity_id is not None:
        validate_entity_id(entity_id)
    filtered = filter_allowed(req.data, allowed)
    if not filtered:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No valid fields provided")
    return await sb.admin_request(method, endpoint, json_data=filtered)


# ── Subjects ────────────────────────────────────────────────────
@router.post("/subjects")
async def create_subject(req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("POST", "subjects", req, request, ALLOWED_SUBJECT_FIELDS)
    _schedule_refresh()
    return resp


@router.put("/subjects/{subject_id}")
async def update_subject(subject_id: str, req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("PATCH", f"subjects?id=eq.{subject_id}", req, request,
                         ALLOWED_SUBJECT_FIELDS, subject_id)
    _schedule_refresh()
    return resp


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, request: Request):
    await ensure_admin(request)
    validate_entity_id(subject_id)
    ensure_admin_signature(request, "", required=False)
    resp = await sb.admin_request("DELETE", f"subjects?id=eq.{subject_id}")
    _schedule_refresh()
    return {"status": "ok"}


# ── Cycles ──────────────────────────────────────────────────────
@router.post("/cycles")
async def create_cycle(req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("POST", "cycles", req, request, ALLOWED_CYCLE_FIELDS)
    _schedule_refresh()
    return resp


@router.put("/cycles/{cycle_id}")
async def update_cycle(cycle_id: str, req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("PATCH", f"cycles?id=eq.{cycle_id}", req, request,
                   ALLOWED_CYCLE_FIELDS, cycle_id)
    _schedule_refresh()
    return resp


@router.delete("/cycles/{cycle_id}")
async def delete_cycle(cycle_id: str, request: Request):
    await ensure_admin(request)
    validate_entity_id(cycle_id)
    ensure_admin_signature(request, "", required=False)
    resp = await sb.admin_request("DELETE", f"cycles?id=eq.{cycle_id}")
    _schedule_refresh()
    return {"status": "ok"}


# ── Chapters ────────────────────────────────────────────────────
@router.post("/chapters")
async def create_chapter(req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("POST", "chapters", req, request, ALLOWED_CHAPTER_FIELDS)
    _schedule_refresh()
    return resp


@router.put("/chapters/{chapter_id}")
async def update_chapter(chapter_id: str, req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("PATCH", f"chapters?id=eq.{chapter_id}", req, request,
                   ALLOWED_CHAPTER_FIELDS, chapter_id)
    _schedule_refresh()
    return resp


@router.delete("/chapters/{chapter_id}")
async def delete_chapter(chapter_id: str, request: Request):
    await ensure_admin(request)
    validate_entity_id(chapter_id)
    ensure_admin_signature(request, "", required=False)
    resp = await sb.admin_request("DELETE", f"chapters?id=eq.{chapter_id}")
    _schedule_refresh()
    return {"status": "ok"}


# ── Videos ──────────────────────────────────────────────────────
@router.post("/videos")
async def create_video(req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("POST", "videos", req, request, ALLOWED_VIDEO_FIELDS)
    _schedule_refresh()
    return resp


@router.put("/videos/{video_id}")
async def update_video(video_id: str, req: ContentMutateReq, request: Request):
    await ensure_admin(request)
    resp = await _mutate("PATCH", f"videos?id=eq.{video_id}", req, request,
                   ALLOWED_VIDEO_FIELDS, video_id)
    _schedule_refresh()
    return resp


@router.delete("/videos/{video_id}")
async def delete_video(video_id: str, request: Request):
    await ensure_admin(request)
    validate_entity_id(video_id)
    ensure_admin_signature(request, "", required=False)
    resp = await sb.admin_request("DELETE", f"videos?id=eq.{video_id}")
    _schedule_refresh()
    return {"status": "ok"}
