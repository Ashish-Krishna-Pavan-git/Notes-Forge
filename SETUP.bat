@echo off
title NotesForge Setup
echo.
echo ============================================
echo    NotesForge Professional - Setup
echo    One-Click Installation
echo ============================================
echo.

echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python 3.9+ from python.org
    pause
    exit /b 1
)
for /f "tokens=2" %%a in ('python --version 2^>^&1') do echo OK Python found: %%a
echo.

echo [2/5] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found! Please install from nodejs.org
    pause
    exit /b 1
)
for /f %%a in ('node --version') do echo OK Node.js found: %%a
echo.

echo [3/5] Creating folder structure...
if not exist "backend" mkdir backend
if not exist "frontend" mkdir frontend
if not exist "frontend\src" mkdir frontend\src
if not exist "frontend\public" mkdir frontend\public
echo OK Folders created
echo.

echo [4/5] Installing Python dependencies...
python -m pip install --upgrade pip
if exist "backend\requirements.txt" (
    python -m pip install -r backend\requirements.txt
) else (
    python -m pip install fastapi uvicorn python-docx python-multipart
)
if errorlevel 1 (
    echo ERROR: Failed to install Python packages
    pause
    exit /b 1
)
echo OK Python packages installed
echo.

echo [5/5] Setting up React frontend...
cd frontend
call npm install
if errorlevel 1 (
    echo npm install failed. Trying with --force...
    call npm install --force
    if errorlevel 1 (
        echo ERROR: npm install failed completely
        cd ..
        pause
        exit /b 1
    )
)
cd ..
echo OK Frontend dependencies installed
echo.

echo ============================================
echo    SETUP COMPLETE!
echo ============================================
echo.
echo Next steps:
echo 1. Copy your Core.py, Config.py, Themes.py to backend\
echo 2. Copy Config.json, themes.json to backend\
echo 3. Double-click START.bat
echo.
pause
