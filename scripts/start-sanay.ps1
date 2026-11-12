# Starts Sanay for testing: the website (http://localhost:5173) and the desktop app.
# Run it by double-clicking Start-Sanay.bat in the project folder, or from PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\start-sanay.ps1
# Options:  -WebOnly   only the website      -AppOnly   only the desktop app
# The AI voice server (Masculine / Feminine) is started by the desktop app itself when needed.
param([switch]$WebOnly, [switch]$AppOnly)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Stop-Port($port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Write-Host "Closing any Sanay that is already running..." -ForegroundColor Cyan
if (-not $WebOnly) {
  Get-Process sanay -ErrorAction SilentlyContinue | Stop-Process -Force
  Stop-Port 1420
}
if (-not $AppOnly) { Stop-Port 5173 }

if (-not (Test-Path "$root\node_modules")) {
  Write-Host "First run: installing packages..." -ForegroundColor Cyan
  pnpm install
}

if (-not $AppOnly) {
  Write-Host "Starting the website on http://localhost:5173 ..." -ForegroundColor Cyan
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root'; `$host.UI.RawUI.WindowTitle='Sanay website'; pnpm web:dev"
}

if (-not $WebOnly) {
  Write-Host "Starting the desktop app (the first build can take a few minutes)..." -ForegroundColor Cyan
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root'; `$host.UI.RawUI.WindowTitle='Sanay desktop app'; pnpm tauri dev"
}

if (-not $AppOnly) {
  for ($i = 0; $i -lt 60; $i++) {
    if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { break }
    Start-Sleep -Seconds 1
  }
  Start-Process "http://localhost:5173"
}

Write-Host ""
Write-Host "Done. Website: http://localhost:5173" -ForegroundColor Green
Write-Host "To stop: close the 'Sanay website' and 'Sanay desktop app' windows." -ForegroundColor Green
