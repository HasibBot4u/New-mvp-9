"""
Activity & audit logging service.

Best-effort, non-blocking writer for the ``activity_logs`` table. Failures
are logged but never propagated to callers: observability must never break
a user request. The audit middleware and HTTP routes share this module.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import Request

from backend.integrations import supabase_integration as sb

logger = logging.getLogger("NexusEdu.Activity")


def client_ip(request: Request) -> Optional[str]:
    if request.client:
        return request.client.host
    return None


async def log_activity(
    user_id: Optional[str],
    action: str,
    details: dict,
    request: Optional[Request] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    if not user_id:
        return
    if request is not None:
        ip = ip or client_ip(request)
        user_agent = user_agent or request.headers.get("user-agent", "")
    try:
        await sb.admin_request(
            "POST",
            "activity_logs",
            json_data={
                "user_id": user_id,
                "action": action,
                "details": details,
                "ip_address": ip,
                "user_agent": user_agent,
            },
            timeout=3.0,
        )
    except Exception as exc:
        logger.error("[Activity] failed to log %s: %s", action, exc)


async def log_audit(
    path: str,
    method: str,
    status_code: int,
    ip: Optional[str],
    duration_ms: int,
    user_id: Optional[str],
) -> None:
    try:
        await sb.admin_request(
            "POST",
            "audit_logs",
            json_data={
                "action": f"{method} {path}",
                "ip_address": ip,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "user_id": user_id,
            },
            timeout=2.0,
        )
    except Exception as exc:
        logger.error("[Audit] failed to write audit log: %s", exc)
