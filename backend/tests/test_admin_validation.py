"""Stage 4 — admin endpoint validation matrix (auth bypassed by fixture so
the validation layer itself is what's under test)."""
import pytest

import backend.main as main


@pytest.fixture
def admin(monkeypatch):
    async def fake_ensure(request):
        return "admin-uid"
    monkeypatch.setattr(main, "_ensure_admin", fake_ensure)


@pytest.mark.asyncio
@pytest.mark.usefixtures("admin")
async def test_admin_crud_rejects_non_uuid_ids(async_client):
    for table in ("subjects", "cycles", "chapters", "videos"):
        r = await async_client.put(f"/api/admin/{table}/not-a-uuid",
                                   json={"data": {"name": "x"}})
        assert r.status_code == 400, table
        r = await async_client.delete(f"/api/admin/{table}/id=eq.1")
        assert r.status_code == 400, table


@pytest.mark.asyncio
@pytest.mark.usefixtures("admin")
async def test_admin_crud_accepts_uuid_shape(async_client):
    """UUID shape passes validation (downstream Supabase call will fail in
    the test env, but must NOT be a 400 validation error)."""
    r = await async_client.delete("/api/admin/subjects/00000000-0000-4000-8000-000000000000")
    assert r.status_code != 400


@pytest.mark.asyncio
@pytest.mark.usefixtures("admin")
async def test_logs_since_must_be_iso_timestamp(async_client):
    r = await async_client.get("/api/admin/logs?since=DROP%20TABLE")
    assert r.status_code == 400
    r = await async_client.get("/api/admin/logs?limit=999999")
    assert r.status_code in (200, 500)  # clamps, does not 400


@pytest.mark.asyncio
async def test_admin_endpoints_reject_anonymous(async_client):
    assert (await async_client.get("/api/admin/logs")).status_code == 401
    assert (await async_client.get("/api/admin/enrollments/pending")).status_code == 401
    assert (await async_client.put("/api/admin/subjects/x", json={"data": {}})).status_code == 401
