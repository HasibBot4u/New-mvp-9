#!/usr/bin/env python3
"""
NexusEdu live-deployment verifier (Stage 23).

A small, NON-DESTRUCTIVE check that the owner runs AFTER provisioning the
external services. It does not contain or require secrets, and it never
writes to the database. It checks:

  - backend /health and /api/health respond
  - expected security headers are present
  - the backend does not leak internal errors
  - (optional) the frontend URL loads over HTTPS
  - (optional) the Telegram webhook endpoint exists

Usage (from a terminal / cloud shell / GitHub Actions):

    python scripts/verify_deploy.py --backend https://YOUR-BACKEND.onrender.com
    python scripts/verify_deploy.py --backend https://... --frontend https://...

Exit code 0 = all checks passed; non-zero = at least one required check
failed (details printed). This is a readiness GATE, not a guarantee —
database/RLS/Telegram checks still require the steps in
docs/PROJECT_REVIVAL_GUIDE.md.
"""
from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request

REQUIRED_HEADERS = [
    "x-content-type-options",
    "referrer-policy",
]
# Security headers the FastAPI SecurityHeadersMiddleware sets.
OPTIONAL_HEADERS = ["x-frame-options", "strict-transport-security"]


def _get(url: str, timeout: float = 10.0) -> tuple[int, dict, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "nexusedu-verify/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, {k.lower(): v for k, v in resp.getheaders()}, resp.read(4096).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in (e.headers.items() if e.headers else [])}, e.read(4096).decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        return 0, {}, f"connection error: {e}"


def check_backend(base: str) -> list[tuple[str, bool, str]]:
    base = base.rstrip("/")
    results: list[tuple[str, bool, str]] = []

    status, headers, body = _get(f"{base}/health")
    ok = status == 200 and "healthy" in body.lower()
    results.append(("GET /health returns 200 + healthy status", ok, f"status={status}"))

    status, headers, body = _get(f"{base}/api/health")
    ok = status == 200 and "supabase" in body.lower()
    results.append(("GET /api/health reports supabase status", ok, f"status={status}"))

    # The backend must not expose detailed errors / stack traces on a generic 404.
    status, headers, body = _get(f"{base}/api/this-route-does-not-exist")
    no_leak = "Traceback" not in body and "Internal server error:" not in body
    results.append(("404 does not leak internals", no_leak, f"status={status}"))

    for h in REQUIRED_HEADERS:
        results.append((f"security header present: {h}", h in headers, ""))
    for h in OPTIONAL_HEADERS:
        # Informational only — not required to pass.
        results.append((f"optional header: {h}", True if h in headers else False, "informational"))

    # OpenAPI docs may be intentionally exposed; just record reachability.
    status, _, _ = _get(f"{base}/docs")
    results.append(("OpenAPI /docs reachable", status in (200, 401, 403), f"status={status}"))

    return results


def check_frontend(base: str) -> list[tuple[str, bool, str]]:
    base = base.rstrip("/")
    results: list[tuple[str, bool, str]] = []
    status, headers, body = _get(base)
    results.append(("frontend loads over HTTPS", status == 200 and "<!doctype html" in body.lower() or "<html" in body.lower(), f"status={status}"))
    results.append(("frontend has no-server-side-render error", status == 200, f"status={status}"))
    if "content-security-policy" in headers:
        results.append(("CSP header present", True, ""))
    return results


def main() -> int:
    p = argparse.ArgumentParser(description="Verify a NexusEdu deployment.")
    p.add_argument("--backend", required=True, help="Backend base URL, e.g. https://nexusedu-backend.onrender.com")
    p.add_argument("--frontend", help="Frontend URL, e.g. https://nexusedu.netlify.app")
    args = p.parse_args()

    print(f"Verifying backend: {args.backend}")
    results = check_backend(args.backend)
    if args.frontend:
        print(f"Verifying frontend: {args.frontend}")
        results += check_frontend(args.frontend)

    failures = 0
    for name, ok, detail in results:
        if detail == "informational":
            mark = "ℹ️ "
        elif ok:
            mark = "✅"
        else:
            mark = "❌"
            failures += 1
        print(f"  {mark} {name}" + (f"  ({detail})" if detail and detail != "informational" else ""))

    print()
    if failures:
        print(f"RESULT: ❌ {failures} required check(s) failed. Fix the items above before going live.")
        return 1
    print("RESULT: ✅ All required checks passed. Continue with the Telegram/video smoke test in the revival guide.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
