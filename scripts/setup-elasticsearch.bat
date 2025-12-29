@echo off
REM Corporate Digital Library - Elasticsearch Setup Script (Windows)
REM ================================================================

setlocal enabledelayedexpansion

echo 🚀 Setting up Elasticsearch for Corporate Digital Library...
echo.

REM Configuration
set ELASTICSEARCH_URL=http://localhost:9200
set ELASTICSEARCH_USER=elastic
set ELASTICSEARCH_PASSWORD=CorporateLib2024!
set INDEX_PREFIX=corporate

REM Function to print status
:print_status
echo [INFO] %~1
goto :eof

:print_success
echo [SUCCESS] %~1
goto :eof

:print_warning
echo [WARNING] %~1
goto :eof

:print_error
echo [ERROR] %~1
goto :eof

REM Function to check Docker
:check_docker
call :print_status "Checking Docker installation..."

docker --version >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Docker is not installed or not in PATH"
    echo.
    echo Please install Docker Desktop for Windows:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo Alternative options:
    echo 1. Use Elastic Cloud: https://cloud.elastic.co/
    echo 2. Install Elasticsearch locally
    echo 3. Temporarily disable search in .env.local
    echo.
    pause
    exit /b 1
)

docker ps >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Docker Desktop is not running"
    echo.
    echo Please start Docker Desktop and wait for it to be ready.
    echo Look for the whale icon in your system tray.
    echo.
    echo Alternative: Use the simple configuration:
    echo docker-compose -f docker-compose.simple.yml up -d
    echo.
    pause
    exit /b 1
)

call :print_success "Docker is installed and running"
goto :eof

REM Function to check if Elasticsearch is running
:check_elasticsearch
call :print_status "Checking Elasticsearch connection..."

curl -s "%ELASTICSEARCH_URL%" >nul 2>&1
if %errorlevel% equ 0 (
    call :print_success "Elasticsearch is running and accessible"
    exit /b 0
) else (
    call :print_error "Cannot connect to Elasticsearch at %ELASTICSEARCH_URL%"
    exit /b 1
)

REM Function to create directories
:create_directories
call :print_status "Creating required directories..."

if not exist "elasticsearch\data" mkdir "elasticsearch\data"
if not exist "elasticsearch\logs" mkdir "elasticsearch\logs"
if not exist "elasticsearch\plugins" mkdir "elasticsearch\plugins"
if not exist "kibana\data" mkdir "kibana\data"

call :print_success "Directories created successfully"
goto :eof

REM Function to start Elasticsearch with Docker Compose
:start_elasticsearch
call :print_status "Starting Elasticsearch and Kibana with Docker Compose..."

REM Check Docker first
call :check_docker
if %errorlevel% neq 0 exit /b 1

REM Create directories first
call :create_directories

REM Try simple configuration first
call :print_status "Trying simple configuration first..."
docker-compose -f docker-compose.simple.yml up -d

if %errorlevel% neq 0 (
    call :print_warning "Simple configuration failed, trying full configuration..."
    docker-compose -f docker-compose.elasticsearch.yml up -d
    
    if %errorlevel% neq 0 (
        call :print_error "Both configurations failed"
        echo.
        echo Troubleshooting steps:
        echo 1. Make sure Docker Desktop is running
        echo 2. Check available memory (need at least 4GB)
        echo 3. Try: docker system prune -f
        echo 4. Restart Docker Desktop
        echo.
        echo Alternative solutions:
        echo 1. Use Elastic Cloud (recommended for development)
        echo 2. Install Elasticsearch locally without Docker
        echo 3. Temporarily disable search in .env.local
        echo.
        pause
        exit /b 1
    )
)

call :print_success "Docker Compose services started"

REM Wait for services to be ready
call :wait_for_elasticsearch
goto :eof

REM Function to wait for Elasticsearch
:wait_for_elasticsearch
call :print_status "Waiting for Elasticsearch to be ready..."

set max_attempts=30
set attempt=1

:wait_loop
call :check_elasticsearch
if %errorlevel% equ 0 goto :wait_success

if %attempt% geq %max_attempts% (
    call :print_error "Elasticsearch did not become ready within the timeout period"
    echo.
    echo Troubleshooting:
    echo 1. Check Docker logs: docker logs corporate-elasticsearch
    echo 2. Check memory usage: docker stats
    echo 3. Try reducing memory in docker-compose file
    echo.
    exit /b 1
)

call :print_status "Attempt %attempt%/%max_attempts% - waiting 10 seconds..."
timeout /t 10 /nobreak >nul
set /a attempt+=1
goto :wait_loop

:wait_success
goto :eof

REM Function to create indices
:create_indices
call :print_status "Creating Elasticsearch indices..."

REM Simple document index
curl -s -X PUT "%ELASTICSEARCH_URL%/corporate_documents" -H "Content-Type: application/json" -d "{\"mappings\":{\"properties\":{\"title\":{\"type\":\"text\"},\"content\":{\"type\":\"text\"},\"organization_id\":{\"type\":\"keyword\"},\"file_id\":{\"type\":\"keyword\"},\"created_at\":{\"type\":\"date\"}}}}" >nul
if %errorlevel% equ 0 (
    call :print_success "Documents index created"
) else (
    call :print_warning "Failed to create documents index"
)

REM Simple audit logs index
curl -s -X PUT "%ELASTICSEARCH_URL%/corporate_audit_logs" -H "Content-Type: application/json" -d "{\"mappings\":{\"properties\":{\"action\":{\"type\":\"keyword\"},\"timestamp\":{\"type\":\"date\"},\"organization_id\":{\"type\":\"keyword\"},\"employee_id\":{\"type\":\"keyword\"}}}}" >nul
if %errorlevel% equ 0 (
    call :print_success "Audit logs index created"
) else (
    call :print_warning "Failed to create audit logs index"
)
goto :eof

REM Function to verify setup
:verify_setup
call :print_status "Verifying Elasticsearch setup..."

REM Check if we can connect
curl -s "%ELASTICSEARCH_URL%" >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Cannot connect to Elasticsearch"
    exit /b 1
)

call :print_success "Elasticsearch setup completed successfully!"
goto :eof

REM Function to show connection info
:show_connection_info
echo.
echo 🎉 Elasticsearch Setup Complete!
echo ==================================
echo.
echo Elasticsearch URL: %ELASTICSEARCH_URL%
echo Kibana URL: http://localhost:5601
echo.
echo To test the connection:
echo curl %ELASTICSEARCH_URL%
echo.
echo To stop the services:
echo docker-compose -f docker-compose.simple.yml down
echo.
echo If you have issues, check WINDOWS_SETUP.md for troubleshooting
echo.
goto :eof

REM Function to show alternatives
:show_alternatives
echo.
echo 🔧 Alternative Setup Options:
echo =============================
echo.
echo 1. Elastic Cloud (Recommended for development):
echo    - Visit: https://cloud.elastic.co/
echo    - Create free account and deployment
echo    - Update ELASTICSEARCH_URL in .env.local
echo.
echo 2. Local Installation (Without Docker):
echo    - Download from: https://www.elastic.co/downloads/elasticsearch
echo    - Extract and run elasticsearch.bat
echo.
echo 3. Disable Search Temporarily:
echo    - Set ELASTICSEARCH_URL= in .env.local
echo    - Application will use MySQL search fallback
echo.
echo 4. Fix Docker Issues:
echo    - Restart Docker Desktop
echo    - Check Windows Features (Hyper-V/WSL2)
echo    - Increase Docker memory to 4GB+
echo.
goto :eof

REM Main execution
:main
echo 🏢 Corporate Digital Library - Elasticsearch Setup
echo ==================================================
echo.

REM Check if already running
call :check_elasticsearch
if %errorlevel% equ 0 (
    call :print_warning "Elasticsearch is already running"
    set /p recreate="Do you want to recreate the indices? (y/N): "
    if /i "!recreate!"=="y" (
        call :create_indices
        call :verify_setup
    )
    call :show_connection_info
) else (
    REM Try full setup
    call :start_elasticsearch
    if %errorlevel% equ 0 (
        call :create_indices
        call :verify_setup
        call :show_connection_info
    ) else (
        call :show_alternatives
    )
)
goto :eof

REM Run main function
call :main