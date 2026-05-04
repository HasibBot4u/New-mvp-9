#!/bin/bash
set -e

echo "🚀 Setting up NexusEdu Development Environment..."

# 1. Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed."
    exit 1
fi

# 2. Check Node version
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js and npm are not installed."
    exit 1
fi

echo "📦 Installing Node dependencies..."
npm install

echo "📦 Installing Python dependencies..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
if [ -f requirements-dev.txt ]; then
    pip install -r requirements-dev.txt
fi
cd ..

echo "⚙️ Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example. Please fill in your secrets."
fi

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env 2>/dev/null || echo "TELEGRAM_API_ID=xxx" > backend/.env
    echo "✅ Created backend/.env. Please configure Telegram credentials."
fi

echo "🐳 Starting supporting infrastructure (Redis)..."
docker-compose up -d redis

echo "✅ Setup complete! Run 'make dev' to start the application."
