from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import SecretStr, HttpUrl, ValidationError
import sys
import logging

logger = logging.getLogger('NexusEdu')

class Settings(BaseSettings):
    # Base Config
    app_name: str = "NexusEdu API"
    environment: str = "development"
    port: int = 8080
    
    # CORS
    allowed_origins: str = "http://localhost:5173"
    
    # Backend DB Secrets
    supabase_url: HttpUrl
    supabase_anon_key: SecretStr
    supabase_service_key: SecretStr
    
    # JWT and Rate Limiting
    jwt_secret: Optional[SecretStr] = None
    rate_limit_per_minute: int = 60
    admin_token: Optional[SecretStr] = None
    
    # Telegram
    telegram_api_id: Optional[int] = None
    telegram_api_hash: Optional[SecretStr] = None
    pyrogram_session_string: Optional[SecretStr] = None
    pyrogram_session_string_2: Optional[SecretStr] = None
    telegram_bot_token: Optional[SecretStr] = None
    telegram_webhook_secret: Optional[SecretStr] = None
    thumbnail_channel_id: Optional[str] = None

    # External workers
    cloudflare_worker_url: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"

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

try:
    settings = Settings()
except ValidationError as e:
    missing_fields = [str(err['loc'][0]) for err in e.errors() if err.get('type') == 'missing']
    if missing_fields:
        logger.critical(f"FATAL ERROR: Missing required environment variables: {', '.join(missing_fields)}")
    else:
        logger.critical("FATAL ERROR: Invalid environment variable configuration provided.")
    sys.exit(1)
except Exception:
    logger.critical("FATAL ERROR: Failed to load configuration.")
    sys.exit(1)

