@echo off
chcp 65001 >nul
title NotesForge - Stopping
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           NotesForge Professional                            ║
echo ║           Stopping Servers...                                ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo [1/2] Stopping Backend (Port 8000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
    echo ✅ Backend stopped (PID: %%a)
)
echo.

echo [2/2] Stopping Frontend (Port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
    echo ✅ Frontend stopped (PID: %%a)
)
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    ✅ SERVERS STOPPED!                       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
