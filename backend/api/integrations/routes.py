"""
Integration-facing endpoints:

* POST /api/bot_webhook   — inbound Telegram Bot API updates (secret-verified)
* GET  /api/setup_webhook — (admin) (re)register the bot webhook
"""
from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.core.rate_limiter import check_rate_limit
from backend.api.admin._deps import ensure_admin
from backend.integrations.telegram_bot import bot_manager

router = APIRouter()
logger = logging.getLogger("NexusEdu.Webhook")


@router.post("/api/bot_webhook")
async def telegram_webhook(request: Request):
    secret = (
        settings.telegram_webhook_secret.get_secret_value()
        if settings.telegram_webhook_secret
        else ""
    )
    if secret:
        header = request.headers.get("X-Telegram-Bot-Api-Secret-Token") or request.headers.get(
            "x-telegram-bot-api-secret-token"
        )
        if not header or not hmac.compare_digest(header, secret):
            logger.warning("[Webhook] invalid or missing secret token")
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    await check_rate_limit(request, limit=60, window=60, prefix="bot_webhook")
    data = await request.json()
    logger.info("[Webhook] received update id: %s", data.get("update_id"))
    ok = await bot_manager.process_webhook(data)
    return JSONResponse(content={"ok": ok}, status_code=200)


@router.get("/api/setup_webhook")
async def setup_webhook(request: Request):
    await ensure_admin(request)
    success = await bot_manager._set_webhook()
    return {
        "success": success,
        "webhook_url": bot_manager.config.WEBHOOK_URL,
        "info": bot_manager.get_webhook_info(),
    }
