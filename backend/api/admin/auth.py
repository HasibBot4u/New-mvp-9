"""
Admin authentication & account-administration endpoints.

* POST /api/admin/verify                 — check whether the caller is an admin
* POST /api/admin/delete_user            — hard-delete a user (HMAC-gated)
* POST /api/admin/generate_chapter_code  — mint enrollment codes
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, constr

from backend.core.rate_limiter import check_rate_limit
from backend.core.security import generate_secure_hex, verify_admin_signature
from backend.domains import auth as auth_domain
from backend.integrations import supabase_integration as sb
from backend.api.admin._deps import ensure_admin

router = APIRouter()

_ISO_DT = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$"


class DeleteUserReq(BaseModel):
    user_id: constr(min_length=36, max_length=36)
    confirmation_text: constr(min_length=1, max_length=50)


class GenerateChapterCodeReq(BaseModel):
    chapter_id: Optional[constr(min_length=36, max_length=36)] = None
    cycle_id: Optional[constr(min_length=36, max_length=36)] = None
    type: Optional[str] = Field(default="chapter", pattern="^(chapter|cycle)$")
    notes: Optional[str] = Field(default="", max_length=500)
    label: Optional[str] = Field(default="", max_length=200)
    max_uses: int = Field(default=1, ge=1, le=100)
    count: int = Field(default=1, ge=1, le=100)
    expires_at: Optional[constr(pattern=_ISO_DT)] = None


@router.post("/verify")
async def verify_admin(request: Request):
    await check_rate_limit(request, limit=10, window=60, prefix="admin_verify")
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = await runtime.verify_supabase_token(auth_header)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    is_admin = await runtime.is_user_admin(user["sub"])
    return {"is_admin": is_admin}


@router.post("/delete_user")
async def delete_user_account(req: DeleteUserReq, request: Request):
    await check_rate_limit(request, limit=5, window=60, prefix="admin_action")
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(401, "Unauthorized")
    user = await runtime.verify_supabase_token(authorization)
    if not user or not await runtime.is_user_admin(user["sub"]):
        raise HTTPException(status_code=401, detail="Unauthorized")

    signature = request.headers.get("X-Admin-Signature")
    timestamp = request.headers.get("X-Admin-Timestamp")
    if not signature or not timestamp:
        raise HTTPException(status_code=403, detail="Missing secure admin signature")
    if not verify_admin_signature(signature, req.model_dump_json(), timestamp):
        raise HTTPException(status_code=403, detail="Invalid admin signature")
    if req.confirmation_text != f"DELETE-{req.user_id}":
        raise HTTPException(400, "Invalid confirmation text")

    try:
        url = sb.base_url()
        key = sb.secrets_manager.get_secret("supabase_service_key")
        async with sb.client() as client:
            resp = await client.request(
                "DELETE",
                f"{url}/auth/v1/admin/users/{req.user_id}",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
            )
            if resp.status_code not in (200, 204, 404):
                raise HTTPException(500, "Failed to delete user via Supabase admin")
            return {"status": "User deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.post("/generate_chapter_code")
async def admin_generate_chapter_code(req: GenerateChapterCodeReq, request: Request):
    await check_rate_limit(request, limit=20, window=60, prefix="admin_action")
    authorization = request.headers.get("Authorization")
    user = await runtime.verify_supabase_token(authorization)
    if not user or not await runtime.is_user_admin(user["sub"]):
        raise HTTPException(401, "Unauthorized")

    if req.type == "chapter" and not req.chapter_id:
        raise HTTPException(400, "chapter_id is required for chapter codes")
    if req.type == "cycle" and not req.cycle_id:
        raise HTTPException(400, "cycle_id is required for cycle codes")

    try:
        rows = []
        for _ in range(req.count):
            code = f"{generate_secure_hex(3)}-{generate_secure_hex(3)}"
            rows.append(
                {
                    "chapter_id": req.chapter_id if req.type == "chapter" else None,
                    "cycle_id": req.cycle_id if req.type == "cycle" else None,
                    "code": code,
                    "max_uses": req.max_uses,
                    "notes": req.notes,
                    "label": req.label,
                    "expires_at": req.expires_at,
                    "generated_by": user["sub"],
                    "created_by": user["sub"],
                    "created_at": datetime.utcnow().isoformat() + "Z",
                }
            )
        await sb.admin_request("POST", "enrollment_codes", json_data=rows)
        return {"codes": [r["code"] for r in rows]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))
