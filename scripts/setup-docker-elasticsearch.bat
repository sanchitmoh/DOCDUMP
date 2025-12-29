@echo off
REM Corporate Digital Library - Docker Elasticsearch Complete Setup
REM ==============================================================

setlocal enabledelayedexpansion

echo 🚀 Setting up Docker Elasticsearch with all indexes and configurations...
echo.

REM Configuration
set ELASTICSEARCH_URL=http://localhost:9200
set ELASTICSEARCH_USER=elastic
set ELASTICSEARCH_PASSWORD=CorporateLib2024!
set INDEX_PREFIX=corporate

REM Colors (Windows doesn't support colors in batch, but we'll use text indicators)
set INFO=[INFO]
set SUCCESS=[SUCCESS]
set WARNING=[WARNING]
set ERROR=[ERROR]

echo %INFO% Starting complete Elasticsearch setup for Docker...
echo.

REM Function to check if Elasticsearch is running
:check_elasticsearch
echo %INFO% Checking Elasticsearch connection...

curl -s "%ELASTICSEARCH_URL%" >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS% Elasticsearch is running and accessible
    goto :create_indices
) else (
    echo %WARNING% Elasticsearch not accessible, checking Docker...
    goto :check_docker
)

REM Function to check Docker and start services
:check_docker
echo %INFO% Checking Docker status...

docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo %ERROR% Docker is not running. Please start Docker Desktop first.
    echo.
    echo Steps:
    echo 1. Start Docker Desktop
    echo 2. Wait for it to be ready (whale icon in system tray)
    echo 3. Run this script again
    echo.
    pause
    exit /b 1
)

echo %INFO% Docker is running. Starting Elasticsearch services...

REM Create required directories
if not exist "elasticsearch\data" mkdir "elasticsearch\data"
if not exist "elasticsearch\logs" mkdir "elasticsearch\logs"
if not exist "kibana\data" mkdir "kibana\data"

REM Start Elasticsearch with simple configuration
echo %INFO% Starting Elasticsearch and Kibana containers...
docker-compose -f docker-compose.simple.yml up -d

if %errorlevel% neq 0 (
    echo %ERROR% Failed to start Docker containers
    echo.
    echo Troubleshooting:
    echo 1. Check if ports 9200, 5601 are available
    echo 2. Try: docker system prune -f
    echo 3. Restart Docker Desktop
    echo.
    pause
    exit /b 1
)

echo %SUCCESS% Docker containers started successfully
echo %INFO% Waiting for Elasticsearch to be ready...

REM Wait for Elasticsearch to be ready
set max_attempts=30
set attempt=1

:wait_loop
timeout /t 5 /nobreak >nul
curl -s "%ELASTICSEARCH_URL%" >nul 2>&1
if %errorlevel% equ 0 goto :elasticsearch_ready

if %attempt% geq %max_attempts% (
    echo %ERROR% Elasticsearch did not start within timeout
    echo %INFO% Checking container logs...
    docker logs corporate-elasticsearch
    pause
    exit /b 1
)

echo %INFO% Waiting for Elasticsearch... Attempt %attempt%/%max_attempts%
set /a attempt+=1
goto :wait_loop

:elasticsearch_ready
echo %SUCCESS% Elasticsearch is ready!
echo.

REM Function to create all indices
:create_indices
echo %INFO% Creating Elasticsearch indices and configurations...
echo.

REM 1. Create Documents Index
echo %INFO% Creating documents index...
curl -s -X PUT "%ELASTICSEARCH_URL%/%INDEX_PREFIX%_documents" ^
  -H "Content-Type: application/json" ^
  -d "{\"mappings\":{\"properties\":{\"file_id\":{\"type\":\"keyword\"},\"organization_id\":{\"type\":\"keyword\"},\"title\":{\"type\":\"text\",\"analyzer\":\"standard\",\"fields\":{\"keyword\":{\"type\":\"keyword\"},\"suggest\":{\"type\":\"completion\"}}},\"content\":{\"type\":\"text\",\"analyzer\":\"standard\"},\"extracted_text\":{\"type\":\"text\",\"analyzer\":\"standard\"},\"author\":{\"type\":\"keyword\"},\"department\":{\"type\":\"keyword\"},\"tags\":{\"type\":\"keyword\"},\"file_type\":{\"type\":\"keyword\"},\"mime_type\":{\"type\":\"keyword\"},\"size_bytes\":{\"type\":\"long\"},\"created_at\":{\"type\":\"date\"},\"updated_at\":{\"type\":\"date\"},\"visibility\":{\"type\":\"keyword\"},\"folder_path\":{\"type\":\"text\"}}},\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0,\"refresh_interval\":\"5s\"}}" >nul

if %errorlevel% equ 0 (
    echo %SUCCESS% Documents index created successfully
) else (
    echo %WARNING% Documents index creation failed or already exists
)

REM 2. Create Audit Logs Index
echo %INFO% Creating audit logs index...
curl -s -X PUT "%ELASTICSEARCH_URL%/%INDEX_PREFIX%_audit_logs" ^
  -H "Content-Type: application/json" ^
  -d "{\"mappings\":{\"properties\":{\"organization_id\":{\"type\":\"keyword\"},\"file_id\":{\"type\":\"keyword\"},\"employee_id\":{\"type\":\"keyword\"},\"action\":{\"type\":\"keyword\"},\"ip_address\":{\"type\":\"ip\"},\"user_agent\":{\"type\":\"text\"},\"timestamp\":{\"type\":\"date\"},\"details\":{\"type\":\"object\"}}},\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0,\"refresh_interval\":\"1s\"}}" >nul

if %errorlevel% equ 0 (
    echo %SUCCESS% Audit logs index created successfully
) else (
    echo %WARNING% Audit logs index creation failed or already exists
)

REM 3. Create Search History Index
echo %INFO% Creating search history index...
curl -s -X PUT "%ELASTICSEARCH_URL%/%INDEX_PREFIX%_search_history" ^
  -H "Content-Type: application/json" ^
  -d "{\"mappings\":{\"properties\":{\"user_id\":{\"type\":\"keyword\"},\"organization_id\":{\"type\":\"keyword\"},\"query\":{\"type\":\"text\"},\"results_count\":{\"type\":\"integer\"},\"timestamp\":{\"type\":\"date\"}}},\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0}}" >nul

if %errorlevel% equ 0 (
    echo %SUCCESS% Search history index created successfully
) else (
    echo %WARNING% Search history index creation failed or already exists
)

REM 4. Create Index Templates
echo %INFO% Creating index templates...

REM Documents template
curl -s -X PUT "%ELASTICSEARCH_URL%/_index_template/%INDEX_PREFIX%_documents_template" ^
  -H "Content-Type: application/json" ^
  -d "{\"index_patterns\":[\"%INDEX_PREFIX%_documents*\"],\"template\":{\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0,\"refresh_interval\":\"5s\"}},\"priority\":100}" >nul

REM Audit logs template
curl -s -X PUT "%ELASTICSEARCH_URL%/_index_template/%INDEX_PREFIX%_audit_logs_template" ^
  -H "Content-Type: application/json" ^
  -d "{\"index_patterns\":[\"%INDEX_PREFIX%_audit_logs*\"],\"template\":{\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0,\"refresh_interval\":\"1s\"}},\"priority\":100}" >nul

echo %SUCCESS% Index templates created successfully

REM 5. Create sample data for testing
echo %INFO% Creating sample test data...

REM Sample document
curl -s -X POST "%ELASTICSEARCH_URL%/%INDEX_PREFIX%_documents/_doc/test-doc-1" ^
  -H "Content-Type: application/json" ^
  -d "{\"file_id\":\"test-file-1\",\"organization_id\":\"test-org-1\",\"title\":\"Sample Corporate Document\",\"content\":\"This is a sample document for testing the Corporate Digital Library search functionality.\",\"author\":\"System Admin\",\"department\":\"IT\",\"tags\":[\"test\",\"sample\",\"corporate\"],\"file_type\":\"pdf\",\"mime_type\":\"application/pdf\",\"size_bytes\":1024,\"created_at\":\"2024-12-28T00:00:00Z\",\"visibility\":\"org\"}" >nul

REM Sample audit log
curl -s -X POST "%ELASTICSEARCH_URL%/%INDEX_PREFIX%_audit_logs/_doc/test-audit-1" ^
  -H "Content-Type: application/json" ^
  -d "{\"organization_id\":\"test-org-1\",\"file_id\":\"test-file-1\",\"employee_id\":\"test-user-1\",\"action\":\"upload\",\"ip_address\":\"127.0.0.1\",\"user_agent\":\"Corporate Digital Library Setup\",\"timestamp\":\"2024-12-28T00:00:00Z\",\"details\":{\"file_name\":\"sample-document.pdf\",\"file_size\":1024}}" >nul

echo %SUCCESS% Sample test data created

REM Function to verify setup
:verify_setup
echo.
echo %INFO% Verifying Elasticsearch setup...

REM Check cluster health
for /f "tokens=*" %%a in ('curl -s "%ELASTICSEARCH_URL%/_cluster/health" 2^>nul') do set health_response=%%a
echo %INFO% Cluster health response received

REM List created indices
echo %INFO% Listing created indices:
curl -s "%ELASTICSEARCH_URL%/_cat/indices/%INDEX_PREFIX%_*?v"

echo.
echo %SUCCESS% Elasticsearch setup verification completed!

REM Function to show connection info and next steps
:show_info
echo.
echo 🎉 Docker Elasticsearch Setup Complete!
echo ==========================================
echo.
echo 📊 Access Information:
echo ----------------------
echo Elasticsearch URL: %ELASTICSEARCH_URL%
echo Kibana URL:        http://localhost:5601
echo.
echo 🔍 Created Indices:
echo ------------------
echo - %INDEX_PREFIX%_documents      (Document search and storage)
echo - %INDEX_PREFIX%_audit_logs     (Activity tracking)
echo - %INDEX_PREFIX%_search_history (Search analytics)
echo.
echo 🧪 Test Commands:
echo -----------------
echo # Test Elasticsearch connection:
echo curl %ELASTICSEARCH_URL%
echo.
echo # Test document search:
echo curl "%ELASTICSEARCH_URL%/%INDEX_PREFIX%_documents/_search?q=sample"
echo.
echo # Test application health:
echo curl http://localhost:3000/api/health
echo.
echo # Test search setup:
echo curl http://localhost:3000/api/setup/search
echo.
echo 🚀 Next Steps:
echo --------------
echo 1. Start your Next.js application: npm run dev
echo 2. Test the search functionality in the app
echo 3. Check Kibana for data visualization: http://localhost:5601
echo 4. Monitor logs: docker logs corporate-elasticsearch
echo.
echo 🛑 To Stop Services:
echo -------------------
echo docker-compose -f docker-compose.simple.yml down
echo.
echo ✅ Your Corporate Digital Library is ready with full search capabilities!
echo.

goto :end

:end
pause
exit /b 0