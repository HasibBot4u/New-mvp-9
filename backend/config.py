"""
Backend configuration.

Centralises environment-variable access into a single validated settings
object. All modules should import `settings` (or read a secret through
`secrets_manager`) instead of calling ``os.environ`` directly.

The required Supabase variables are enforced at import time: the process
fails fast with a clear message rather than crashing on the first request.
"""
from __future__ import annotations

import logging
import sys
from typing import Optional

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("NexusEdu")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base
    app_name: str = "NexusEdu API"
    environment: str = "development"
    port: int = 8080

    # CORS (comma-separated origins)
    allowed_origins: str = "http://localhost:5173"

    # Supabase
    supabase_url: str
    supabase_anon_key: SecretStr
    supabase_service_key: SecretStr

    # Auth / signing
    jwt_secret: Optional[SecretStr] = None
    rate_limit_per_minute: int = 60
    admin_token: Optional[SecretStr] = None

    # Telegram (MTProto streaming client)
    telegram_api_id: Optional[int] = None
    telegram_api_hash: Optional[SecretStr] = None
    pyrogram_session_string: Optional[SecretStr] = None
    pyrogram_session_string_2: Optional[SecretStr] = None

    # Telegram (Bot API webhook bot)
    telegram_bot_token: Optional[SecretStr] = None
    telegram_webhook_secret: Optional[SecretStr] = None
    admin_chat_id: str = ""
    webhook_url: str = ""
    thumbnail_channel_id: Optional[str] = None

    # External worker used to proxy Google Drive sources
    cloudflare_worker_url: Optional[str] = None

    # Redis / rate limiting
    redis_url: Optional[str] = None
    trusted_proxy_hops: int = 1

    @property
    def allowed_origins_list(self) -> list[str]:
        if not self.allowed_origins:
            return ["http://localhost:5173"]
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def telegram_enabled(self) -> bool:
        has_api_id = self.telegram_api_id is not None and self.telegram_api_id != 0
        has_api_hash = bool(self.telegram_api_hash and self.telegram_api_hash.get_secret_value())
        has_session = bool(self.pyrogram_session_string and self.pyrogram_session_string.get_secret_value())
        return has_api_id and has_api_hash and has_session


def _load_settings() -> Settings:
    try:
        return Settings()
    except Exception as exc:  # pragma: no cover - startup failure path
        # Surface a precise, actionable message for missing required vars.
        missing = []
        try:
            from pydantic import ValidationError

            if isinstance(exc, ValidationError):
                missing = [
                    str(err["loc"][0])
                    for err in exc.errors()
                    if err.get("type") == "missing"
                ]
        except Exception:
            pass
        if missing:
            logger.critical(
                "FATAL ERROR: Missing required environment variables: %s",
                ", ".join(missing),
            )
        else:
            logger.critical("FATAL ERROR: Invalid environment configuration: %s", exc)
        sys.exit(1)


settings = _load_settings()


def get_settings() -> Settings:
    """Function-style accessor (kept for compatibility with callers)."""
    return settings
