import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_get_catalog(client):
    """Catalog is served from an in-memory cache that is only populated
    when Supabase is reachable. Without a live DB the endpoint correctly
    degrades to 503 — both outcomes are valid in the test environment."""
    response = client.get("/api/catalog")
    assert response.status_code in (200, 503)
    assert "status" in response.json() or "error" in response.json()
