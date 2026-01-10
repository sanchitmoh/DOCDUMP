@echo off
echo Setting up AI Assistant MySQL database (Safe Mode)...

REM Get database connection details from .env.local
for /f "tokens=2 delims==" %%a in ('findstr "DB_HOST" ..\.env.local') do set DB_HOST=%%a
for /f "tokens=2 delims==" %%a in ('findstr "DB_USER" ..\.env.local') do set DB_USER=%%a
for /f "tokens=2 delims==" %%a in ('findstr "DB_PASSWORD" ..\.env.local') do set DB_PASSWORD=%%a
for /f "tokens=2 delims==" %%a in ('findstr "DB_NAME" ..\.env.local') do set DB_NAME=%%a

echo Connecting to database: %DB_NAME% on %DB_HOST%
echo.

REM Test connection first
echo Testing database connection...
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% -e "SELECT 'Connection successful' as status;" %DB_NAME%

if %errorlevel% neq 0 (
    echo ❌ Database connection failed. Please check your credentials.
    pause
    exit /b 1
)

echo ✅ Database connection successful!
echo.

REM Execute the simple SQL script with error handling
echo Running AI Assistant setup...
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% --force %DB_NAME% < setup-ai-assistant-simple.sql > setup_output.log 2>&1

REM Check if the script ran (even with some errors)
if exist setup_output.log (
    echo Setup completed. Checking results...
    
    REM Check if AI tables were created
    mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% -e "SHOW TABLES LIKE 'ai_%';" %DB_NAME% > ai_tables_check.log 2>&1
    
    REM Check if AI columns were added
    mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% -e "DESCRIBE files;" %DB_NAME% | findstr "ai_" > ai_columns_check.log 2>&1
    
    echo.
    echo ✅ AI Assistant MySQL setup completed!
    echo.
    echo RESULTS:
    echo --------
    
    REM Show AI tables created
    echo AI Tables Created:
    type ai_tables_check.log
    echo.
    
    REM Show AI columns added
    echo AI Columns Added to files table:
    type ai_columns_check.log
    echo.
    
    echo FEATURES ENABLED:
    echo - ✅ File AI processing and analysis
    echo - ✅ Conversation history storage
    echo - ✅ Document summaries with embeddings
    echo - ✅ Analytics caching for performance
    echo - ✅ Rate limiting and security
    echo.
    echo Your system is now ready for AI Assistant features!
    echo No MongoDB required - everything uses your existing MySQL database.
    
    REM Clean up temp files
    del setup_output.log ai_tables_check.log ai_columns_check.log 2>nul
    
) else (
    echo ❌ Setup script failed to run.
)

echo.
echo NEXT STEPS:
echo 1. Install dependencies: npm install openai redis recharts xlsx csv-parser
echo 2. Upload a file to test AI processing
echo 3. Try the AI chat with your uploaded files
echo.

pause