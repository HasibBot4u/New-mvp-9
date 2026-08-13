"""Approval workflow service (Stage 35).

Implements a strict, allowlist-based change-request system over the
existing `admin_change_requests` table. Requests cannot execute arbitrary
SQL/shell/Python — each action type maps to a safe, explicitly-coded
operation. State machine: PENDING → APPROVED → EXECUTED, or PENDING →
REJECTED/CANCELLED. Self-approval is prevented.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from backend.api.controlplane import settings as settings_svc
from backend.integrations import supabase_integration as sb

_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

VALID_STATUSES = {"pending", "approved", "rejected", "executed", "failed", "rolled_back", "cancelled"}
TERMINAL = {"rejected", "executed", "failed", "rolled_back", "cancelled"}

# Strict allowlist of operations that an approved request may execute.
# Each entry is (action, resource) and maps to a safe parameterised handler.
ALLOWED_OPERATIONS = {
    ("setting.update", "admin_settings"): "update_setting",
    ("feature_flag.update", "feature_flags"): "update_flag",
    ("maintenance.set", "admin_settings"): "set_maintenance",
    ("streaming.limit.update", "admin_settings"): "update_streaming_limit",
}


def _validate_uuid(v: str, label: str = "id") -> None:
    if not _UUID.match(v or ""):
        raise HTTPException(400, f"Invalid {label}")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def list_requests(
    status: Optional[str] = None, action: Optional[str] = None,
    requester: Optional[str] = None, limit: int = 50,
) -> list[dict]:
    limit = max(1, min(limit, 200))
    q = f"admin_change_requests?order=created_at.desc&limit={limit}"
    if status and status != "all":
        if status not in VALID_STATUSES:
            raise HTTPException(400, "Invalid status")
        q += f"&status=eq.{status}"
    if action:
        q += f"&action=eq.{action}"
    if requester:
        q += f"&requester_id=eq.{requester}"
    return await sb.admin_request("GET", q) or []


async def get_request(crid: str) -> dict:
    _validate_uuid(crid, "change request id")
    rows = await sb.admin_request("GET", f"admin_change_requests?id=eq.{crid}")
    if not rows:
        raise HTTPException(404, "Change request not found")
    return rows[0]


async def create_request(
    requester_id: str, action: str, resource_type: str,
    proposed_change: dict, reason: Optional[str], target_id: Optional[str] = None,
) -> dict:
    if (action, resource_type) not in ALLOWED_OPERATIONS:
        raise HTTPException(400, "Operation not in the approval allowlist")
    if not isinstance(proposed_change, dict) or not proposed_change:
        raise HTTPException(400, "proposed_change must be a non-empty object")
    return await sb.admin_request(
        "POST", "admin_change_requests",
        json_data={
            "id": str(uuid.uuid4()),
            "action": action,
            "resource_type": resource_type,
            "resource_id": target_id,
            "proposed_change": proposed_change,
            "reason": reason,
            "requester_id": requester_id,
            "status": "pending",
        },
        extra_headers={"Prefer": "return=representation"},
    )


async def approve(crid: str, approver_id: str) -> dict:
    req = await get_request(crid)
    if req["requester_id"] == approver_id:
        raise HTTPException(403, "Self-approval is not allowed")
    if req["status"] != "pending":
        raise HTTPException(409, f"Request is {req['status']}, not pending")
    rows = await sb.admin_request(
        "PATCH", f"admin_change_requests?id=eq.{crid}",
        json_data={"status": "approved", "approver_id": approver_id, "approved_at": _now()},
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0]


async def reject(crid: str, approver_id: str, reason: Optional[str]) -> dict:
    req = await get_request(crid)
    if req["status"] != "pending":
        raise HTTPException(409, f"Request is {req['status']}")
    rows = await sb.admin_request(
        "PATCH", f"admin_change_requests?id=eq.{crid}",
        json_data={"status": "rejected", "approver_id": approver_id,
                   "rejected_at": _now(), "rejection_reason": reason},
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0]


async def cancel(crid: str, requester_id: str) -> dict:
    req = await get_request(crid)
    if req["requester_id"] != requester_id:
        raise HTTPException(403, "Only the requester may cancel")
    if req["status"] != "pending":
        raise HTTPException(409, "Only pending requests can be cancelled")
    rows = await sb.admin_request(
        "PATCH", f"admin_change_requests?id=eq.{crid}",
        json_data={"status": "cancelled"},
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0]


async def execute(crid: str, actor_id: str) -> dict:
    req = await get_request(crid)
    if req["status"] != "approved":
        raise HTTPException(409, "Only approved requests can be executed")
    op = ALLOWED_OPERATIONS.get((req["action"], req["resource_type"]))
    if not op:
        raise HTTPException(400, "No allowlisted handler for operation")
    try:
        result = await _EXECUTORS[op](req["proposed_change"], actor_id)
        await sb.admin_request(
            "PATCH", f"admin_change_requests?id=eq.{crid}",
            json_data={"status": "executed", "executed_at": _now(),
                       "execution_result": {"ok": True, "summary": result}},
        )
        return {"executed": True, "result": result}
    except Exception as e:
        await sb.admin_request(
            "PATCH", f"admin_change_requests?id=eq.{crid}",
            json_data={"status": "failed", "execution_result": {"ok": False, "error": str(e)[:200]}},
        )
        raise


# ── Safe operation executors ────────────────────────────────
async def _exec_update_setting(change: dict, actor: str) -> dict:
    key = change.get("key"); value = change.get("value")
    if not key:
        raise HTTPException(400, "Missing setting key")
    await settings_svc.update_setting(key, value, actor, reason="Approved change request")
    return {"setting": key, "value": value}


async def _exec_update_flag(change: dict, actor: str) -> dict:
    from backend.api.controlplane import flags as flags_svc
    key, enabled = change.get("key"), change.get("enabled")
    if not key or not isinstance(enabled, bool):
        raise HTTPException(400, "Missing key/enabled")
    await flags_svc.set_flag(key, enabled, actor)
    return {"flag": key, "enabled": enabled}


async def _exec_set_maintenance(change: dict, actor: str) -> dict:
    from backend.api.controlplane import operations as ops
    enabled = bool(change.get("enabled"))
    await ops.set_maintenance(enabled, actor)
    return {"maintenance": enabled}


async def _exec_update_streaming_limit(change: dict, actor: str) -> dict:
    # Reuse settings validation/bounds.
    key, value = change.get("key"), change.get("value")
    if key not in {"streaming.max_concurrent_per_user", "streaming.range_max_mb",
                   "streaming.ticket_ttl_seconds"}:
        raise HTTPException(400, "Not a streaming limit setting")
    await settings_svc.update_setting(key, value, actor, reason="Approved streaming change")
    return {"setting": key, "value": value}


_EXECUTORS = {
    "update_setting": _exec_update_setting,
    "update_flag": _exec_update_flag,
    "set_maintenance": _exec_set_maintenance,
    "update_streaming_limit": _exec_update_streaming_limit,
}
