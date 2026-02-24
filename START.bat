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

REM ====== EDIT THESE PATHS TO YOUR PROJECT ======

REM Frontend
start "" cmd /k "cd /d C:\Users\Ashish\Desktop\notesforge\frontend && npm run dev"

REM Backend
start "" cmd /k "cd /d C:\Users\Ashish\Desktop\notesforge\backend && python -m uvicorn backend_server:app --reload"

REM =====================================================
echo.
echo All services started (check opened windows for logs).
pause
