"""HTTP transport middleware (timeouts, security headers, body size, errors)."""
from __future__ import annotations

import asyncio
import logging
import os
import traceback

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("NexusEdu")


class TimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Video streams legitimately run longer than 30s over slow MTProto links.
        if request.url.path.startswith("/api/stream"):
            return await call_next(request)
        try:
            return await asyncio.wait_for(call_next(request), timeout=30.0)
        except asyncio.TimeoutError:
            return JSONResponse({"detail": "Request timeout"}, status_code=504)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        worker_domain = os.environ.get("VITE_CLOUDFLARE_WORKER_URL", "https://*.workers.dev")
        try:
            from urllib.parse import urlparse

            parsed = urlparse(worker_domain)
            worker_src = f"{parsed.scheme}://{parsed.netloc}" if parsed.netloc else "https://*.workers.dev"
        except Exception:
            worker_src = "https://*.workers.dev"

        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            f"frame-src https://www.youtube.com https://drive.google.com {worker_src}; "
            "media-src 'self' blob:; "
            "img-src 'self' https: data: blob:; "
            f"connect-src 'self' https://*.supabase.co https://*.onrender.com {worker_src} https://api.ipify.org;"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int = 50 * 1024 * 1024):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > self.max_upload_size:
                    return JSONResponse({"detail": "Request body too large"}, status_code=413)
            except ValueError:
                pass
        return await call_next(request)


class GlobalExceptionHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            if isinstance(exc, HTTPException):
                raise exc
            logger.error("[GlobalException] %s", exc)
            logger.error(traceback.format_exc())
            return JSONResponse(
                {"success": False, "error": "Internal Server Error", "data": None},
                status_code=500,
            )
