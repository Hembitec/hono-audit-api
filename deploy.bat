@echo off
setlocal enabledelayedexpansion

echo 🚀 Hono Audit API Deployment Script
echo ==================================

REM Check if we're in a git repository
if not exist ".git" (
    echo ❌ Not in a git repository. Please run 'git init' first.
    exit /b 1
)

REM Build the project
echo 🔨 Building the project...
call npm run build

if !errorlevel! neq 0 (
    echo ❌ Build failed. Please fix the errors and try again.
    exit /b 1
)

echo ✅ Build successful!

echo.
echo 🌐 Choose your deployment platform:
echo 1) Railway (Recommended - Full Puppeteer support)
echo 2) Render (Good alternative)
echo 3) Vercel (Limited Puppeteer support)
echo 4) Docker (Local/Self-hosted)
echo 5) Just commit and push to GitHub

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo 🚂 Deploying to Railway...
    echo Please visit https://railway.app and connect your GitHub repository.
    echo Railway will automatically detect the railway.toml configuration.
) else if "%choice%"=="2" (
    echo 🎨 Deploying to Render...
    echo Please visit https://render.com and connect your GitHub repository.
    echo Render will use the render.yaml configuration.
) else if "%choice%"=="3" (
    echo ▲ Deploying to Vercel...
    where vercel >nul 2>nul
    if !errorlevel! equ 0 (
        call vercel --prod
    ) else (
        echo Vercel CLI not found. Install it with: npm i -g vercel
        echo Then run: vercel --prod
    )
) else if "%choice%"=="4" (
    echo 🐳 Building Docker image...
    docker build -t hono-audit-api .
    if !errorlevel! equ 0 (
        echo ✅ Docker image built successfully!
        echo Run with: docker run -p 3000:3000 hono-audit-api
    ) else (
        echo ❌ Docker build failed. Make sure Docker is installed and running.
    )
) else if "%choice%"=="5" (
    echo 📤 Committing and pushing to GitHub...
    git add .
    git commit -m "Deploy: Ready for deployment"
    git push origin main
    echo ✅ Pushed to GitHub! Now connect your repository to your preferred platform.
) else (
    echo ❌ Invalid choice. Please run the script again.
    exit /b 1
)

echo.
echo 🎉 Deployment process initiated!
echo.
echo 📋 Next steps:
echo 1. Wait for deployment to complete
echo 2. Test your deployed API:
echo    curl "https://YOUR_DOMAIN/health"
echo    curl "https://YOUR_DOMAIN/audit?url=https://example.com"
echo 3. Set up monitoring and alerts
echo 4. Configure custom domain (optional)
echo.
echo 📚 For detailed instructions, see DEPLOYMENT.md

pause
