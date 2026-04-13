# Integrated Development Startup Script for Dice Tales (Cloudflare Tunnel Version)

Write-Host "🎲 Starting Dice Tales Development Environment..." -ForegroundColor Cyan

# 1. Start Backend
Write-Host "🚀 Starting Backend (Port 8000)..." -ForegroundColor Green
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload" -PassThru

# 2. Start Frontend
Write-Host "🎨 Starting Frontend (Port 3000)..." -ForegroundColor Green
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -PassThru

# 3. Start Tunnel
Write-Host "🚇 Starting Cloudflare Tunnel..." -ForegroundColor Magenta
Write-Host "⚠️  Note: You MUST update the URL in Dify every time you run this script!" -ForegroundColor Yellow
$tunnelProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cloudflared tunnel --url http://localhost:8000" -PassThru

Write-Host "`n✅ All services started in separate windows!" -ForegroundColor Cyan
Write-Host "   - Backend: http://localhost:8000"
Write-Host "   - Frontend: http://localhost:3000"
Write-Host "   - Tunnel: (Check the 'cloudflared' window for the .trycloudflare.com URL)"
