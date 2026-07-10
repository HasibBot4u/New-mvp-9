from typing import Any, Optional, Generic, TypeVar
from pydantic import BaseModel, Field, UUID4

T = TypeVar("T")

class APIResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None

class QuizAttempt(BaseModel):
    user_id: UUID4
    quiz_id: UUID4
    score: int = Field(..., ge=0, le=100, description="Score must be between 0 and 100")
