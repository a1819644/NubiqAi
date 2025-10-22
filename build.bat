@echo off
REM Build script for NubiqAI - Windows

echo ========================================
echo   Building NubiqAI for Production
echo ========================================
echo.

REM Frontend Build
echo [1/2] Building Frontend...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend dependencies installation failed!
    pause
    exit /b %errorlevel%
)

call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b %errorlevel%
)
echo ✓ Frontend built successfully!
echo.

REM Backend Setup
echo [2/2] Setting up Backend...
cd Server
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend dependencies installation failed!
    pause
    exit /b %errorlevel%
)
echo ✓ Backend setup complete!
cd ..
echo.

echo ========================================
echo   Build Complete! 
echo ========================================
echo.
echo Frontend files: dist/
echo Backend files: Server/
echo.
echo Next steps:
echo 1. Copy 'dist' folder to your web server
echo 2. Copy 'Server' folder to your application server
echo 3. Configure environment variables (.env)
echo 4. Start backend with PM2 or Node
echo.
echo See DEPLOYMENT_GUIDE.md for details!
echo.
pause
