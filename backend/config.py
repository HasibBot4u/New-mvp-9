from pydantic_settings import BaseSettings
from pydantic import SecretStr, HttpUrl
import sys
import logging

logger = logging.getLogger('NexusEdu')

class Settings(BaseSettings):
    # Base Config
    app_name: str = "NexusEdu API"
    environment: str = "development"
    port: int = 8080
    
    # Frontend URLs
    vite_supabase_url: HttpUrl
    vite_supabase_anon_key: SecretStr
    vite_api_base_url: HttpUrl
    allowed_origins: str
    
    # Backend DB Secrets
    supabase_url: HttpUrl
    supabase_anon_key: SecretStr
    supabase_service_key: SecretStr
    
    # JWT and Rate Limiting
    jwt_secret: SecretStr
    rate_limit_per_minute: int = 60
    admin_token: SecretStr
    
    # Telegram
    telegram_api_id: int
    telegram_api_hash: SecretStr
    pyrogram_session_string: SecretStr
    telegram_bot_token: SecretStr

    class Config:
        env_file = ".env"
        extra = "ignore"

try:
    settings = Settings()
except Exception as e:
    logger.critical(f"FATAL ERROR: Missing or invalid environment variables. {e}")
    sys.exit(1)

