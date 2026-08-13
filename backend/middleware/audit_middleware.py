"""Audit middleware: records admin/auth requests to ``audit_logs``."""
from __future__ import annotations

import time

from fastapi import Request
from starlette.background import BackgroundTask
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.rate_limiter import get_client_ip
from backend.services import activity_service


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        elapsed = time.time() - start

        path = request.url.path
        if path.startswith("/api/admin/") or path.startswith("/api/auth/"):
            ip = get_client_ip(request)
            user_id = None
            state_user = getattr(request.state, "user", None)
            if isinstance(state_user, dict):
                user_id = state_user.get("id") or state_user.get("sub")

            task = BackgroundTask(
                activity_service.log_audit,
                path,
                request.method,
                response.status_code,
                ip,
                int(elapsed * 1000),
                user_id,
            )
            if response.background:
                old = response.background

                async def combined():
                    await old()
                    await task()

                response.background = BackgroundTask(combined)
            else:
                response.background = task

        return response
