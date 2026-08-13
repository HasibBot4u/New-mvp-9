"""Content Control Plane service.

Manages the existing hierarchy Subjects → Cycles → Chapters → Videos.
Reuses the existing tables; adds safe reordering and archive-on-delete.
The router owns authentication/authorization/audit; this module is pure
data logic.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import HTTPException

from backend.integrations import supabase_integration as sb

RESOURCES: dict[str, dict[str, Any]] = {
    "subjects": {
        "table": "subjects",
        "fields": {"name", "name_bn", "slug", "description", "description_bn",
                   "icon", "color", "thumbnail_color", "display_order", "is_active"},
        "parent": None,
    },
    "cycles": {
        "table": "cycles",
        "fields": {"name", "name_bn", "description", "description_bn",
                   "subject_id", "display_order", "is_active", "telegram_channel_id"},
        "parent": "subject_id",
    },
    "chapters": {
        "table": "chapters",
        "fields": {"name", "name_bn", "description", "description_bn",
                   "cycle_id", "display_order", "requires_enrollment", "is_active"},
        "parent": "cycle_id",
    },
    "videos": {
        "table": "videos",
        "fields": {"title", "title_bn", "description", "description_bn",
                   "chapter_id", "source_type", "source_url", "telegram_channel_id",
                   "telegram_message_id", "youtube_video_id", "drive_file_id",
                   "thumbnail_url", "duration", "size_mb", "display_order", "is_active"},
        "parent": "chapter_id",
    },
}

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def validate_uuid(value: str, label: str = "id") -> None:
    if not _UUID_RE.match(value or ""):
        raise HTTPException(status_code=400, detail=f"Invalid {label}")


def _filter_fields(data: dict, allowed: set) -> dict:
    clean = {k: v for k, v in data.items() if k in allowed}
    if not clean:
        raise HTTPException(status_code=400, detail="No valid fields provided")
    return clean


async def list_resource(resource: str, parent_id: Optional[str] = None,
                        search: Optional[str] = None, active_only: bool = False) -> list[dict]:
    cfg = RESOURCES[resource]
    query = cfg["table"] + "?order=display_order.asc,created_at.asc"
    if parent_id:
        if cfg["parent"] is None:
            raise HTTPException(400, "Resource has no parent")
        validate_uuid(parent_id, cfg["parent"])
        query += f"&{cfg['parent']}=eq.{parent_id}"
    if active_only:
        query += "&is_active=eq.true"
    if search:
        col = "title" if resource == "videos" else "name"
        term = search[:80].replace("%", "").replace("_", "")
        query += f"&{col}=ilike.*{term}*"
    rows = await sb.admin_request("GET", query)
    return rows or []


async def get_resource(resource: str, item_id: str) -> dict:
    cfg = RESOURCES[resource]
    validate_uuid(item_id)
    rows = await sb.admin_request("GET", f"{cfg['table']}?id=eq.{item_id}&limit=1")
    if not rows:
        raise HTTPException(404, "Not found")
    return rows[0]


async def _sibling_count(cfg: dict, parent_value: Any) -> int:
    q = cfg["table"] + "?select=id"
    if cfg["parent"] and parent_value is not None:
        q += f"&{cfg['parent']}=eq.{parent_value}"
    rows = await sb.admin_request("GET", q)
    return len(rows or [])


async def create_resource(resource: str, data: dict) -> dict:
    cfg = RESOURCES[resource]
    clean = _filter_fields(data, cfg["fields"])
    if "display_order" not in clean:
        clean["display_order"] = await _sibling_count(
            cfg, clean.get(cfg["parent"]) if cfg["parent"] else None
        )
    if "is_active" not in clean:
        clean["is_active"] = False  # draft until published
    rows = await sb.admin_request(
        "POST", cfg["table"], json_data=clean,
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0] if isinstance(rows, list) and rows else rows


async def update_resource(resource: str, item_id: str, data: dict) -> dict:
    cfg = RESOURCES[resource]
    validate_uuid(item_id)
    clean = _filter_fields(data, cfg["fields"])
    # Prevent reparenting through this endpoint (avoids cross-scope moves).
    if cfg["parent"]:
        clean.pop(cfg["parent"], None)
    rows = await sb.admin_request(
        "PATCH", f"{cfg['table']}?id=eq.{item_id}", json_data=clean,
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0] if isinstance(rows, list) and rows else clean


async def set_active(resource: str, item_id: str, active: bool) -> dict:
    return await update_resource(resource, item_id, {"is_active": active})


async def delete_resource(resource: str, item_id: str) -> dict:
    """Archive (is_active=false) for hierarchy nodes to avoid cascade loss;
    hard-delete videos (leaf resources)."""
    cfg = RESOURCES[resource]
    validate_uuid(item_id)
    if resource in ("subjects", "cycles", "chapters"):
        rows = await sb.admin_request(
            "PATCH", f"{cfg['table']}?id=eq.{item_id}",
            json_data={"is_active": False},
            extra_headers={"Prefer": "return=representation"},
        )
        return {"archived": True, "id": item_id}
    await sb.admin_request("DELETE", f"{cfg['table']}?id=eq.{item_id}")
    return {"deleted": True, "id": item_id}


async def reorder(resource: str, parent_id: Optional[str], ordered_ids: list[str]) -> dict:
    cfg = RESOURCES[resource]
    if len(ordered_ids) > 500:
        raise HTTPException(400, "Too many items")
    for i in ordered_ids:
        validate_uuid(i, "item id")
    existing = await list_resource(resource, parent_id)
    if {r["id"] for r in existing} != set(ordered_ids):
        raise HTTPException(400, "ID list must match items in scope (no add/remove/cross-scope)")
    for index, item_id in enumerate(ordered_ids):
        await sb.admin_request(
            "PATCH", f"{cfg['table']}?id=eq.{item_id}",
            json_data={"display_order": index},
        )
    return {"reordered": len(ordered_ids)}
