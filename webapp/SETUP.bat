@echo off
cd /d "%~dp0"
title NotesForge Webapp Setup
echo.
echo ============================================
echo    NotesForge Webapp Setup
echo ============================================
echo.

echo [1/4] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3.9+ is required.
    pause
    exit /b 1
)

echo [2/4] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is required.
    pause
    exit /b 1
)

echo [3/4] Installing backend dependencies...
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo ERROR: Backend dependency installation failed.
    pause
    exit /b 1
)

echo [4/4] Installing frontend dependencies...
pushd frontend
call npm install
if errorlevel 1 (
    popd
    echo ERROR: Frontend dependency installation failed.
    pause
    exit /b 1
)
popd

echo.
echo Setup complete.
echo Run START.bat from this folder or use start-webapp.ps1.
echo.
pause
