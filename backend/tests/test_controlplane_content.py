"""Stage 29 Content Control Plane security tests (no live DB)."""
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


def test_list_requires_auth(client):
    r = client.get("/api/control-plane/content/subjects")
    assert r.status_code == 401


def test_unknown_resource(client):
    # Authenticated as non-admin → 401 before resource check.
    r = client.get("/api/control-plane/content/does-not-exist",
                   headers={"Authorization": "Bearer x"})
    assert r.status_code == 401


def test_reorder_rejects_bad_uuid(client, monkeypatch):
    async def fake_verify(a): return {"sub": "u1"}
    async def fake_admin(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fake_verify, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fake_admin, raising=False)
    r = client.post("/api/control-plane/content/subjects/reorder",
                    headers={"Authorization": "Bearer x"},
                    json={"ordered_ids": ["not-a-uuid"]})
    assert r.status_code in (400, 401)


def test_reorder_requires_auth(client):
    r = client.post("/api/control-plane/content/subjects/reorder", json={"ordered_ids": []})
    assert r.status_code == 401


def test_get_content_rejects_bad_id(client, monkeypatch):
    async def fake_verify(a): return {"sub": "u1"}
    async def fake_admin(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fake_verify, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fake_admin, raising=False)
    r = client.get("/api/control-plane/content/videos/not-a-uuid",
                   headers={"Authorization": "Bearer x"})
    assert r.status_code in (400, 401)
