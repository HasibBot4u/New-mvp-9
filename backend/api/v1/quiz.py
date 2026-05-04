from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_quizzes():
    return {"status": "ok"}
