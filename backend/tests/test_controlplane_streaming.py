"""Stage 33 streaming control tests (no live Telegram/DB)."""
from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "JWT_SECRET"):
        os.environ.setdefault(k, "x" if k != "JWT_SECRET" else "z")
    from backend.app_factory import create_app
    return TestClient(create_app())


def test_status_requires_auth(client):
    assert client.get("/api/control-plane/streaming/status").status_code == 401


def test_videos_requires_auth(client):
    assert client.get("/api/control-plane/streaming/videos").status_code == 401


def test_settings_requires_auth(client):
    assert client.get("/api/control-plane/streaming/settings").status_code == 401


def test_invalid_setting_key(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.put("/api/control-plane/streaming/settings/nope",
                   headers={"Authorization": "Bearer x"}, json={"value": 1})
    assert r.status_code in (400, 401, 404)


def test_concurrency_bound(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    # Out-of-range value must be rejected.
    r = client.put(
        "/api/control-plane/streaming/settings/streaming.max_concurrent_per_user",
        headers={"Authorization": "Bearer x"}, json={"value": 999},
    )
    assert r.status_code == 400


def test_range_bound(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.put(
        "/api/control-plane/streaming/settings/streaming.range_max_mb",
        headers={"Authorization": "Bearer x"}, json={"value": 0},
    )
    assert r.status_code == 400


def test_video_diagnostics_invalid_uuid(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/streaming/videos/not-a-uuid/diagnostics",
                   headers={"Authorization": "Bearer x"})
    assert r.status_code in (400, 401)
