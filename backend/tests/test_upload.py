import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_bulk_ops_require_auth(client):
    """Stage 2: /api/admin/upload/chunk never existed. The real bulk
    endpoints live at /api/admin/bulk_* and must require admin auth."""
    response = client.post("/api/admin/bulk_delete", json={
        "video_ids": ["00000000-0000-4000-8000-000000000000"],
        "confirmation": "DELETE 1",
    })
    assert response.status_code in (401, 403)


def test_bulk_url_upload_unimplemented_and_authed(client):
    response = client.post("/api/admin/bulk_url_upload", json={
        "urls": ["https://example.com/v.mp4"],
        "chapter_id": "00000000-0000-4000-8000-000000000000",
    })
    assert response.status_code in (401, 403, 501)
