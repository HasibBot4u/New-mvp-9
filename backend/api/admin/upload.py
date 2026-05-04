from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import httpx
from backend.core.security import secrets_manager, verify_admin_signature

# If we have a central router or separate app
router = APIRouter()

class BulkUploadRequest(BaseModel):
    urls: List[str]
    chapter_id: str
    
class BulkMetadataUpdateReq(BaseModel):
    video_ids: List[str]
    updates: dict
    
class BulkDeleteReq(BaseModel):
    video_ids: List[str]
    confirmation: str
    
class BulkMoveReq(BaseModel):
    video_ids: List[str]
    target_chapter_id: str

async def verify_admin(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    supabase_url = secrets_manager.get_secret("supabase_url")
    anon_key = secrets_manager.get_secret("supabase_anon_key")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{supabase_url}/auth/v1/user",
            headers={"apikey": anon_key, "Authorization": auth_header}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user = resp.json()
        resp2 = await client.get(
            f"{supabase_url}/rest/v1/profiles?select=role&id=eq.{user['id']}",
            headers={"apikey": anon_key, "Authorization": auth_header}
        )
        if resp2.status_code == 200:
            data = resp2.json()
            if data and len(data) > 0 and data[0].get("role") == "admin":
                return user
                
    raise HTTPException(status_code=401, detail="Admin required")

@router.post("/bulk_url_upload")
async def bulk_url_upload(req: BulkUploadRequest, request: Request, user=Depends(verify_admin)):
    # Simple endpoint to push items to upload queue instead of having an admin manually upload to telegram.
    # The worker would then fetch URL, upload to telegram, and process.
    # Just an example implementation snippet
    return {"status": "queued", "count": len(req.urls)}

@router.post("/bulk_delete")
async def bulk_delete(req: BulkDeleteReq, request: Request, user=Depends(verify_admin)):
    if req.confirmation != "DELETE_ALL":
        raise HTTPException(400, "Confirmation string mismatch")
        
    # Logic to bulk delete from 'videos' and 'video_variants'
    # DB cascade would handle it.
    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{supabase_url}/rest/v1/videos?id=in.({','.join(req.video_ids)})",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
            )
            resp.raise_for_status()
            
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/bulk_move")
async def bulk_move(req: BulkMoveReq, request: Request, user=Depends(verify_admin)):
    try:
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{supabase_url}/rest/v1/videos?id=in.({','.join(req.video_ids)})",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                json={"chapter_id": req.target_chapter_id}
            )
            resp.raise_for_status()
            
        return {"status": "moved"}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.patch("/bulk_update")
async def bulk_metadata_update(req: BulkMetadataUpdateReq, request: Request, user=Depends(verify_admin)):
    # Update bulk fields
        try:
            supabase_url = secrets_manager.get_secret("supabase_url")
            supabase_key = secrets_manager.get_secret("supabase_service_key")
            
            async with httpx.AsyncClient() as client:
                resp = await client.patch(
                    f"{supabase_url}/rest/v1/videos?id=in.({','.join(req.video_ids)})",
                    headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                    json=req.updates
                )
                resp.raise_for_status()
                
            return {"status": "updated"}
        except Exception as e:
            raise HTTPException(500, str(e))
