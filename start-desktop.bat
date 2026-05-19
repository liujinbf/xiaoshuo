@echo off
title Story Workbench Desktop

echo ========================================================
echo             Story Workbench Desktop
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js v20+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] First run detected. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Initializing .env config...
        copy .env.example .env >nul
    )
)

echo [INFO] Starting desktop app...
echo ========================================================
echo.

call npm run desktop

pause
