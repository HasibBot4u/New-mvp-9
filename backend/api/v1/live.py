from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_live_classes():
    return {"status": "ok"}
