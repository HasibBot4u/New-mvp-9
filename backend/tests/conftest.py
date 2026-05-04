import pytest
from httpx import AsyncClient
import pytest_asyncio
# We will mock the whole client as the main module might not exist yet
from fastapi import FastAPI
from backend.config import Settings

app = FastAPI()

@pytest.fixture
def mock_settings():
    return Settings(
        app_name="NexusEdu Test",
        environment="test",
        supabase_url="http://localhost:8000",
        supabase_anon_key="test_anon_key"
    )

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
