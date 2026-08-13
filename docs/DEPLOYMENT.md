# Deployment Guide

## Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Supabase Project
- Telegram API ID & Hash

## CI/CD Pipeline
Deployment is automated via GitHub Actions (`.github/workflows/`):
1. Push/PR to `main` triggers `ci.yml`: frontend typecheck/lint/test/build,
   backend `pytest`, and CodeQL security scanning.
2. On push to `main`, `ci.yml` builds the frontend and deploys `dist/` to
   **Netlify** (needs `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`).
3. `backend-deploy.yml` triggers the **Render** deploy hook
   (`RENDER_DEPLOY_HOOK`) when `backend/**` changes.
4. `keep-alive.yml` pings the backend to avoid free-tier sleep.

## Infrastructure as code
Active declarative infra lives in `render.yaml` (backend service) and
`netlify.toml` (frontend), with the container image defined by `Dockerfile`.
A previous placeholder Terraform module was removed in Stage 17 because it
referenced invalid Render resources and was never operational; do not
reintroduce Terraform unless there is a concrete multi-resource provisioning
need that `render.yaml` cannot express.

## Environment Variables
The system requires strict environment configuration. Review `.env.example` and `backend/.env.example` to ensure all production variables are provisioned.

## Scaling Strategies
- **Database**: Upgrade Supabase compute unit.
- **Backend**: Increase instance count on Render and enable auto-scaling based on CPU/Memory utilization.
- **Telegram Streamers**: Deploy dedicated worker nodes that strictly run the Pyrogram listener and chunk streamer.
