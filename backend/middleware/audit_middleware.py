import time
import logging
import httpx
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.background import BackgroundTask
from backend.core.security import secrets_manager
from backend.core.rate_limiter import get_client_ip

logger = logging.getLogger('NexusEdu.Audit')

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Only audit admin and auth endpoints
        path = request.url.path
        if path.startswith("/api/admin/") or path.startswith("/api/auth/"):
            client_ip = get_client_ip(request)
            
            user_id = None
            if hasattr(request.state, "user") and isinstance(request.state.user, dict):
                user_id = request.state.user.get("id") or request.state.user.get("sub")
            # Fixed: _ensure_admin now sets request.state.user, so user_id is captured

            bg_task = BackgroundTask(
                self._log_to_supabase,
                path,
                request.method,
                response.status_code,
                client_ip,
                process_time,
                user_id
            )
            
            if response.background:
                old_bg = response.background
                async def combined():
                    await old_bg()
                    await bg_task()
                response.background = BackgroundTask(combined)
            else:
                response.background = bg_task
            
        return response

    async def _log_to_supabase(self, path: str, method: str, status: int, ip: str, duration: float, user_id: str | None):
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        if not supabase_url or not supabase_key:
            return
            
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{supabase_url}/rest/v1/audit_logs",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    json={
                        "action": f"{method} {path}",
                        "ip_address": ip,
                        "status_code": status,
                        "duration_ms": int(duration * 1000),
                        "user_id": user_id
                    },
                    timeout=2.0
                )
        except Exception as e:
            logger.error(f"Failed to write audit log: {str(e)}")

