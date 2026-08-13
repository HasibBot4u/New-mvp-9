"""Admin Control Plane — Content management endpoints."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request

from backend.api.controlplane import content_service as svc
from backend.api.controlplane.deps import record_audit, require_permission

router = APIRouter(prefix="/control-plane/content", tags=["control-plane/content"])

PERM_READ = "content.read"
PERM_WRITE = "content.write"
PERM_PUBLISH = "content.publish" if False else "content.write"  # publish maps to content.write
PERM_VIDEOS = "videos.write"

_PARENTS = {"cycles": "subjects", "chapters": "cycles", "videos": "chapters"}


@router.get("/{resource}")
async def list_content(
    request: Request,
    resource: str,
    parent: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    active_only: bool = Query(False),
):
    await require_permission(request, PERM_READ)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    return await svc.list_resource(resource, parent, search, active_only)


@router.get("/{resource}/{item_id}")
async def get_content(request: Request, resource: str, item_id: str):
    await require_permission(request, PERM_READ)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    return await svc.get_resource(resource, item_id)


@router.post("/{resource}")
async def create_content(request: Request, resource: str, payload: dict = Body(...)):
    actor = await require_permission(request, PERM_WRITE)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    # Video mutations need the videos permission; everything else content.write.
    if resource == "videos":
        await require_permission(request, PERM_VIDEOS)
    result = await svc.create_resource(resource, payload)
    await record_audit(request, actor, "content.create", resource,
                       resource_id=str(result.get("id")), after=result)
    return result


@router.put("/{resource}/{item_id}")
async def update_content(request: Request, resource: str, item_id: str, payload: dict = Body(...)):
    actor = await require_permission(request, PERM_WRITE)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    if resource == "videos":
        await require_permission(request, PERM_VIDEOS)
    before = await svc.get_resource(resource, item_id)
    result = await svc.update_resource(resource, item_id, payload)
    await record_audit(request, actor, "content.update", resource,
                       resource_id=item_id, before=before, after=result)
    return result


@router.post("/{resource}/{item_id}/publish")
async def publish_content(request: Request, resource: str, item_id: str):
    actor = await require_permission(request, PERM_WRITE)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    before = await svc.get_resource(resource, item_id)
    result = await svc.set_active(resource, item_id, True)
    await record_audit(request, actor, "content.publish", resource,
                       resource_id=item_id, before=before, after=result)
    return result


@router.post("/{resource}/{item_id}/unpublish")
async def unpublish_content(request: Request, resource: str, item_id: str):
    actor = await require_permission(request, PERM_WRITE)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    before = await svc.get_resource(resource, item_id)
    result = await svc.set_active(resource, item_id, False)
    await record_audit(request, actor, "content.unpublish", resource,
                       resource_id=item_id, before=before, after=result)
    return result


@router.post("/{resource}/reorder")
async def reorder_content(
    request: Request,
    resource: str,
    parent: Optional[str] = Body(None, embed=True),
    ordered_ids: list[str] = Body(..., embed=True),
):
    actor = await require_permission(request, PERM_WRITE)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    result = await svc.reorder(resource, parent, ordered_ids)
    await record_audit(request, actor, "content.reorder", resource,
                       resource_id=parent or "root", after={"count": result["reordered"]})
    return result


@router.delete("/{resource}/{item_id}")
async def delete_content(request: Request, resource: str, item_id: str):
    actor = await require_permission(request, PERM_WRITE)
    if resource not in svc.RESOURCES:
        raise HTTPException(404, "Unknown resource")
    if resource == "videos":
        await require_permission(request, PERM_VIDEOS)
    before = await svc.get_resource(resource, item_id)
    result = await svc.delete_resource(resource, item_id)
    await record_audit(request, actor,
                       "content.delete" if resource == "videos" else "content.archive",
                       resource, resource_id=item_id, before=before)
    return result
