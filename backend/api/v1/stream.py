from fastapi import APIRouter

router = APIRouter()

@router.get("/{video_id}")
async def stream_video(video_id: str):
    return {"status": "streaming"}
