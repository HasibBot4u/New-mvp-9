"""Stage 4 — stream endpoint authorization matrix.

Exercises every gate in stream_video WITHOUT Telegram by stopping each
scenario at the exact gate under test:

  no auth            -> 401
  forged ticket      -> 401
  blocked user       -> 403
  >=3 concurrent     -> 429
  unknown chapter    -> 403 (fail-closed, Stage-2/3 behaviour)
  free chapter       -> passes authz (reaches source dispatch)
  drive source       -> 302 to worker (authz passed)
"""
import pytest

import backend.main as main

VID = "11111111-1111-4111-8111-111111111111"
CHAPTER = "22222222-2222-4222-8222-222222222222"


@pytest.fixture
def jwt_user(monkeypatch):
    async def fake_verify(authorization):
        if authorization and "Bearer good" in authorization:
            return {"sub": "user-1", "id": "user-1"}
        return None
    monkeypatch.setattr(main, "verify_supabase_token", fake_verify)

    async def not_blocked(user_id):
        return False
    monkeypatch.setattr(main, "_is_user_blocked", not_blocked)

    async def no_refresh():
        return None
    monkeypatch.setattr(main, "refresh_catalog", no_refresh)

    monkeypatch.setitem(main.concurrent_user_streams, "user-1", 0)


GOOD = {"Authorization": "Bearer good"}


@pytest.mark.asyncio
async def test_stream_no_auth_401(async_client):
    assert (await async_client.get(f"/api/stream/{VID}")).status_code == 401


@pytest.mark.asyncio
async def test_stream_forged_ticket_401(async_client):
    r = await async_client.get(f"/api/stream/{VID}?ticket=user-1:9999999999:forged")
    assert r.status_code == 401


@pytest.mark.asyncio
@pytest.mark.usefixtures("jwt_user")
async def test_stream_blocked_user_403(async_client, monkeypatch):
    async def blocked(user_id):
        return True
    monkeypatch.setattr(main, "_is_user_blocked", blocked)
    r = await async_client.get(f"/api/stream/{VID}", headers=GOOD)
    assert r.status_code == 403


@pytest.mark.asyncio
@pytest.mark.usefixtures("jwt_user")
async def test_stream_concurrent_cap_429(async_client):
    main.concurrent_user_streams["user-1"] = 3
    try:
        r = await async_client.get(f"/api/stream/{VID}", headers=GOOD)
        assert r.status_code == 429
    finally:
        main.concurrent_user_streams["user-1"] = 0


@pytest.mark.asyncio
@pytest.mark.usefixtures("jwt_user")
async def test_stream_unknown_chapter_fails_closed_403(async_client, monkeypatch):
    """Fail-closed regression guard (Stage-2/3): chapter missing from the
    lookup AND still missing after refresh must DENY, not allow."""
    monkeypatch.setattr(main, "video_map", {VID: {"chapter_id": CHAPTER, "source_type": "telegram"}})
    monkeypatch.setattr(main, "chapter_lookup", {})
    r = await async_client.get(f"/api/stream/{VID}", headers=GOOD)
    assert r.status_code == 403


@pytest.mark.asyncio
@pytest.mark.usefixtures("jwt_user")
async def test_stream_free_chapter_passes_authz(async_client, monkeypatch):
    """Positive control: a free chapter must pass authz and reach source
    dispatch (400 'not linked' proves the gate opened)."""
    monkeypatch.setattr(main, "video_map", {VID: {
        "chapter_id": CHAPTER, "source_type": "telegram", "channel_id": "", "message_id": 0}})
    monkeypatch.setattr(main, "chapter_lookup", {CHAPTER: {"requires_enrollment": False}})
    r = await async_client.get(f"/api/stream/{VID}", headers=GOOD)
    assert r.status_code in (400, 503)
    assert r.status_code != 403


@pytest.mark.asyncio
@pytest.mark.usefixtures("jwt_user")
async def test_stream_drive_source_redirects(async_client, monkeypatch):
    monkeypatch.setattr(main, "video_map", {VID: {
        "chapter_id": CHAPTER, "source_type": "drive", "drive_file_id": "abc123XYZ_-"}})
    monkeypatch.setattr(main, "chapter_lookup", {CHAPTER: {"requires_enrollment": False}})
    r = await async_client.get(f"/api/stream/{VID}", headers=GOOD)
    assert r.status_code == 302
    assert "/drive/abc123XYZ_-" in r.headers["location"]
