@echo off
REM Liberty Social - Demo Data Cleanup Script (Windows)
REM This script removes all demo data created by setup_demo_data.py

echo.
echo 🗑️  Liberty Social - Demo Data Cleanup
echo ========================================
echo.

cd /d "%~dp0backend"

echo 📦 Checking Python environment...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python first.
    pause
    exit /b 1
)

echo ✅ Python found
echo.

echo 🔍 Checking for demo data...
echo.

REM Run the cleanup command
python manage.py cleanup_demo_data

echo.
echo 🎯 Cleanup complete!
echo.
pause
