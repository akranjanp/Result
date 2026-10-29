#!/usr/bin/env bash
# deploy.sh - 1-Click Production Deployment Script for VPS
# Usage: bash deploy.sh

set -e

echo "=========================================================="
echo "🚀 DEPLOYING RESULT PUBLISHING SYSTEM ON VPS (DOCKER)"
echo "=========================================================="

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️ Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed successfully."
fi

# Check Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "⚠️ Docker Compose plugin not found. Installing..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

echo "📦 Building and starting PostgreSQL + App containers..."
docker compose down || true
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to become healthy..."
sleep 5

docker compose ps

echo ""
echo "=========================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "User Display App: http://<YOUR_VPS_IP>:3000/"
echo "Admin Panel:      http://<YOUR_VPS_IP>:3000/admin/"
echo "Default Admin:    admin / admin123"
echo "=========================================================="
echo "Tip: Run 'docker compose logs -f' to view live application logs."
