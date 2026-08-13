"""Admin Control Plane — User, Role & Access endpoints (Stage 30)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request

from backend.api.controlplane import access as svc
from backend.api.controlplane.deps import record_audit, require_permission

router = APIRouter(prefix="/control-plane", tags=["control-plane/access"])


# ── Users ────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    request: Request,
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    await require_permission(request, "users.read")
    return await svc.list_users(search, page, page_size)


@router.get("/users/{user_id}")
async def get_user(request: Request, user_id: str):
    await require_permission(request, "users.read")
    return await svc.get_user(user_id)


@router.post("/users/{user_id}/roles/{role_id}")
async def assign_role(request: Request, user_id: str, role_id: str):
    actor = await require_permission(request, "roles.write")
    result = await svc.assign_role(user_id, role_id, actor)
    await record_audit(request, actor, "access.assign_role", "admin_user_roles",
                       resource_id=user_id, after={"role_id": role_id})
    return result


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_role(request: Request, user_id: str, role_id: str):
    actor = await require_permission(request, "roles.write")
    result = await svc.remove_role(user_id, role_id)
    await record_audit(request, actor, "access.remove_role", "admin_user_roles",
                       resource_id=user_id, after={"role_id": role_id, "removed": True})
    return result


@router.post("/users/{user_id}/block")
async def block_user(request: Request, user_id: str):
    actor = await require_permission(request, "users.write")
    result = await svc.set_user_blocked(user_id, True)
    await record_audit(request, actor, "access.block_user", "profiles",
                       resource_id=user_id, after={"is_blocked": True})
    return result


@router.post("/users/{user_id}/unblock")
async def unblock_user(request: Request, user_id: str):
    actor = await require_permission(request, "users.write")
    result = await svc.set_user_blocked(user_id, False)
    await record_audit(request, actor, "access.unblock_user", "profiles",
                       resource_id=user_id, after={"is_blocked": False})
    return result


# ── Roles ────────────────────────────────────────────────────────
@router.get("/access/roles")
async def list_roles(request: Request):
    await require_permission(request, "roles.read")
    return await svc.list_roles_with_permissions()


@router.post("/access/roles")
async def create_role(
    request: Request,
    key: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    description: Optional[str] = Body(None, embed=True),
):
    actor = await require_permission(request, "roles.write")
    result = await svc.create_role(key, name, description)
    await record_audit(request, actor, "access.create_role", "admin_roles",
                       resource_id=str(result.get("id")), after={"key": key})
    return result


@router.patch("/access/roles/{role_id}")
async def update_role(
    request: Request, role_id: str,
    name: Optional[str] = Body(None, embed=True),
    description: Optional[str] = Body(None, embed=True),
):
    actor = await require_permission(request, "roles.write")
    result = await svc.update_role(role_id, name, description)
    await record_audit(request, actor, "access.update_role", "admin_roles",
                       resource_id=role_id, after={"name": name})
    return result


@router.delete("/access/roles/{role_id}")
async def delete_role(request: Request, role_id: str):
    actor = await require_permission(request, "roles.write")
    await svc.delete_role(role_id)
    await record_audit(request, actor, "access.delete_role", "admin_roles",
                       resource_id=role_id)
    return {"deleted": role_id}


@router.put("/access/roles/{role_id}/permissions")
async def set_role_permissions(
    request: Request, role_id: str, permissions: list[str] = Body(..., embed=True)
):
    actor = await require_permission(request, "roles.write")
    result = await svc.set_role_permissions(role_id, permissions)
    await record_audit(request, actor, "access.set_permissions", "admin_role_permissions",
                       resource_id=role_id, after={"permissions": permissions})
    return result
