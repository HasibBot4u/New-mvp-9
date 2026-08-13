"""Admin Control Plane — Backups & Deployment readiness (Stage 35).

Read-only diagnostics derived from repository configuration. Live backup
artifacts cannot be inspected without GitHub credentials; this is
reported honestly rather than fabricated.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Request

from backend.api.controlplane.deps import require_permission
from backend.core import metrics as app_metrics

router = APIRouter(prefix="/control-plane", tags=["control-plane/ops-readiness"])


@router.get("/backups/status")
async def backups_status(request: Request):
    await require_permission(request, "operations.read")
    workflow = os.path.exists("docs/operations/db-backup.workflow.yml")
    gh_secret = bool(os.environ.get("SUPABASE_DB_URI"))
    return {
        "workflow_present": workflow,
        "github_secret_configured": gh_secret,
        "schedule": "weekly (see db-backup.workflow.yml)" if workflow else None,
        "status": "ready" if workflow and gh_secret else
                  ("workflow_only" if workflow else "not_configured"),
        "latest_artifact": "not_verifiable_here",
        "owner_action_required": not gh_secret,
    }


@router.get("/deployment/readiness")
async def deployment_readiness(request: Request):
    await require_permission(request, "operations.read")
    checks = {
        "render_yaml": os.path.exists("render.yaml"),
        "netlify_toml": os.path.exists("netlify.toml"),
        "dockerfile": os.path.exists("Dockerfile"),
        "ci_workflow": os.path.exists(".github/workflows/ci.yml"),
        "keepalive_workflow": os.path.exists(".github/workflows/keep-alive.yml"),
        "migrations_present": len([f for f in os.listdir("supabase/migrations") if f.endswith(".sql")]),
    }
    score = sum(1 for k, v in checks.items() if isinstance(v, bool) and v)
    return {
        "checks": checks,
        "readiness_score": f"{score}/5",
        "remote_verified": False,
        "owner_action_required": "Configure Render/Netlify/GitHub secrets then run scripts/verify_deploy.py",
        "runtime_metrics": app_metrics.snapshot(),
    }
