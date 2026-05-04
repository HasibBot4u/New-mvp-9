from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_notes():
    return {"status": "ok"}
