from fastapi import Depends, HTTPException
import httpx
from backend.config import settings

async def verify_token(authorization: str = None) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    # Normally we verify with Supabase here
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key, 
                "Authorization": authorization
            }
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid token")
        return resp.json()

async def get_current_user(token_data: dict = Depends(verify_token)) -> dict:
    return token_data
