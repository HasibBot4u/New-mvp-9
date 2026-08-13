"""Stage 28 Control Plane security boundary tests.

These tests verify authentication/authorization without a live database:
- unauthenticated requests are rejected (401)
- non-admins are rejected (401)
- the unauthenticated health probe is open
- permission checks fail closed
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    import os
    os.environ.setdefault("SUPABASE_URL", "http://testlocal")
    os.environ.setdefault("SUPABASE_ANON_KEY", "x")
    os.environ.setdefault("SUPABASE_SERVICE_KEY", "y")
    os.environ.setdefault("JWT_SECRET", "z")
    from backend.app_factory import create_app
    return TestClient(create_app())


def test_control_plane_health_open(client):
    r = client.get("/api/control-plane/health")
    assert r.status_code == 200
    assert r.json() == {"control_plane": "ok"}


def test_status_requires_auth(client):
    r = client.get("/api/control-plane/status")
    assert r.status_code == 401


def test_settings_requires_auth(client):
    r = client.get("/api/control-plane/settings")
    assert r.status_code == 401


def test_feature_flags_requires_auth(client):
    r = client.get("/api/control-plane/feature-flags")
    assert r.status_code == 401


def test_audit_requires_auth(client):
    r = client.get("/api/control-plane/audit")
    assert r.status_code == 401


def test_roles_requires_auth(client):
    r = client.get("/api/control-plane/roles")
    assert r.status_code == 401


def test_non_admin_rejected(client, monkeypatch):
    """An authenticated but non-admin user must be rejected."""
    async def fake_verify(auth):
        return {"sub": "user-1", "email": "u@example.com"}

    async def fake_admin(uid):
        return False

    import backend.runtime as runtime
    monkeypatch.setattr(runtime, "verify_supabase_token", fake_verify, raising=False)
    monkeypatch.setattr(runtime, "is_user_admin", fake_admin, raising=False)

    r = client.get(
        "/api/control-plane/status",
        headers={"Authorization": "Bearer anything"},
    )
    assert r.status_code == 401


def test_setting_definitions_are_known():
    from backend.api.controlplane.settings import SETTING_DEFINITIONS
    # Maintenance setting must exist for the protected-route check.
    assert "maintenance.enabled" in SETTING_DEFINITIONS
    assert SETTING_DEFINITIONS["streaming.max_concurrent_per_user"].type == "int"
