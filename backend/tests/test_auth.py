import pytest

@pytest.mark.asyncio
async def test_auth_login_success(async_client, mocker):
    mocker.patch("backend.dependencies.supabase.auth.signInWithPassword", return_value={"session": "valid_token"})
    response = await async_client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "password"})
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_auth_login_fail(async_client):
    response = await async_client.post("/api/v1/auth/login", json={"email": "wrong@example.com", "password": "wrong"})
    assert response.status_code == 401
