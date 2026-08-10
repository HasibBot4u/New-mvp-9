"""Stage 4 — progress-batch API matrix: validation boundaries and the
unknown-video business rule, exercised through the real FastAPI app."""
import pytest

import backend.main as main


@pytest.fixture
def authed(monkeypatch):
    async def fake_verify(authorization):
        if authorization and "good" in authorization:
            return {"sub": "user-good", "id": "user-good"}
        return None
    monkeypatch.setattr(main, "verify_supabase_token", fake_verify)


GOOD = {"Authorization": "Bearer good"}


@pytest.mark.asyncio
async def test_progress_requires_auth(async_client):
    r = await async_client.post("/api/progress/batch", json={
        "updates": [{"video_id": "v1", "progress": 10, "duration": 100}]})
    assert r.status_code == 401


@pytest.mark.asyncio
@pytest.mark.usefixtures("authed")
async def test_progress_rejects_empty_batch(async_client):
    r = await async_client.post("/api/progress/batch", json={"updates": []}, headers=GOOD)
    assert r.status_code == 422  # min_length=1


@pytest.mark.asyncio
@pytest.mark.usefixtures("authed")
async def test_progress_rejects_bad_video_id(async_client):
    r = await async_client.post("/api/progress/batch", json={
        "updates": [{"video_id": "bad id with spaces!!", "progress": 1, "duration": 2}]}, headers=GOOD)
    assert r.status_code == 422


@pytest.mark.asyncio
@pytest.mark.usefixtures("authed")
async def test_progress_rejects_absurd_values(async_client):
    r = await async_client.post("/api/progress/batch", json={
        "updates": [{"video_id": "v1", "progress": 90000, "duration": 100}]}, headers=GOOD)
    assert r.status_code == 422  # progress > 86400 cap
    r = await async_client.post("/api/progress/batch", json={
        "updates": [{"video_id": "v1", "progress": -5, "duration": 100}]}, headers=GOOD)
    assert r.status_code == 422


@pytest.mark.asyncio
@pytest.mark.usefixtures("authed")
async def test_progress_batch_size_capped_at_100(async_client):
    updates = [{"video_id": f"v{i}", "progress": 1, "duration": 2} for i in range(101)]
    r = await async_client.post("/api/progress/batch", json={"updates": updates}, headers=GOOD)
    assert r.status_code == 422


@pytest.mark.asyncio
@pytest.mark.usefixtures("authed")
async def test_unknown_videos_are_skipped_when_catalog_loaded(async_client, monkeypatch):
    """Business rule: when the catalog is loaded, progress for videos that
    do not exist must be dropped, not inserted."""
    monkeypatch.setattr(main, "video_map", {"known-video": {"chapter_id": "c"}})
    r = await async_client.post("/api/progress/batch", json={
        "updates": [{"video_id": "ghost-video", "progress": 5, "duration": 10}]}, headers=GOOD)
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "message": "no valid updates"}
