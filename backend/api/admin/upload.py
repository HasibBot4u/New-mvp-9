import logging
from typing import List, Optional
import httpx
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, UUID4, Field

from backend.dependencies import get_current_admin
from backend.core.security import secrets_manager

logger = logging.getLogger(__name__)

router = APIRouter()

class BulkUploadRequest(BaseModel):
    urls: List[str]
    chapter_id: UUID4
    
class BulkMetadataUpdateReq(BaseModel):
    # UUID4 validation prevents SQL / PostgREST filter injection when constructing URLs
    video_ids: List[UUID4] = Field(min_length=1, max_length=100)
    updates: dict
    
class BulkDeleteReq(BaseModel):
    # UUID4 validation prevents SQL / PostgREST filter injection when constructing URLs
    video_ids: List[UUID4] = Field(min_length=1, max_length=100)
    confirmation: str
    
class BulkMoveReq(BaseModel):
    # UUID4 validation prevents SQL / PostgREST filter injection when constructing URLs
    video_ids: List[UUID4] = Field(min_length=1, max_length=100)
    target_chapter_id: UUID4

@router.post("/bulk_url_upload")
async def bulk_url_upload(req: BulkUploadRequest, request: Request, user: dict = Depends(get_current_admin)):
    raise HTTPException(status_code=501, detail="Bulk URL upload is not implemented")

@router.post("/bulk_delete")
async def bulk_delete(req: BulkDeleteReq, request: Request, user: dict = Depends(get_current_admin)):
    # Require confirmation string to explicitly match the count of ids (e.g., "DELETE 3")
    # so that the client cannot accidentally perform unintended bulk deletes.
    expected_confirmation = f"DELETE {len(req.video_ids)}"
    if req.confirmation != expected_confirmation:
        raise HTTPException(status_code=400, detail=f"Confirmation string mismatch. Expected '{expected_confirmation}'")
        
    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        
        # Build filter from validated UUIDs after validation to ensure safe string interpolation
        ids_param = ",".join(str(v) for v in req.video_ids)
        
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{supabase_url}/rest/v1/videos?id=in.({ids_param})",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
            )
            resp.raise_for_status()
            
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Bulk delete failed")
        raise HTTPException(status_code=500, detail="Bulk operation failed")

@router.post("/bulk_move")
async def bulk_move(req: BulkMoveReq, request: Request, user: dict = Depends(get_current_admin)):
    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        
        # Build filter from validated UUIDs after validation to ensure safe string interpolation
        ids_param = ",".join(str(v) for v in req.video_ids)
        
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{supabase_url}/rest/v1/videos?id=in.({ids_param})",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                json={"chapter_id": str(req.target_chapter_id)}
            )
            resp.raise_for_status()
            
        return {"status": "moved"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Bulk move failed")
        raise HTTPException(status_code=500, detail="Bulk operation failed")

@router.patch("/bulk_update")
async def bulk_metadata_update(req: BulkMetadataUpdateReq, request: Request, user: dict = Depends(get_current_admin)):
    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        
        # Build filter from validated UUIDs after validation to ensure safe string interpolation
        ids_param = ",".join(str(v) for v in req.video_ids)
        
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{supabase_url}/rest/v1/videos?id=in.({ids_param})",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                json=req.updates
            )
            resp.raise_for_status()
            
        return {"status": "updated"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Bulk metadata update failed")
        raise HTTPException(status_code=500, detail="Bulk operation failed")

