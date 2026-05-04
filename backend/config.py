from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    app_name: str = "NexusEdu API"
    environment: str = "development"
    port: int = 8080
    
    # DB
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_key: Optional[str] = None

    # Telegram
    telegram_api_id: Optional[str] = None
    telegram_api_hash: Optional[str] = None
    telegram_session_string: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
