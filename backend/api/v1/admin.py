from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def admin_dashboard():
    return {"status": "ok"}
