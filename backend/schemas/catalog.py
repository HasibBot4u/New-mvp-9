from pydantic import BaseModel
from typing import List
from .video import VideoResponse

class CatalogResponse(BaseModel):
    status: str
    videos: List[VideoResponse]
