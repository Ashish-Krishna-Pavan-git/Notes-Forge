@echo off
cd /d "%~dp0"
REM =====================================================
REM NotesForge Professional - START (Corrected Version)
REM Safe for Windows CMD (no Unicode parsing errors)
REM Save encoding: ANSI or UTF-8 (without BOM)
REM =====================================================

title NotesForge Professional - Start

echo =====================================================
echo ==              NotesForge Professional             ==
echo =====================================================
echo.

REM ---- CHECK REQUIRED TOOLS ----
where node >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Node.js not found in PATH.
) else (
    echo Node.js detected.
)

where python >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Python not found in PATH.
) else (
    echo Python detected.
)

echo.
echo Starting services...
echo.

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "BACKEND_DIR=%ROOT_DIR%backend"

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Frontend folder not found: %FRONTEND_DIR%
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\backend_server.py" (
    echo [ERROR] Backend folder not found: %BACKEND_DIR%
    pause
    exit /b 1
)

echo Checking backend Python dependencies...
cd /d "%BACKEND_DIR%"
python -c "import importlib,sys;mods=['fastapi','docx','weasyprint','reportlab'];missing=[m for m in mods if importlib.util.find_spec(m) is None];sys.exit(1 if missing else 0)" >nul 2>&1
if errorlevel 1 (
    echo Some backend dependencies are missing. Installing from requirements.txt...
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies.
        echo Please run: cd backend ^&^& pip install -r requirements.txt
        pause
        exit /b 1
    )
)
cd /d "%ROOT_DIR%"

REM Frontend
start "" cmd /k "cd /d ""%FRONTEND_DIR%"" && set VITE_API_URL=http://localhost:10000 && npm run dev"

REM Backend (canonical app entrypoint)
start "" cmd /k "cd /d ""%BACKEND_DIR%"" && set FASTAPI_PORT=10000 && set NF_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000 && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 10000"

REM =====================================================
echo.
echo All services started (check opened windows for logs).
pause
