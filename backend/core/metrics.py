"""Application metrics.

Provides a Prometheus middleware plus lightweight ephemeral counters for
the Operations Control Plane. Prometheus metrics persist for the process
lifetime; the runtime counters reset on restart (clearly labeled).
"""
from __future__ import annotations

import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ── Prometheus metrics ────────────────────────────────────────
REQUEST_COUNT = Counter(
    "nexus_requests_total", "Total HTTP requests", ["method", "path", "status"]
)
REQUEST_LATENCY = Counter(
    "nexus_request_latency_seconds_total", "Total request latency", ["method", "path"]
)
TELEGRAM_CONNECTED = Gauge("nexus_telegram_connected", "1 if Telegram client is connected")


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        if request.url.path.startswith("/api"):
            REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
            REQUEST_LATENCY.labels(request.method, request.url.path).inc(time.time() - start)
        return response


def metrics_response() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ── Lightweight runtime counters (Operations dashboard) ─────────
STARTED_AT = time.time()
_runtime_requests = 0
_runtime_errors = 0
_runtime_status: dict[int, int] = {}


def record_request(status_code: int) -> None:
    global _runtime_requests, _runtime_errors
    _runtime_requests += 1
    _runtime_status[status_code] = _runtime_status.get(status_code, 0) + 1
    if status_code >= 500:
        _runtime_errors += 1


def snapshot() -> dict:
    return {
        "uptime_seconds": int(time.time() - STARTED_AT),
        "request_count": _runtime_requests,
        "error_count": _runtime_errors,
        "status_counts": dict(sorted(_runtime_status.items())),
        "telegram_connected": bool(TELEGRAM_CONNECTED._value.get()),
        "note": "Ephemeral runtime metrics; reset on restart.",
    }
