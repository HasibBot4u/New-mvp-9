"""Stage 32 Telegram/video storage control tests (no live Telegram)."""
from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "JWT_SECRET"):
        os.environ.setdefault(k, "x" if k != "JWT_SECRET" else "z")
    # Ensure no Telegram creds so status is safe regardless of environment.
    os.environ.pop("TELEGRAM_API_ID", None)
    os.environ.pop("TELEGRAM_API_HASH", None)
    os.environ.pop("PYROGRAM_SESSION_STRING", None)
    from backend.app_factory import create_app
    return TestClient(create_app())


def test_status_requires_auth(client):
    assert client.get("/api/control-plane/telegram/status").status_code == 401


def test_diagnostics_requires_auth(client):
    assert client.get("/api/control-plane/telegram/diagnostics").status_code == 401


def test_videos_requires_auth(client):
    assert client.get("/api/control-plane/telegram/videos").status_code == 401


def test_mapping_requires_auth(client):
    r = client.put("/api/control-plane/telegram/videos/11111111-1111-1111-1111-111111111111/mapping",
                   json={"message_id": 1})
    assert r.status_code == 401


def test_status_does_not_leak_secrets(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/telegram/status", headers={"Authorization": "Bearer x"})
    # May be 200 or 500 depending on DB availability, but must never contain secrets.
    body = r.text.lower()
    for secret_word in ("api_hash", "bot_token", "session_string", "service_key", "secret"):
        assert secret_word not in body
    # If reachable, confirm keys are booleans/counts, not strings of secrets.
    if r.status_code == 200:
        data = r.json()
        assert isinstance(data.get("pyrogram_configured"), bool)
        assert isinstance(data.get("bot_configured"), bool)


def test_set_mapping_rejects_bad_channel(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.put(
        "/api/control-plane/telegram/videos/11111111-1111-1111-1111-111111111111/mapping",
        headers={"Authorization": "Bearer x"},
        json={"channel_id": "not-numeric", "message_id": 5},
    )
    assert r.status_code in (400, 401, 404, 500)


def test_verify_mapping_invalid_uuid(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/telegram/videos/not-a-uuid/verify",
                   headers={"Authorization": "Bearer x"})
    assert r.status_code in (400, 401)
