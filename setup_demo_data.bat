@echo off
REM Liberty Social - Demo Data Setup Script (Windows)
REM This script sets up professional demo data for Google Play Store screenshots

echo.
echo 🚀 Liberty Social - Screenshot Demo Data Setup
echo ==============================================
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

echo 🗑️  Cleaning old demo data (if any)...
python manage.py setup_demo_data --clean

echo.
echo ==============================================
echo ✅ Demo Data Setup Complete!
echo ==============================================
echo.
echo 📱 DEMO ACCOUNTS CREATED
echo.
echo Email: sarah.johnson@demo.com
echo Email: michael.chen@demo.com
echo Email: emma.williams@demo.com
echo Email: james.davis@demo.com
echo Email: olivia.martinez@demo.com
echo.
echo 🔑 Password for all accounts: Demo@123
echo.
echo ==============================================
echo 📸 READY FOR SCREENSHOTS!
echo ==============================================
echo.
echo ✨ Created:
echo   • 5 professional user accounts
echo   • 8 engaging feed posts
echo   • 3 message conversations
echo   • 3 business pages
echo   • 5 marketplace listings
echo   • 5 animal marketplace listings
echo.
echo 📖 For detailed screenshot guide, see:
echo    SCREENSHOT_GUIDE.md
echo.
echo 💡 Next steps:
echo   1. Login to the mobile app with any demo account
echo   2. (Optional) Add profile images via Django admin
echo   3. Navigate to each section and take screenshots
echo.
echo 🎯 Happy screenshotting!
echo.
pause
