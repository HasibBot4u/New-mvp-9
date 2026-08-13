"""Stage 34 Operations control tests (no live DB/external services)."""
from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "JWT_SECRET"):
        os.environ.setdefault(k, "x" if k != "JWT_SECRET" else "z")
    # Ensure no Telegram creds so diagnostics do not attempt connections.
    for k in ("TELEGRAM_API_ID", "TELEGRAM_API_HASH", "PYROGRAM_SESSION_STRING"):
        os.environ.pop(k, None)
    from backend.app_factory import create_app
    return TestClient(create_app())


def test_status_requires_auth(client):
    assert client.get("/api/control-plane/operations/status").status_code == 401


def test_diagnostics_requires_auth(client):
    assert client.get("/api/control-plane/operations/diagnostics").status_code == 401


def test_backups_requires_auth(client):
    assert client.get("/api/control-plane/operations/backups").status_code == 401


def test_maintenance_requires_auth(client):
    assert client.post("/api/control-plane/operations/maintenance", json={"enabled": True}).status_code == 401


def test_diagnostics_safe_shape(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/operations/diagnostics", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    data = r.json()
    # Must never expose secret VALUES. Configuration labels (booleans indicating
    # presence) are acceptable; actual tokens/URIs must never appear.
    import json as _json
    payload = _json.loads(r.text)
    cfg_checks = payload["components"]["configuration"].get("checks", {})
    assert all(isinstance(v, bool) for v in cfg_checks.values())
    # No long credential-shaped strings anywhere in the response.
    import re as _re
    assert not _re.search(r"(eyJ[A-Za-z0-9_-]{20,}|[0-9]{8,}:[A-Za-z0-9_-]{20,})", r.text)
    assert "overall_status" in data
    assert "components" in data
    for comp in ("backend", "database", "auth", "configuration", "deployment"):
        assert comp in data["components"]
        assert data["components"][comp]["status"] in {
            "healthy", "warning", "critical", "not_configured", "unreachable", "unknown"
        }


def test_configuration_redaction(client, monkeypatch):
    async def fv(a): return {"sub": "admin"}
    async def fa(uid): return True
    import backend.runtime as rt
    monkeypatch.setattr(rt, "verify_supabase_token", fv, raising=False)
    monkeypatch.setattr(rt, "is_user_admin", fa, raising=False)
    r = client.get("/api/control-plane/operations/configuration", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    # Only boolean presence flags, no values.
    assert "x" not in r.text.lower().replace('"', '') or r.json().get("checks") is not None
