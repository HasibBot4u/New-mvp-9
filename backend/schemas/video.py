from pydantic import BaseModel

class VideoResponse(BaseModel):
    id: str
    title: str
    source_type: str
