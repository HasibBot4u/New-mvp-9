"""Stream endpoint auth tests (Stage 2: routes corrected from /api/v1/stream)."""
import pytest


@pytest.mark.asyncio
async def test_stream_video_auth_required(async_client):
    """No credentials -> 401."""
    response = await async_client.get("/api/stream/vid_123")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_stream_video_invalid_ticket_rejected(async_client):
    """A forged/expired ticket must never authenticate."""
    response = await async_client.get(
        "/api/stream/vid_123", params={"ticket": "user:9999999999:deadbeef"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_stream_ticket_endpoint_requires_auth(async_client):
    response = await async_client.get("/api/stream-ticket/vid_123")
    assert response.status_code == 401
