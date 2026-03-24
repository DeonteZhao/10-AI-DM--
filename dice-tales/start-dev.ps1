# Integrated Development Startup Script for Dice Tales (Fixed Domain Version)

Write-Host "🎲 Starting Dice Tales Development Environment..." -ForegroundColor Cyan
Write-Host "🌐 API Domain: https://api.dice-tales.xyz" -ForegroundColor Magenta

# Run dev:all
Write-Host "🚀 Starting Backend (Port 8000) & Frontend (Port 3000)..." -ForegroundColor Green
npm run dev:all
