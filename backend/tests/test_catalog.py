import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_get_catalog(client):
    response = client.get("/api/catalog")
    assert response.status_code == 200
    assert "status" in response.json()
