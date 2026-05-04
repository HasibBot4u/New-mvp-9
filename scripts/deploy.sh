#!/bin/bash
set -e

echo "🚀 Deploying NexusEdu..."

# Production build frontend
echo "Building frontend..."
npm run build

# Dockerize backend
echo "Building backend Docker image..."
cd backend
docker build -t nexusedu-api:latest .
cd ..

# Deployment would typically utilize Terraform or CI/CD
echo "Deployment scripts are executed via CI/CD (.github/workflows/)."
echo "Manual deployment logic can be integrated here."
