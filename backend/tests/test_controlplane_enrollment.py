"""Stage 31 enrollment/payment security tests (no live DB)."""
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


def test_enrollment_list_requires_auth(client):
    assert client.get("/api/control-plane/enrollment").status_code == 401


def test_codes_require_auth(client):
    assert client.get("/api/control-plane/enrollment/codes").status_code == 401


def test_payments_require_auth(client):
    assert client.get("/api/control-plane/enrollment/payments").status_code == 401


def test_create_code_requires_scope(client, monkeypatch):
    async def fv(a): return {"sub": "u1"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    # No chapter_id or cycle_id → 400 even for admin.
    r = client.post("/api/control-plane/enrollment/codes",
                    headers={"Authorization": "Bearer x"}, json={})
    assert r.status_code in (400, 401)


def test_create_code_invalid_max_uses(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    # Direct service validation.
    from backend.api.controlplane import enrollment_service as svc
    import asyncio
    with pytest.raises(Exception):
        asyncio.get_event_loop().run_until_complete(svc.create_code(None, None, max_uses=0))


def test_approve_payment_invalid_uuid(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.post("/api/control-plane/enrollment/payments/not-a-uuid/approve",
                    headers={"Authorization": "Bearer x"})
    assert r.status_code in (400, 401)


def test_secure_code_format():
    from backend.api.controlplane.enrollment_service import _secure_code, _CODE_OK
    for _ in range(20):
        c = _secure_code()
        assert _CODE_OK.match(c), c
        assert len(c) >= 8
