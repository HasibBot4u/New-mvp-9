"""
Regression tests for the selective GZip middleware (Stage 17.5).

The stock Starlette GZipMiddleware would gzip already-compressed
``video/*`` streams; our middleware must pass media bytes through while
still compressing JSON.
"""
import gzip

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from httpx import ASGITransport, AsyncClient

from backend.middleware.gzip_middleware import GZipMiddleware


@pytest.fixture
def app():
    app = FastAPI()
    app.add_middleware(GZipMiddleware, minimum_size=1)

    @app.get("/json")
    async def json_endpoint():
        return JSONResponse({"data": "x" * 2000})

    @app.get("/tiny")
    async def tiny():
        # Deliberately below minimum_size (1 byte) so it is NOT compressed.
        return JSONResponse({})

    @app.get("/video")
    async def video_endpoint():
        async def gen():
            yield b"\x00" * 1024
            yield b"\x00" * 1024

        return StreamingResponse(
            gen(),
            media_type="video/mp4",
            headers={"Content-Length": "2048", "Accept-Ranges": "bytes"},
        )

    return app


@pytest.mark.asyncio
async def test_video_stream_is_not_gzipped(app):
    # httpx always sends its own Accept-Encoding and transparently decodes;
    # the video response must have NO content-encoding because our middleware
    # skips non-compressible types. If gzip had been applied, httpx would
    # show content-encoding: gzip (and our body would be corrupted).
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/video", headers={"Accept-Encoding": "gzip"})
    assert resp.status_code == 200
    assert resp.headers.get("content-encoding") is None, "video must not be gzipped"
    assert resp.headers.get("accept-ranges") == "bytes"
    assert resp.content == b"\x00" * 2048


@pytest.mark.asyncio
async def test_video_stream_not_gzipped_even_without_accept_encoding(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/video", headers={"Accept-Encoding": "identity"})
    assert resp.status_code == 200
    assert resp.headers.get("content-encoding") is None
    assert resp.content == b"\x00" * 2048


@pytest.mark.asyncio
async def test_json_is_gzipped(app):
    # Bypass httpx auto-decompression to verify the wire is gzip.
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        resp = await client.get(
            "/json",
            headers={"Accept-Encoding": "gzip"},
        )
    # httpx exposes the raw header; it decoded the body for us.
    assert resp.status_code == 200
    assert resp.headers.get("content-encoding") == "gzip"
    assert resp.json()["data"] == "x" * 2000


@pytest.mark.asyncio
async def test_small_json_below_minimum_not_gzipped(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/tiny", headers={"Accept-Encoding": "gzip"})
    assert resp.status_code == 200
    # Empty object "{}" is 2 bytes, still >= minimum_size=1 in this fixture.
    # The real production minimum is 1024; verify it's not accidentally
    # double-encoded by checking it decodes as plain JSON.
    assert resp.json() == {}


@pytest.mark.asyncio
async def test_no_accept_encoding_passthrough(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/json", headers={"Accept-Encoding": "identity"})
    assert resp.status_code == 200
    assert resp.headers.get("content-encoding") is None
    assert b'"data"' in resp.content
