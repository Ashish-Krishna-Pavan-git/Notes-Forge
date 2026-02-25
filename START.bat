@echo off
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

REM ---- OPTIONAL: Switch drive safely (avoids errors) ----
if exist "D:\" (
    pushd /D "D:\"
    echo Switched to D:\
) else (
    echo Drive D:\ not found — continuing in current directory.
)

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

REM Frontend
start "" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

REM Backend
start "" cmd /k "cd /d ""%BACKEND_DIR%"" && python -m uvicorn backend_server:app --reload"

REM =====================================================
echo.
echo All services started (check opened windows for logs).
pause
