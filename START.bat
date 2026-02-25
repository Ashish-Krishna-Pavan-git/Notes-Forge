@echo off
setlocal
title NotesForge v5.0 Startup

cd /d "%~dp0"

echo ==========================================
echo NotesForge v5.0 - Starting Frontend + API
echo ==========================================
echo.

if not exist "frontend\package.json" (
  echo [ERROR] frontend\package.json not found.
  pause
  exit /b 1
)

if not exist "backend\backend_server.py" (
  echo [ERROR] backend\backend_server.py not found.
  pause
  exit /b 1
)

start "NotesForge Frontend" cmd /k "cd /d frontend && npm run dev"
start "NotesForge Backend" cmd /k "cd /d backend && python backend_server.py"

echo Services started in separate windows.
echo Frontend: http://localhost:5173
echo Backend : http://localhost:8000
pause
