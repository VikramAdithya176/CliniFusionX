<#
.SYNOPSIS
    CliniFusionX – one-command local development starter.

.DESCRIPTION
    Starts the full stack with automatic frontend rebuilding:
      • Backend  : FastAPI + SQLite  (port 8000)
      • Frontend : Vite watcher – rebuilds dist/ on every file save
                   (changes are live in the browser without restarting Docker)

.USAGE
    From the project root:
        .\dev.ps1

    Stop everything:
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        CliniFusionX – Dev Environment            ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Backend  →  http://localhost:8000               ║" -ForegroundColor Cyan
Write-Host "║  API Docs →  http://localhost:8000/docs          ║" -ForegroundColor Cyan
Write-Host "║  Frontend changes rebuild automatically          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot

# Check Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "⚠  No .env file found. Please create a .env file at the project root." -ForegroundColor Yellow
    Write-Host "   Required keys: GEMINI_API_KEY, ALLOWED_ORIGINS (optional)" -ForegroundColor Yellow
    Write-Host "   Example:" -ForegroundColor Yellow
    Write-Host "     GEMINI_API_KEY=your_key_here" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "→ Starting containers (frontend watcher + backend)..." -ForegroundColor Green
docker compose `
    -f docker-compose.yml `
    -f docker-compose.dev.yml `
    up --build
