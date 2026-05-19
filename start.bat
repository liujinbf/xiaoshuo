@echo off
title Story Workbench Launcher

echo ========================================================
echo                 Story Workbench
echo ========================================================
echo.

REM 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js v20+ from https://nodejs.org/
    pause
    exit /b 1
)

REM 2. Install dependencies if needed
if not exist "node_modules\" (
    echo [INFO] First run detected. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo [INFO] Dependencies installed successfully.
    echo.
)

REM 3. Initialize config
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Initializing .env config...
        copy .env.example .env >nul
    ) else (
        echo [WARN] .env.example not found. Skipping config initialization.
    )
)

REM 4. Open browser
echo [INFO] Ready! Starting service and opening browser...
echo [INFO] If browser does not open, visit http://127.0.0.1:4173
echo ========================================================
echo.

start /B cmd /c "ping 127.0.0.1 -n 3 >nul && start http://127.0.0.1:4173"

REM 5. Start service
call npm start

pause
