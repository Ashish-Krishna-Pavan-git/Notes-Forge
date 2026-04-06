#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$APP_ROOT/frontend"
BACKEND="$APP_ROOT/backend"
FRONTEND_DIST="$FRONTEND/dist"

cd "$FRONTEND"
npm run build

export NF_SERVE_FRONTEND=1
export NF_FRONTEND_DIST="$FRONTEND_DIST"
export NF_RUNTIME_TARGET="local"
export NF_DISABLE_REMOTE_PROVIDERS="1"
export DOCX_TEMP_DIR="$APP_ROOT/.notesforge_runtime/outputs"

cd "$BACKEND"
python -m uvicorn app.main:app --host 0.0.0.0 --port 10000
