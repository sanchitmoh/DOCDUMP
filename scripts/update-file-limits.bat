@echo off
echo Updating file size limits to support larger video files...

REM Load environment variables
for /f "delims=" %%x in ('type .env.local ^| findstr "DB_"') do set %%x

echo Connecting to database: %DB_NAME% on %DB_HOST%

mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < scripts/update-file-size-limit.sql

if %ERRORLEVEL% EQU 0 (
    echo ✅ File size limits updated successfully!
    echo.
    echo New configuration:
    echo - Maximum file size: 500MB (increased from 100MB)
    echo - Supports larger video files and multimedia content
    echo.
    echo Your system can now handle larger multimedia uploads!
) else (
    echo ❌ Failed to update file size limits. Please check your database connection.
)

pause