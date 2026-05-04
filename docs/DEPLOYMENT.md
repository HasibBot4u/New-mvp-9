# Deployment Guide

## Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Supabase Project
- Telegram API ID & Hash

## CI/CD Pipeline
Deployment is fully automated using GitHub Actions.
1. Code pushed to `main` branch.
2. `.github/workflows/ci.yml` runs tests, linting, and security scans.
3. `.github/workflows/frontend-deploy.yml` triggers Netlify/Vercel build.
4. `.github/workflows/backend-deploy.yml` triggers Render/Heroku container build and deploy.

## Manual Deployment (Infrastructure as Code)
We utilize Terraform for backend infrastructure deployment.

```bash
cd terraform
terraform init
terraform plan -var="render_api_key=$RENDER_API_KEY" -var="supabase_url=$SUPABASE_URL" ...
terraform apply
```

## Environment Variables
The system requires strict environment configuration. Review `.env.example` and `backend/.env.example` to ensure all production variables are provisioned.

## Scaling Strategies
- **Database**: Upgrade Supabase compute unit.
- **Backend**: Increase instance count on Render and enable auto-scaling based on CPU/Memory utilization.
- **Telegram Streamers**: Deploy dedicated worker nodes that strictly run the Pyrogram listener and chunk streamer.
