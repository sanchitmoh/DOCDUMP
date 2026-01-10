@echo off
echo Setting up AI Assistant MySQL database...

REM Get database connection details from .env.local
for /f "tokens=2 delims==" %%a in ('findstr "DB_HOST" ..\.env.local') do set DB_HOST=%%a
for /f "tokens=2 delims==" %%a in ('findstr "DB_USER" ..\.env.local') do set DB_USER=%%a
for /f "tokens=2 delims==" %%a in ('findstr "DB_PASSWORD" ..\.env.local') do set DB_PASSWORD=%%a
for /f "tokens=2 delims==" %%a in ('findstr "DB_NAME" ..\.env.local') do set DB_NAME=%%a

echo Connecting to database: %DB_NAME% on %DB_HOST%

REM Execute the SQL script
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < add-ai-assistant-columns.sql

if %errorlevel% equ 0 (
    echo ✅ AI Assistant MySQL database setup completed successfully!
    echo.
    echo The following has been added to your MySQL database:
    echo.
    echo FILES TABLE COLUMNS:
    echo - ai_processed: Tracks if file has been processed by AI
    echo - ai_summary: Stores AI-generated summary
    echo - ai_insights: Stores AI-generated insights (JSON)
    echo - ai_suggested_questions: Stores suggested questions (JSON)
    echo - ai_data_type: Stores detected data type (sales, financial, hr, etc.)
    echo - ready_for_analysis: Indicates if file is ready for AI chat
    echo - ai_processed_at: Timestamp of AI processing
    echo.
    echo NEW TABLES CREATED:
    echo - ai_conversations: Stores conversation history
    echo - ai_document_summaries: Stores document summaries and embeddings
    echo - ai_analytics_cache: Caches analytics results for performance
    echo - ai_embeddings_cache: Caches OpenAI embeddings to save costs
    echo - ai_rate_limits: Manages API rate limiting
    echo.
    echo Your system is now ready for AI Assistant features!
    echo No MongoDB required - everything uses your existing MySQL database.
) else (
    echo ❌ Database setup failed. Please check your connection details.
)

pause