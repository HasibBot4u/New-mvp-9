"""
Selective GZip compression middleware.

The stock Starlette ``GZipMiddleware`` compresses *any* streaming response
when the client sends ``Accept-Encoding: gzip`` — including already-compressed
``video/*`` streams from ``/api/stream/``. That wastes CPU and adds latency
to media bytes. This middleware only compresses responses whose
``Content-Type`` is genuinely compressible (JSON, text, JavaScript, SVG,
XML, WASM) and otherwise passes bytes through untouched.

Streaming video (206 Partial Content, ``video/*``) and images are never
compressed, preserving Range semantics, ``Content-Length``/``Content-Range``
headers and seeking behavior.
"""
from __future__ import annotations

import gzip
import io

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Content-Types that benefit from gzip. Prefix matching covers e.g.
# application/json; charset=utf-8, text/html; charset=utf-8.
_COMPRESSIBLE_PREFIXES = (
    "text/",
    "application/json",
    "application/javascript",
    "application/x-javascript",
    "application/xml",
    "application/xhtml+xml",
    "image/svg+xml",
    "application/wasm",
)


def _is_compressible(content_type: str) -> bool:
    return any(content_type.startswith(prefix) for prefix in _COMPRESSIBLE_PREFIXES)


class GZipMiddleware:
    def __init__(self, app: ASGIApp, minimum_size: int = 500, compresslevel: int = 5) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        if "gzip" not in headers.get("Accept-Encoding", ""):
            await self.app(scope, receive, send)
            return

        responder = _GZipResponder(self.app, self.minimum_size, self.compresslevel)
        await responder(scope, receive, send)


class _GZipResponder:
    def __init__(self, app: ASGIApp, minimum_size: int, compresslevel: int) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel
        self.send: Send = self._unattached_send
        self.initial_message: Message = {}
        self.content_type: str = ""
        self.content_encoding_set = False
        self.should_compress = True
        self.started = False
        self.gzip_buffer = io.BytesIO()
        self.gzip_file = gzip.GzipFile(mode="wb", fileobj=self.gzip_buffer, compresslevel=compresslevel)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        self.send = send
        with self.gzip_buffer, self.gzip_file:
            await self.app(scope, receive, self.send_with_gzip)

    def _decide(self) -> None:
        headers = Headers(raw=self.initial_message["headers"])
        self.content_encoding_set = "content-encoding" in headers
        self.content_type = headers.get("content-type", "")
        # Only compress text/json payloads; pass video/image/already-encoded through.
        self.should_compress = (
            not self.content_encoding_set and _is_compressible(self.content_type)
        )

    async def send_with_gzip(self, message: Message) -> None:
        mtype = message["type"]
        if mtype == "http.response.start":
            self.initial_message = message
            self._decide()
            if not self.should_compress:
                self.started = True
                await self.send(self.initial_message)
        elif mtype == "http.response.body" and not self.should_compress:
            await self.send(message)
        elif mtype == "http.response.body" and self.content_encoding_set:
            if not self.started:
                self.started = True
                await self.send(self.initial_message)
            await self.send(message)
        elif mtype == "http.response.body" and not self.started:
            self.started = True
            body = message.get("body", b"")
            more_body = message.get("more_body", False)
            if len(body) < self.minimum_size and not more_body:
                await self.send(self.initial_message)
                await self.send(message)
            elif not more_body:
                self.gzip_file.write(body)
                self.gzip_file.close()
                body = self.gzip_buffer.getvalue()
                headers = MutableHeaders(raw=self.initial_message["headers"])
                headers["Content-Encoding"] = "gzip"
                headers["Content-Length"] = str(len(body))
                headers.add_vary_header("Accept-Encoding")
                message["body"] = body
                await self.send(self.initial_message)
                await self.send(message)
            else:
                headers = MutableHeaders(raw=self.initial_message["headers"])
                headers["Content-Encoding"] = "gzip"
                headers.add_vary_header("Accept-Encoding")
                del headers["Content-Length"]
                self.gzip_file.write(body)
                message["body"] = self.gzip_buffer.getvalue()
                self.gzip_buffer.seek(0)
                self.gzip_buffer.truncate()
                await self.send(self.initial_message)
                await self.send(message)
        elif mtype == "http.response.body":
            body = message.get("body", b"")
            more_body = message.get("more_body", False)
            self.gzip_file.write(body)
            if not more_body:
                self.gzip_file.close()
            message["body"] = self.gzip_buffer.getvalue()
            self.gzip_buffer.seek(0)
            self.gzip_buffer.truncate()
            await self.send(message)

    @staticmethod
    async def _unattached_send(message: Message):
        raise RuntimeError("send awaitable not set")  # pragma: no cover
