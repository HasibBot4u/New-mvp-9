#!/usr/bin/env bash
set -e

echo "🚀 Deploying NexusEdu..."

# Stage 2 fix: the Dockerfile lives at the REPO ROOT, not inside backend/.
# (RENDER_DEPLOYMENT_INSTRUCTIONS.md previously pointed at a nonexistent
# backend/Dockerfile.)

echo "Building frontend..."
npm run build

echo "Building backend Docker image..."
docker build -t nexusedu-api:latest .

echo "Deployment images built. Actual rollout is performed by CI/CD"
echo "(.github/workflows/ci.yml -> Netlify, backend-deploy.yml -> Render)."
