"""Stage 2: the new pending-enrollment approval endpoints must be admin-only."""
import pytest


@pytest.mark.asyncio
async def test_pending_list_requires_admin(async_client):
    response = await async_client.get("/api/admin/enrollments/pending")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_approve_requires_admin(async_client):
    response = await async_client.post(
        "/api/admin/enrollments/00000000-0000-4000-8000-000000000000/approve"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_reject_requires_admin(async_client):
    response = await async_client.post(
        "/api/admin/enrollments/00000000-0000-4000-8000-000000000000/reject"
    )
    assert response.status_code == 401
