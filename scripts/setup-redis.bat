@echo off
REM Corporate Digital Library - Redis Setup Script (Windows)
REM ========================================================

setlocal enabledelayedexpansion

echo 🚀 Setting up Redis for Corporate Digital Library...
echo.

REM Configuration
set REDIS_URL=http://localhost:6379
set REDIS_COMMANDER_URL=http://localhost:8081
set REDIS_INSIGHT_URL=http://localhost:8001

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
    pause
    exit /b 1
)

call :print_success "Docker is installed and running"
goto :eof

REM Function to check if Redis is running
:check_redis
call :print_status "Checking Redis connection..."

docker exec corporate-redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    call :print_success "Redis is running and accessible"
    exit /b 0
) else (
    call :print_warning "Redis not accessible"
    exit /b 1
)

REM Function to create directories
:create_directories
call :print_status "Creating required directories..."

if not exist "redis\data" mkdir "redis\data"
if not exist "redis\config" mkdir "redis\config"

call :print_success "Directories created successfully"
goto :eof

REM Function to start Redis with Docker Compose
:start_redis
call :print_status "Starting Redis services with Docker Compose..."

REM Check Docker first
call :check_docker
if %errorlevel% neq 0 exit /b 1

REM Create directories first
call :create_directories

REM Start Redis services
call :print_status "Starting Redis, Redis Commander, and Redis Insight..."
docker-compose -f docker-compose.redis.yml up -d

if %errorlevel% neq 0 (
    call :print_error "Failed to start Redis containers"
    echo.
    echo Troubleshooting steps:
    echo 1. Check if ports 6379, 8081, 8001 are available
    echo 2. Try: docker system prune -f
    echo 3. Restart Docker Desktop
    echo.
    pause
    exit /b 1
)

call :print_success "Redis services started successfully"

REM Wait for Redis to be ready
call :wait_for_redis
goto :eof

REM Function to wait for Redis
:wait_for_redis
call :print_status "Waiting for Redis to be ready..."

set max_attempts=30
set attempt=1

:wait_loop
timeout /t 3 /nobreak >nul
call :check_redis
if %errorlevel% equ 0 goto :redis_ready

if %attempt% geq %max_attempts% (
    call :print_error "Redis did not start within timeout period"
    echo.
    echo Checking container logs:
    docker logs corporate-redis
    echo.
    pause
    exit /b 1
)

call :print_status "Waiting for Redis... Attempt %attempt%/%max_attempts%"
set /a attempt+=1
goto :wait_loop

:redis_ready
call :print_success "Redis is ready!"
goto :eof

REM Function to test Redis functionality
:test_redis
call :print_status "Testing Redis functionality..."

REM Test basic operations
docker exec corporate-redis redis-cli set test_key "Corporate Digital Library" >nul
docker exec corporate-redis redis-cli get test_key >nul
docker exec corporate-redis redis-cli del test_key >nul

if %errorlevel% equ 0 (
    call :print_success "Redis basic operations test passed"
) else (
    call :print_warning "Redis basic operations test failed"
)

REM Test cache operations
docker exec corporate-redis redis-cli setex cache_test 60 "Cache test value" >nul
docker exec corporate-redis redis-cli ttl cache_test >nul

if %errorlevel% equ 0 (
    call :print_success "Redis cache operations test passed"
) else (
    call :print_warning "Redis cache operations test failed"
)

REM Test pub/sub
docker exec corporate-redis redis-cli publish test_channel "Test message" >nul

if %errorlevel% equ 0 (
    call :print_success "Redis pub/sub test passed"
) else (
    call :print_warning "Redis pub/sub test failed"
)

call :print_success "Redis functionality tests completed"
goto :eof

REM Function to show Redis info
:show_redis_info
call :print_status "Getting Redis information..."

echo.
echo Redis Server Info:
echo ==================
docker exec corporate-redis redis-cli info server | findstr "redis_version\|os\|arch_bits\|uptime_in_seconds"

echo.
echo Redis Memory Info:
echo ==================
docker exec corporate-redis redis-cli info memory | findstr "used_memory_human\|used_memory_peak_human\|maxmemory_human"

echo.
echo Redis Stats:
echo ============
docker exec corporate-redis redis-cli info stats | findstr "total_connections_received\|total_commands_processed\|keyspace_hits\|keyspace_misses"

goto :eof

REM Function to verify setup
:verify_setup
call :print_status "Verifying Redis setup..."

call :test_redis
call :show_redis_info

call :print_success "Redis setup verification completed!"
goto :eof

REM Function to show connection info and next steps
:show_info
echo.
echo 🎉 Redis Setup Complete!
echo =========================
echo.
echo 📊 Access Information:
echo ----------------------
echo Redis Server:      localhost:6379
echo Redis Commander:   %REDIS_COMMANDER_URL%
echo   Username: admin
echo   Password: CorporateRedis2024!
echo.
echo Redis Insight:     %REDIS_INSIGHT_URL%
echo   (Web-based Redis GUI)
echo.
echo 🔧 Configuration:
echo -----------------
echo - Memory Limit: 256MB
echo - Persistence: RDB snapshots enabled
echo - Databases: 16 (0-15)
echo - Key Prefix: corporate:
echo.
echo 🧪 Test Commands:
echo -----------------
echo # Test Redis connection:
echo docker exec corporate-redis redis-cli ping
echo.
echo # Test application cache:
echo curl http://localhost:3000/api/health
echo.
echo # Monitor Redis:
echo docker exec corporate-redis redis-cli monitor
echo.
echo 🚀 Usage in Application:
echo ------------------------
echo - Session Management: Automatic
echo - API Rate Limiting: Automatic  
echo - Search Result Caching: Automatic
echo - Background Job Queues: Available
echo - File Upload Tracking: Available
echo.
echo 🛑 To Stop Services:
echo -------------------
echo docker-compose -f docker-compose.redis.yml down
echo.
echo ✅ Your Redis cache is ready for the Corporate Digital Library!
echo.
goto :eof

REM Main execution
:main
echo 🏢 Corporate Digital Library - Redis Setup
echo ==========================================
echo.

REM Check if already running
call :check_redis
if %errorlevel% equ 0 (
    call :print_warning "Redis is already running"
    set /p test="Do you want to run tests anyway? (y/N): "
    if /i "!test!"=="y" (
        call :verify_setup
    )
    call :show_info
) else (
    REM Full setup
    call :start_redis
    if %errorlevel% equ 0 (
        call :verify_setup
        call :show_info
    ) else (
        echo.
        echo 🔧 Alternative Setup Options:
        echo =============================
        echo.
        echo 1. Install Redis locally (without Docker):
        echo    - Download from: https://redis.io/download
        echo    - Or use Windows Subsystem for Linux (WSL)
        echo.
        echo 2. Use Redis Cloud (managed service):
        echo    - Visit: https://redis.com/redis-enterprise-cloud/
        echo    - Update REDIS_URL in .env.local
        echo.
        echo 3. Disable caching temporarily:
        echo    - Set REDIS_URL= in .env.local
        echo    - Application will work without caching
        echo.
    )
)
goto :eof

REM Run main function
call :main
pause