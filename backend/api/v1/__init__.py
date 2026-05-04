from fastapi import APIRouter

# TODO: The following routers are empty stubs and need future implementation:
# auth.py, users.py, catalog.py, stream.py, progress.py, notes.py, admin.py,
# enrollment.py, live.py, quiz.py, qa.py, analytics.py, upload.py (in v1/)

# from .auth import router as auth_router
# from .users import router as users_router
# from .catalog import router as catalog_router
# from .stream import router as stream_router
# from .progress import router as progress_router
# from .notes import router as notes_router
# from .admin import router as admin_router
# from .enrollment import router as enrollment_router
# from .live import router as live_router
# from .quiz import router as quiz_router
# from .qa import router as qa_router
# from .analytics import router as analytics_router
from backend.api.admin.upload import router as upload_router

api_router = APIRouter()
# api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
# api_router.include_router(users_router, prefix="/users", tags=["users"])
# api_router.include_router(catalog_router, prefix="/catalog", tags=["catalog"])
# api_router.include_router(stream_router, prefix="/stream", tags=["stream"])
# api_router.include_router(progress_router, prefix="/progress", tags=["progress"])
# api_router.include_router(notes_router, prefix="/notes", tags=["notes"])
# api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
# api_router.include_router(enrollment_router, prefix="/enrollment", tags=["enrollment"])
# api_router.include_router(live_router, prefix="/live", tags=["live"])
# api_router.include_router(quiz_router, prefix="/quiz", tags=["quiz"])
# api_router.include_router(qa_router, prefix="/qa", tags=["qa"])
# api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(upload_router, prefix="/upload", tags=["upload"])
