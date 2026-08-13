"""Admin Control Plane — settings engine.

Typed application settings stored in ``admin_settings`` (JSONB values).
The seed below defines the settings that map to real behaviour; unknown
keys are rejected. Values are validated, versioned, audited, and never
exposed when marked sensitive.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from backend.integrations import supabase_integration as sb


class SettingDef(BaseModel):
    key: str
    type: str  # string | int | bool | json
    category: str
    default: Any
    description: str = ""
    sensitive: bool = False


# Settings that correspond to real, currently-applied behaviour. Keep this
# list small and meaningful; do not add speculative toggles.
SETTING_DEFINITIONS: dict[str, SettingDef] = {
    d.key: d for d in [
        SettingDef(key="site.name", type="string", category="site",
                   default="NexusEdu", description="Public site name"),
        SettingDef(key="site.support_email", type="string", category="site",
                   default="", description="Public support contact email"),
        SettingDef(key="enrollment.allow_new_signups", type="bool", category="enrollment",
                   default=True, description="Allow new account signups"),
        SettingDef(key="streaming.max_concurrent_per_user", type="int", category="streaming",
                   default=3, description="Max concurrent streams per user"),
        SettingDef(key="streaming.range_max_mb", type="int", category="streaming",
                   default=50, description="Max bytes per range request (MB)"),
        SettingDef(key="streaming.ticket_ttl_seconds", type="int", category="streaming",
                   default=21600, description="Stream ticket lifetime in seconds (6h default)"),
        SettingDef(key="maintenance.enabled", type="bool", category="operations",
                   default=False, description="Put the site in read-only maintenance mode"),
        SettingDef(key="maintenance.message", type="string", category="operations",
                   default="We are performing maintenance. Please check back soon.",
                   description="Message shown during maintenance"),
        SettingDef(key="notifications.enable_bot_startup", type="bool", category="notifications",
                   default=True, description="Notify admins when the backend starts"),
    ]
}


def _coerce(key: str, raw: Any) -> Any:
    d = SETTING_DEFINITIONS[key]
    try:
        if d.type == "bool":
            return bool(raw) if isinstance(raw, bool) else str(raw).lower() in ("1", "true", "yes")
        if d.type == "int":
            return int(raw)
        if d.type == "json":
            return raw if isinstance(raw, (dict, list)) else {}
        return str(raw)
    except (ValueError, TypeError):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"Invalid value for {key}; expected {d.type}")


async def get_settings() -> dict[str, Any]:
    """Return current settings, applying defaults for unset keys."""
    rows = await sb.admin_request("GET", "admin_settings?select=key,value")
    stored = {r["key"]: r["value"] for r in (rows or [])}
    result = {}
    for key, d in SETTING_DEFINITIONS.items():
        result[key] = _coerce(key, stored[key]) if key in stored else d.default
    return result


async def get_public_settings() -> dict[str, Any]:
    """Settings safe to expose to anonymous/frontend."""
    s = await get_settings()
    return {
        "site.name": s["site.name"],
        "site.support_email": s["site.support_email"],
        "maintenance.enabled": s["maintenance.enabled"],
        "maintenance.message": s["maintenance.message"],
    }


async def update_setting(
    key: str, value: Any, actor_id: str, reason: str | None = None
) -> dict[str, Any]:
    if key not in SETTING_DEFINITIONS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Unknown setting key")
    coerced = _coerce(key, value)
    old = await sb.admin_request("GET", f"admin_settings?key=eq.{key}&select=value")
    old_value = old[0]["value"] if old else None
    # Upsert with version increment.
    await sb.admin_request(
        "POST", "admin_settings",
        json_data={"key": key, "value": coerced, "type": SETTING_DEFINITIONS[key].type,
                   "category": SETTING_DEFINITIONS[key].category, "updated_by": actor_id},
        extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    # Append immutable history.
    await sb.admin_request("POST", "admin_change_versions", json_data={
        "resource": "settings", "resource_key": key,
        "old_value": old_value, "new_value": coerced,
        "reason": reason, "changed_by": actor_id,
    })
    return {"key": key, "value": coerced}
