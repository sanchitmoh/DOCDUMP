@echo off
echo Updating allowed MIME types to include video, audio, and additional file formats...

REM Load environment variables
for /f "delims=" %%x in ('type .env.local ^| findstr "DB_"') do set %%x

echo Connecting to database: %DB_NAME% on %DB_HOST%

mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < scripts/update-allowed-mime-types.sql

if %ERRORLEVEL% EQU 0 (
    echo ✅ MIME types updated successfully!
    echo.
    echo New supported file types:
    echo - Documents: PDF, Word, Excel, PowerPoint
    echo - Images: JPEG, PNG, GIF, BMP, TIFF
    echo - Videos: MP4, AVI, QuickTime
    echo - Audio: MP3, WAV, MPEG
    echo - Archives: ZIP
    echo.
    echo Your system now supports multimedia file uploads!
) else (
    echo ❌ Failed to update MIME types. Please check your database connection.
)

pause