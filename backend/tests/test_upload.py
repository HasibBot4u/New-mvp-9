import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_upload_requires_auth(client):
    response = client.post("/api/admin/upload/chunk")
    assert response.status_code in [401, 403, 405]
