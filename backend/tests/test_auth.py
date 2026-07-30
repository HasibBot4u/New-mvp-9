import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_admin_route_requires_auth(client):
    response = client.get("/api/admin/dashboard/metrics")
    assert response.status_code in [401, 403]

def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_api_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert "status" in response.json()
