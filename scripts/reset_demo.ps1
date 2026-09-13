# Local Developer Reset & Reseed Utility for P2P Renewable Energy Marketplace
# Reseeds PostgreSQL schema and demo accounts (Ahmedabad grid) without destroying Docker volumes.

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " Resetting P2P Renewable Energy Demo Database... " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$InitSql = Join-Path $RootDir "database\init.sql"
$SeedSql = Join-Path $RootDir "database\seed_data.sql"

if (-not (Test-Path $InitSql)) {
    Write-Error "Could not find $InitSql"
    exit 1
}

Write-Host "[1/2] Re-applying schema (init.sql) via container p2p_energy_db..." -ForegroundColor Yellow
Get-Content $InitSql -Raw | docker exec -i p2p_energy_db psql -U postgres -d p2p_energy_db | Out-Null

Write-Host "[2/2] Re-seeding demo users, listings & wallets (seed_data.sql)..." -ForegroundColor Yellow
Get-Content $SeedSql -Raw | docker exec -i p2p_energy_db psql -U postgres -d p2p_energy_db | Out-Null

Write-Host "[OK] Demo database successfully reset and reseeded with 30-day validity!" -ForegroundColor Green
