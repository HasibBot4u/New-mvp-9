import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_admin_route_requires_auth(client):
    response = client.get("/api/admin/users")
    assert response.status_code in [401, 403]
    # Standard FastAPI HTTPBearer raises 403 when missing credentials, our verify_jwt raises 401. 
    # Just asserting it's an auth error.

def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
