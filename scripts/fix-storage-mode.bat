@echo off
REM Quick fix script to change storage mode to S3-only

echo ========================================
echo Storage Mode Fix Script
echo ========================================
echo.
echo This script will update your .env.local to use S3-only storage
echo This fixes the serverless environment issue where local storage fails
echo.
echo Current mode: STORAGE_MODE=hybrid
echo New mode: STORAGE_MODE=s3
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Creating backup of .env.local...
copy .env.local .env.local.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%

echo.
echo Updating STORAGE_MODE to s3...
powershell -Command "(Get-Content .env.local) -replace '^STORAGE_MODE=hybrid', 'STORAGE_MODE=s3' | Set-Content .env.local"

echo.
echo ========================================
echo ✅ Storage mode updated successfully!
echo ========================================
echo.
echo Changes made:
echo   - STORAGE_MODE changed from 'hybrid' to 's3'
echo   - Backup saved to .env.local.backup.*
echo.
echo Next steps:
echo   1. Restart your application
echo   2. Test file upload
echo   3. Check logs for success messages
echo.
echo To revert: copy .env.local.backup.* .env.local
echo.
pause
