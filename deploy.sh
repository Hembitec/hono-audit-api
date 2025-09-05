#!/bin/bash

# Hono Audit API Deployment Script
# This script helps you deploy the API to various platforms

set -e

echo "🚀 Hono Audit API Deployment Script"
echo "=================================="

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Please run 'git init' first."
    exit 1
fi

# Check if we have uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes. Please commit them first."
    git status --short
    exit 1
fi

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors and try again."
    exit 1
fi

echo "✅ Build successful!"

# Test the build locally
echo "🧪 Testing the build locally..."
timeout 10s npm start &
SERVER_PID=$!
sleep 5

# Test health endpoint
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Local server test passed!"
else
    echo "❌ Local server test failed!"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

kill $SERVER_PID 2>/dev/null || true

# Deployment options
echo ""
echo "🌐 Choose your deployment platform:"
echo "1) Railway (Recommended - Full Puppeteer support)"
echo "2) Render (Good alternative)"
echo "3) Vercel (Limited Puppeteer support)"
echo "4) Docker (Local/Self-hosted)"
echo "5) Just commit and push to GitHub"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo "🚂 Deploying to Railway..."
        echo "Please visit https://railway.app and connect your GitHub repository."
        echo "Railway will automatically detect the railway.toml configuration."
        ;;
    2)
        echo "🎨 Deploying to Render..."
        echo "Please visit https://render.com and connect your GitHub repository."
        echo "Render will use the render.yaml configuration."
        ;;
    3)
        echo "▲ Deploying to Vercel..."
        if command -v vercel &> /dev/null; then
            vercel --prod
        else
            echo "Vercel CLI not found. Install it with: npm i -g vercel"
            echo "Then run: vercel --prod"
        fi
        ;;
    4)
        echo "🐳 Building Docker image..."
        docker build -t hono-audit-api .
        echo "✅ Docker image built successfully!"
        echo "Run with: docker run -p 3000:3000 hono-audit-api"
        ;;
    5)
        echo "📤 Committing and pushing to GitHub..."
        git add .
        git commit -m "Deploy: Ready for deployment" || echo "No changes to commit"
        git push origin main
        echo "✅ Pushed to GitHub! Now connect your repository to your preferred platform."
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment process initiated!"
echo ""
echo "📋 Next steps:"
echo "1. Wait for deployment to complete"
echo "2. Test your deployed API:"
echo "   curl 'https://YOUR_DOMAIN/health'"
echo "   curl 'https://YOUR_DOMAIN/audit?url=https://example.com'"
echo "3. Set up monitoring and alerts"
echo "4. Configure custom domain (optional)"
echo ""
echo "📚 For detailed instructions, see DEPLOYMENT.md"
