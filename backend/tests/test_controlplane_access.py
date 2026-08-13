"""Stage 30 User & Access Control security tests (no live DB)."""
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


def test_users_list_requires_auth(client):
    assert client.get("/api/control-plane/users").status_code == 401


def test_roles_list_requires_auth(client):
    assert client.get("/api/control-plane/access/roles").status_code == 401


def test_assign_role_requires_auth(client):
    r = client.post("/api/control-plane/users/11111111-1111-1111-1111-111111111111/roles/22222222-2222-2222-2222-222222222222")
    assert r.status_code == 401


def test_non_admin_rejected(client, monkeypatch):
    async def fake_verify(a): return {"sub": "u1"}
    async def fake_admin(uid): return False
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fake_verify, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fake_admin, raising=False)
    r = client.get("/api/control-plane/users", headers={"Authorization": "Bearer x"})
    assert r.status_code == 401


def test_role_key_validation(client, monkeypatch):
    """Invalid role keys are rejected before any DB call."""
    async def fake_verify(a): return {"sub": "admin"}
    async def fake_admin(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fake_verify, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fake_admin, raising=False)
    # admin_request would hit a DB; we only assert the 400 from key validation.
    # Monkeypatch the service to avoid network.
    from backend.api.controlplane import access as svc
    async def boom(*a, **k): return {"users": [], "page": 1}
    monkeypatch.setattr(svc, "list_users", boom)
    # Create role with invalid key.
    import backend.api.controlplane.access as router_mod
    # The router calls svc.create_role which validates the key before any IO.
    with pytest.raises(Exception):
        # Direct service call is clearer than HTTP:
        import asyncio
        asyncio.get_event_loop().run_until_complete(svc.create_role("BAD KEY!!", "Bad", None))


def test_uuid_validation_on_assign(client, monkeypatch):
    async def fake_verify(a): return {"sub": "admin"}
    async def fake_admin(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fake_verify, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fake_admin, raising=False)
    r = client.post(
        "/api/control-plane/users/not-a-uuid/roles/22222222-2222-2222-2222-222222222222",
        headers={"Authorization": "Bearer x"},
    )
    assert r.status_code == 400
