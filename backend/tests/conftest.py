import os

# Set fallback environment variables so module-level Settings initialization passes
os.environ.setdefault("SUPABASE_URL", "http://localhost:8000")
os.environ.setdefault("SUPABASE_ANON_KEY", "test_anon_key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test_service_key")
os.environ.setdefault("JWT_SECRET", "test_jwt_secret")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from backend.main import app


@pytest.fixture
def mock_settings(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:8000")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test_anon_key")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test_service_key")
    monkeypatch.setenv("JWT_SECRET", "test_jwt_secret")
    from backend.config import Settings
    return Settings()


@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
