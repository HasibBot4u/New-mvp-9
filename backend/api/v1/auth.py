from fastapi import APIRouter

router = APIRouter()

@router.post("/login")
async def login():
    return {"status": "ok"}

@router.post("/register")
async def register():
    return {"status": "ok"}
