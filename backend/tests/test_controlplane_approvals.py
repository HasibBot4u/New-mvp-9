"""Stage 35 approval/governance tests (no live DB)."""
from __future__ import annotations

import os
import pytest


@pytest.fixture(autouse=True)
def _env():
    for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "JWT_SECRET"):
        os.environ.setdefault(k, "x" if k != "JWT_SECRET" else "z")
    for k in ("TELEGRAM_API_ID", "TELEGRAM_API_HASH", "PYROGRAM_SESSION_STRING"):
        os.environ.pop(k, None)


def test_anonymous_rejected(client):
    assert client.get("/api/control-plane/approvals").status_code == 401
    assert client.get("/api/control-plane/audit").status_code == 401
    assert client.get("/api/control-plane/security/posture").status_code == 401


def test_security_posture_no_secrets(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/security/posture", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    body = r.text.lower()
    # No secret values; only boolean presence.
    for secret in ("api_hash_value", "session_string_value", "service_key_value"):
        assert secret not in body
    data = r.json()
    assert "always_on_protections" in data
    assert isinstance(data["secrets_configured"], dict)
    assert all(isinstance(v, bool) for v in data["secrets_configured"].values())


def test_approvals_unknown_operation_rejected():
    from backend.api.controlplane import approvals_service as svc
    import asyncio
    with pytest.raises(Exception):
        asyncio.get_event_loop().run_until_complete(
            svc.create_request("u", "drop.table", "videos", {"id": 1}, None)
        )


def test_backups_readiness(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/backups/status", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    assert "workflow_present" in r.json()


def test_deployment_readiness(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/deployment/readiness", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    assert "readiness_score" in r.json()


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from backend.app_factory import create_app
    return TestClient(create_app())
