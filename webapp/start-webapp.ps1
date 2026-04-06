$ErrorActionPreference = "Stop"

$AppRoot = $PSScriptRoot
$Frontend = Join-Path $AppRoot "frontend"
$Backend = Join-Path $AppRoot "backend"
$FrontendDist = Join-Path $Frontend "dist"

Push-Location $Frontend
try {
  npm run build
} finally {
  Pop-Location
}

$env:NF_SERVE_FRONTEND = "1"
$env:NF_FRONTEND_DIST = $FrontendDist
$env:NF_RUNTIME_TARGET = "local"
$env:NF_DISABLE_REMOTE_PROVIDERS = "1"
$env:DOCX_TEMP_DIR = Join-Path $AppRoot ".notesforge_runtime\\outputs"

Push-Location $Backend
try {
  python -m uvicorn app.main:app --host 0.0.0.0 --port 10000
} finally {
  Pop-Location
}
