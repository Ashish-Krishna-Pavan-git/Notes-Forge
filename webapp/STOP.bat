@echo off
title NotesForge Webapp - Stop
echo.
echo Stopping NotesForge development servers...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :10000') do (
    taskkill /F /PID %%a >nul 2>&1
    echo Backend stopped (PID: %%a)
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
    echo Frontend stopped (PID: %%a)
)

echo.
echo Done.
pause
