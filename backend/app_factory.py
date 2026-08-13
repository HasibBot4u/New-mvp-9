"""
FastAPI application factory.

Wires middleware, routers and the lifespan bootstrap together. ``main``
imports :func:`create_app` so ``uvicorn backend.main:app`` keeps working.
"""
from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.core.cache import cache
from backend.core.metrics import PrometheusMiddleware, TELEGRAM_CONNECTED
from backend.core.rate_limiter import rate_limiter
from backend.domains import catalog as catalog_domain
from backend.integrations import telegram_client as tg
from backend.integrations.telegram_bot import bot_manager
from backend.middleware.audit_middleware import AuditMiddleware
from backend.middleware.gzip_middleware import GZipMiddleware
from backend.core import metrics as app_metrics
from backend.middleware.http_middleware import (
    BodySizeLimitMiddleware,
    GlobalExceptionHandlerMiddleware,
    SecurityHeadersMiddleware,
    TimeoutMiddleware,
)
from backend import state

logger = logging.getLogger("NexusEdu")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("===== BACKEND STARTING =====")
    logger.info("Python: %s", sys.version)
    logger.info("Telegram credentials present: %s", tg.HAS_TELEGRAM_CREDS)
    logger.info("Supabase URL configured: %s", bool(settings.supabase_url))

    await rate_limiter.connect()
    await cache.connect()

    # Supabase async client.
    if settings.supabase_url and settings.supabase_service_key:
        try:
            from supabase import create_async_client

            state.supabase_client = await create_async_client(
                str(settings.supabase_url),
                settings.supabase_service_key.get_secret_value(),
            )
            logger.info("Supabase async client initialized")
            # Best-effort: ensure Control Plane default flags exist.
            try:
                from backend.api.controlplane.flags import ensure_seed_flags
                await ensure_seed_flags()
                logger.info("Control Plane flags seeded")
            except Exception as exc:
                logger.warning("Control Plane seed skipped: %s", exc)
        except Exception as exc:
            logger.error("Supabase init failed: %s", exc)
            state.supabase_client = None
    else:
        logger.warning("Supabase URL or KEY missing - database not available")

    # Telegram clients start in the background (non-blocking boot).
    tg_task = asyncio.create_task(tg.start_clients())

    if not (settings.telegram_webhook_secret and settings.telegram_webhook_secret.get_secret_value()):
        logger.warning(
            "TELEGRAM_WEBHOOK_SECRET is not set - bot webhook cannot verify Telegram origin."
        )
    bot_ok = await bot_manager.initialize()
    logger.info("Bot manager initialized: %s", bot_ok)

    try:
        await asyncio.wait_for(tg_task, timeout=10)
    except asyncio.TimeoutError:
        logger.warning("Telegram startup taking longer than 10s, continuing...")

    # Upload pipeline (only when a Telegram client is available).
    upload_worker_task = None
    if state.tg is not None:
        try:
            from backend.services.notification_service import init_notification_service
            from backend.services.telegram_upload_service import init_telegram_upload_service
            from backend.workers.upload_worker import UploadWorker

            init_notification_service(state.tg)
            upload_service = init_telegram_upload_service(state.tg)
            upload_service.set_channels(list(tg.CHANNEL_MAP.values()))
            worker = UploadWorker(state.tg)
            upload_worker_task = asyncio.create_task(worker.start())
        except Exception as exc:
            logger.error("Upload worker init failed: %s", exc)

    try:
        await catalog_domain.refresh_catalog()
    except Exception as exc:
        logger.error("Initial catalog refresh failed: %s", exc)

    watchdog_task = asyncio.create_task(
        tg.watchdog(on_change=lambda ok: TELEGRAM_CONNECTED.set(1 if ok else 0))
    )
    memory_task = None

    try:
        import psutil

        process = psutil.Process()
        logger.info("Startup memory: %.2f MB", process.memory_info().rss / 1024 / 1024)

        async def memory_monitor():
            while True:
                await asyncio.sleep(300)
                logger.info(
                    "Memory usage: %.2f MB",
                    process.memory_info().rss / 1024 / 1024,
                )

        memory_task = asyncio.create_task(memory_monitor())
    except Exception:
        pass

    logger.info("===== BACKEND READY =====")
    yield

    logger.info("===== BACKEND SHUTTING DOWN =====")
    for task in (watchdog_task, memory_task):
        if task is not None:
            task.cancel()
    if upload_worker_task:
        try:
            worker.stop()
            await upload_worker_task
        except Exception:
            pass
    await tg.stop_clients()
    await bot_manager.shutdown()
    await cache.close()
    from backend import state as _state
    await _state.close_http_client()


def _register_routers(app: FastAPI) -> None:
    from backend.api.admin import announcements as admin_announcements
    from backend.api.admin import auth as admin_auth
    from backend.api.admin import bulk as admin_bulk
    from backend.api.admin import content as admin_content
    from backend.api.admin import enrollment as admin_enrollment
    from backend.api.admin import operations as admin_ops
    from backend.api.admin import users as admin_users
    from backend.api.catalog import routes as catalog_routes
    from backend.api.controlplane.router import router as controlplane_router
    from backend.api.controlplane.content import router as controlplane_content_router
    from backend.api.controlplane.access import router as controlplane_access_router
    from backend.api.controlplane.enrollment import router as controlplane_enrollment_router
    from backend.api.controlplane.telegram import router as controlplane_telegram_router
    from backend.api.controlplane.streaming_router import router as controlplane_streaming_router
    from backend.api.controlplane.operations_router import router as controlplane_operations_router
    from backend.api.controlplane.approvals import router as controlplane_approvals_router
    from backend.api.controlplane.audit_router import router as controlplane_audit_router
    from backend.api.controlplane.security import router as controlplane_security_router
    from backend.api.controlplane.readiness import router as controlplane_readiness_router
    from backend.api.integrations import routes as integration_routes
    from backend.api.progress import routes as progress_routes
    from backend.api.streaming import routes as streaming_routes
    from backend.api.system import routes as system_routes

    app.include_router(system_routes.router)
    app.include_router(catalog_routes.router)
    app.include_router(streaming_routes.router)
    app.include_router(progress_routes.router)
    app.include_router(integration_routes.router)

    # Admin API (all mounted under /api/admin).
    app.include_router(admin_auth.router, prefix="/api/admin", tags=["admin/auth"])
    app.include_router(admin_users.router, prefix="/api/admin", tags=["admin/users"])
    app.include_router(admin_content.router, prefix="/api/admin", tags=["admin/content"])
    app.include_router(admin_enrollment.router, prefix="/api/admin", tags=["admin/enrollment"])
    app.include_router(admin_announcements.router, prefix="/api/admin", tags=["admin/announcements"])
    app.include_router(admin_ops.router, prefix="/api/admin", tags=["admin/operations"])
    app.include_router(admin_bulk.router, prefix="/api/admin", tags=["admin/bulk"])

    # Admin Control Plane (granular permissions, settings, flags, audit)
    app.include_router(controlplane_router, prefix="/api", tags=["control-plane"])
    app.include_router(controlplane_content_router, prefix="/api", tags=["control-plane/content"])
    app.include_router(controlplane_access_router, prefix="/api", tags=["control-plane/access"])
    app.include_router(controlplane_enrollment_router, prefix="/api", tags=["control-plane/enrollment"])
    app.include_router(controlplane_telegram_router, prefix="/api", tags=["control-plane/telegram"])
    app.include_router(controlplane_streaming_router, prefix="/api", tags=["control-plane/streaming"])
    app.include_router(controlplane_operations_router, prefix="/api", tags=["control-plane/operations"])
    app.include_router(controlplane_approvals_router, prefix="/api", tags=["control-plane/approvals"])
    app.include_router(controlplane_audit_router, prefix="/api", tags=["control-plane/audit"])
    app.include_router(controlplane_security_router, prefix="/api", tags=["control-plane/security"])
    app.include_router(controlplane_readiness_router, prefix="/api", tags=["control-plane/readiness"])


def create_app() -> FastAPI:
    app = FastAPI(title="NexusEdu Backend", lifespan=lifespan)

    # Middleware order: outermost first.
    app.add_middleware(GlobalExceptionHandlerMiddleware)
    app.add_middleware(TimeoutMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuditMiddleware)
    app.add_middleware(BodySizeLimitMiddleware, max_upload_size=50 * 1024 * 1024)
    # Compress JSON/text responses (catalog, metrics). GZipMiddleware skips
    # streaming media (video bytes are already compressed codecs and set
    # their own Content-Type), so the hot video path is unaffected.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(PrometheusMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS", "HEAD", "DELETE"],
        allow_headers=[
            "Authorization", "Content-Type", "Range", "Accept-Ranges",
            "X-Admin-Token", "X-Admin-Signature", "X-Admin-Timestamp",
        ],
        expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
    )

    _register_routers(app)

    # Expose the app for operational diagnostics.
    @app.middleware("http")
    async def _metrics_middleware(request, call_next):
        response = await call_next(request)
        # Only count API routes, not static/docs noise.
        if request.url.path.startswith("/api"):
            app_metrics.record_request(response.status_code)
        return response

    try:
        import backend.runtime as _rt
        _rt._app = app
    except Exception:
        pass
    return app
