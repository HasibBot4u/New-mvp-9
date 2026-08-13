"""Enrollment / Access-code / Payment control service (Stage 31).

Reuses the existing schema and approval logic:
  * enrollment_codes  - chapter/cycle scoped redeemable codes
  * chapter_access    - per-user per-chapter grants
  * pending_enrollments - manual bKash/Nagad submissions (pending/approved/rejected)
No online payment gateway exists; the payments table is not used by any
user flow and is reported as not implemented.
"""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from backend.integrations import supabase_integration as sb

_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
_CODE_OK = re.compile(r"^[A-Z0-9-]{4,40}$")


def _validate_uuid(v: str, label: str = "id") -> None:
    if not _UUID.match(v or ""):
        raise HTTPException(status_code=400, detail=f"Invalid {label}")


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _secure_code() -> str:
    """Generate a human-friendly, non-sequential code (e.g. NEX-4K29-QP7M)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    parts = ["NEX"]
    for _ in range(2):
        parts.append("".join(secrets.choice(alphabet) for _ in range(4)))
    return "-".join(parts)


# ── Enrollment (chapter_access) ────────────────────────────────
async def list_enrollments(
    status: Optional[str] = None, chapter_id: Optional[str] = None,
    user_id: Optional[str] = None, limit: int = 50, offset: int = 0,
) -> list[dict]:
    limit = max(1, min(limit, 200))
    q = (
        "chapter_access?select=id,user_id,chapter_id,enrollment_code_id,is_blocked,"
        "first_accessed_at,last_accessed_at,access_count,created_at,"
        "profiles(display_name,email),chapters(name,name_bn,cycle_id)"
        f"&order=created_at.desc&limit={limit}&offset={offset}"
    )
    if status == "active":
        q += "&is_blocked=eq.false"
    elif status == "blocked":
        q += "&is_blocked=eq.true"
    if chapter_id:
        _validate_uuid(chapter_id, "chapter_id")
        q += f"&chapter_id=eq.{chapter_id}"
    if user_id:
        _validate_uuid(user_id, "user_id")
        q += f"&user_id=eq.{user_id}"
    return await sb.admin_request("GET", q) or []


async def grant_access(user_id: str, chapter_id: str) -> dict:
    _validate_uuid(user_id, "user_id")
    _validate_uuid(chapter_id, "chapter_id")
    # Verify both exist.
    if not await _exists("profiles", user_id):
        raise HTTPException(404, "User not found")
    if not await _exists("chapters", chapter_id):
        raise HTTPException(404, "Chapter not found")
    try:
        await sb.admin_request(
            "POST", "chapter_access",
            json_data={"user_id": user_id, "chapter_id": chapter_id},
        )
    except HTTPException as e:
        if e.status_code != 409 and "duplicate" not in str(e.detail).lower():
            raise
    return {"granted": True, "user_id": user_id, "chapter_id": chapter_id}


async def revoke_access(access_id: str) -> dict:
    _validate_uuid(access_id)
    # Soft revoke: block the access row (preserves audit history).
    rows = await sb.admin_request(
        "PATCH", f"chapter_access?id=eq.{access_id}",
        json_data={"is_blocked": True, "blocked_reason": "Revoked by admin"},
        extra_headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise HTTPException(404, "Enrollment not found")
    return {"revoked": True, "id": access_id}


async def restore_access(access_id: str) -> dict:
    _validate_uuid(access_id)
    await sb.admin_request(
        "PATCH", f"chapter_access?id=eq.{access_id}",
        json_data={"is_blocked": False, "blocked_reason": None},
    )
    return {"restored": True, "id": access_id}


async def _exists(table: str, item_id: str) -> bool:
    rows = await sb.admin_request("GET", f"{table}?id=eq.{item_id}&select=id")
    return bool(rows)


# ── Access codes ──────────────────────────────────────────────
async def list_codes(active: Optional[bool] = None, limit: int = 100) -> list[dict]:
    q = ("enrollment_codes?select=*,chapters(name,name_bn,cycle_id)"
         f"&order=created_at.desc&limit={max(1, min(limit, 500))}")
    if active is True:
        q += "&is_active=eq.true"
    elif active is False:
        q += "&is_active=eq.false"
    return await sb.admin_request("GET", q) or []


async def create_code(
    chapter_id: Optional[str], cycle_id: Optional[str],
    max_uses: int = 1, expires_at: Optional[str] = None,
    label: Optional[str] = None, code: Optional[str] = None,
    generated_by: Optional[str] = None,
) -> dict:
    if not chapter_id and not cycle_id:
        raise HTTPException(400, "A chapter_id or cycle_id is required")
    if chapter_id:
        _validate_uuid(chapter_id, "chapter_id")
        if not await _exists("chapters", chapter_id):
            raise HTTPException(404, "Chapter not found")
    if cycle_id:
        _validate_uuid(cycle_id, "cycle_id")
        if not await _exists("cycles", cycle_id):
            raise HTTPException(404, "Cycle not found")
    if max_uses < 1:
        raise HTTPException(400, "max_uses must be >= 1")
    if expires_at:
        try:
            datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "expires_at must be an ISO timestamp")
    chosen = (code or _secure_code()).upper()
    if not _CODE_OK.match(chosen):
        raise HTTPException(400, "Code contains invalid characters")
    rows = await sb.admin_request(
        "POST", "enrollment_codes",
        json_data={
            "chapter_id": chapter_id,
            # The schema is chapter-scoped; cycle codes use a chapter within the cycle.
            "code": chosen,
            "max_uses": max_uses,
            "expires_at": expires_at,
            "label": label,
            "is_active": True,
            "generated_by": generated_by,
            "created_by": generated_by,
        },
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0] if isinstance(rows, list) and rows else rows


async def set_code_active(code_id: str, active: bool) -> dict:
    _validate_uuid(code_id)
    rows = await sb.admin_request(
        "PATCH", f"enrollment_codes?id=eq.{code_id}",
        json_data={"is_active": active},
        extra_headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise HTTPException(404, "Code not found")
    return rows[0]


async def code_redemptions(code_id: str) -> list[dict]:
    _validate_uuid(code_id)
    return await sb.admin_request(
        "GET",
        f"chapter_access?enrollment_code_id=eq.{code_id}"
        "&select=id,user_id,first_accessed_at,profiles(display_name,email)",
    ) or []


# ── Payments (manual bKash/Nagad submissions) ─────────────────
async def list_payments(
    status_filter: str = "pending", payment_method: Optional[str] = None, limit: int = 100,
) -> list[dict]:
    if status_filter not in ("pending", "approved", "rejected", "all"):
        raise HTTPException(400, "Invalid status")
    q = (
        "pending_enrollments?select=id,user_id,chapter_id,transaction_id,payment_method,"
        "amount,status,admin_notes,reviewed_by,reviewed_at,created_at,updated_at,"
        "profiles(display_name,email),chapters(name,name_bn)"
        f"&order=created_at.desc&limit={max(1, min(limit, 200))}"
    )
    if status_filter != "all":
        q += f"&status=eq.{status_filter}"
    if payment_method:
        q += f"&payment_method=eq.{payment_method}"
    return await sb.admin_request("GET", q) or []


async def approve_payment(payment_id: str, reviewer_id: str) -> dict:
    """Approve a manual payment: idempotently grant chapter_access, set
    status approved (state machine: only pending → approved)."""
    _validate_uuid(payment_id)
    rows = await sb.admin_request("GET", f"pending_enrollments?id=eq.{payment_id}&limit=1")
    if not rows:
        raise HTTPException(404, "Payment not found")
    item = rows[0]
    if item.get("status") != "pending":
        raise HTTPException(409, f"Payment already {item.get('status')}")
    user_id, chapter_id = item.get("user_id"), item.get("chapter_id")
    if not user_id or not chapter_id:
        raise HTTPException(400, "Payment missing user/chapter")
    # Grant access (idempotent).
    try:
        await sb.admin_request(
            "POST", "chapter_access", json_data={"user_id": user_id, "chapter_id": chapter_id},
        )
    except HTTPException as e:
        if e.status_code != 409 and "duplicate" not in str(e.detail).lower():
            raise
    await sb.admin_request(
        "PATCH", f"pending_enrollments?id=eq.{payment_id}",
        json_data={"status": "approved", "reviewed_by": reviewer_id, "reviewed_at": _utcnow()},
    )
    # Best-effort notification.
    try:
        await sb.admin_request("POST", "notifications", json_data={
            "user_id": user_id, "type": "enrollment_approved",
            "title": "Payment approved",
            "title_bn": "পেমেন্ট অনুমোদিত ✅",
            "body": "Your enrollment payment has been approved.",
            "body_bn": "আপনার পেমেন্ট অনুমোদিত হয়েছে।",
            "action_url": "/dashboard",
        })
    except Exception:
        pass
    return {"status": "approved", "payment_id": payment_id, "user_id": user_id, "chapter_id": chapter_id}


async def reject_payment(payment_id: str, reviewer_id: str, reason: Optional[str] = None) -> dict:
    _validate_uuid(payment_id)
    rows = await sb.admin_request("GET", f"pending_enrollments?id=eq.{payment_id}&limit=1")
    if not rows:
        raise HTTPException(404, "Payment not found")
    if rows[0].get("status") != "pending":
        raise HTTPException(409, f"Payment already {rows[0].get('status')}")
    await sb.admin_request(
        "PATCH", f"pending_enrollments?id=eq.{payment_id}",
        json_data={"status": "rejected", "reviewed_by": reviewer_id,
                   "reviewed_at": _utcnow(), "admin_notes": reason},
    )
    return {"status": "rejected", "payment_id": payment_id}
