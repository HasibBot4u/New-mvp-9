import time
import httpx
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from backend.core.security import secrets_manager
import logging

logger = logging.getLogger('NexusEdu.Audit')

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        # Log minimal info or inject a unique request ID
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Only audit admin and auth endpoints
        path = request.url.path
        if path.startswith("/api/admin/") or path.startswith("/api/auth/"):
            # Prepare audit record 
            client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
            # Push to Supabase asynchronously using htx
            await self._log_to_supabase(path, request.method, response.status_code, client_ip, process_time)
            
        return response

    async def _log_to_supabase(self, path: str, method: str, status: int, ip: str, duration: float):
        supabase_url = secrets_manager.get_secret("supabase_url")
        supabase_key = secrets_manager.get_secret("supabase_service_key")
        if not supabase_url or not supabase_key:
            return
            
        try:
            # Using fire-and-forget or proper async background task
            # For simplicity, we just block awaiting it, but a real prod might queue it.
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
                        "duration_ms": int(duration * 1000)
                    },
                    timeout=2.0
                )
        except Exception as e:
            logger.error(f"Failed to write audit log: {str(e)}")
