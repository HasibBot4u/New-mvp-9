"""Feature-flag service backed by ``feature_flags``."""
from __future__ import annotations

from typing import Any

from backend.integrations import supabase_integration as sb


async def list_flags() -> list[dict[str, Any]]:
    rows = await sb.admin_request("GET", "feature_flags?order=key.asc")
    return rows or []


async def set_flag(key: str, enabled: bool, actor_id: str) -> dict[str, Any]:
    existing = await sb.admin_request("GET", f"feature_flags?key=eq.{key}")
    if not existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Unknown feature flag")
    old = existing[0].get("enabled")
    await sb.admin_request(
        "PATCH", f"feature_flags?key=eq.{key}",
        json_data={"enabled": bool(enabled), "updated_by": actor_id},
    )
    await sb.admin_request("POST", "admin_change_versions", json_data={
        "resource": "feature_flags", "resource_key": key,
        "old_value": {"enabled": old}, "new_value": {"enabled": bool(enabled)},
        "changed_by": actor_id,
    })
    return {"key": key, "enabled": bool(enabled)}


async def ensure_seed_flags() -> None:
    """Idempotently insert the default flags used by the app."""
    defaults = [
        ("live_classes", "Live Classes", "live", False),
        ("push_notifications", "Push Notifications", "notifications", False),
        ("quiz_module", "Quiz Module", "content", False),
        ("community_chat", "Community Chat", "content", False),
    ]
    for key, name, cat, default in defaults:
        await sb.admin_request(
            "POST", "feature_flags",
            json_data={"key": key, "name": name, "category": cat,
                       "enabled": default, "default_state": default},
            extra_headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
        )


async def get_public_flags() -> dict[str, bool]:
    """Flags the frontend may read (only enabled state)."""
    try:
        rows = await sb.admin_request("GET", "feature_flags?select=key,enabled")
        return {r["key"]: bool(r["enabled"]) for r in (rows or [])}
    except Exception:
        return {}
