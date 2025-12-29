# Corporate Digital Library - Docker Elasticsearch Complete Setup (PowerShell)
# =============================================================================

Write-Host "🚀 Setting up Docker Elasticsearch with all indexes and configurations..." -ForegroundColor Cyan
Write-Host ""

# Configuration
$ELASTICSEARCH_URL = "http://localhost:9200"
$ELASTICSEARCH_USER = "elastic"
$ELASTICSEARCH_PASSWORD = "CorporateLib2024!"
$INDEX_PREFIX = "corporate"

# Function to write colored output
function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Blue
}

function Write-Success($message) {
    Write-Host "[SUCCESS] $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "[WARNING] $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

# Function to check if Elasticsearch is running
function Test-Elasticsearch {
    Write-Info "Checking Elasticsearch connection..."
    
    try {
        $response = Invoke-RestMethod -Uri $ELASTICSEARCH_URL -Method Get -TimeoutSec 5
        Write-Success "Elasticsearch is running and accessible"
        return $true
    }
    catch {
        Write-Warning "Elasticsearch not accessible: $($_.Exception.Message)"
        return $false
    }
}

# Function to check Docker and start services
function Start-ElasticsearchServices {
    Write-Info "Checking Docker status..."
    
    try {
        docker ps | Out-Null
        Write-Success "Docker is running"
    }
    catch {
        Write-Error "Docker is not running. Please start Docker Desktop first."
        Write-Host ""
        Write-Host "Steps:" -ForegroundColor Yellow
        Write-Host "1. Start Docker Desktop" -ForegroundColor Yellow
        Write-Host "2. Wait for it to be ready (whale icon in system tray)" -ForegroundColor Yellow
        Write-Host "3. Run this script again" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    Write-Info "Creating required directories..."
    
    # Create directories
    $dirs = @("elasticsearch\data", "elasticsearch\logs", "kibana\data")
    foreach ($dir in $dirs) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }

    Write-Info "Starting Elasticsearch and Kibana containers..."
    
    try {
        docker-compose -f docker-compose.simple.yml up -d
        Write-Success "Docker containers started successfully"
    }
    catch {
        Write-Error "Failed to start Docker containers"
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "1. Check if ports 9200, 5601 are available" -ForegroundColor Yellow
        Write-Host "2. Try: docker system prune -f" -ForegroundColor Yellow
        Write-Host "3. Restart Docker Desktop" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    Write-Info "Waiting for Elasticsearch to be ready..."
    
    $maxAttempts = 30
    $attempt = 1
    
    do {
        Start-Sleep -Seconds 5
        if (Test-Elasticsearch) {
            Write-Success "Elasticsearch is ready!"
            return $true
        }
        
        Write-Info "Waiting for Elasticsearch... Attempt $attempt/$maxAttempts"
        $attempt++
    } while ($attempt -le $maxAttempts)
    
    Write-Error "Elasticsearch did not start within timeout"
    Write-Info "Checking container logs..."
    docker logs corporate-elasticsearch
    Read-Host "Press Enter to exit"
    exit 1
}

# Function to create indices
function New-ElasticsearchIndices {
    Write-Info "Creating Elasticsearch indices and configurations..."
    Write-Host ""

    # 1. Create Documents Index
    Write-Info "Creating documents index..."
    
    $documentsMapping = @{
        mappings = @{
            properties = @{
                file_id = @{ type = "keyword" }
                organization_id = @{ type = "keyword" }
                title = @{
                    type = "text"
                    analyzer = "standard"
                    fields = @{
                        keyword = @{ type = "keyword" }
                        suggest = @{ type = "completion" }
                    }
                }
                content = @{ type = "text"; analyzer = "standard" }
                extracted_text = @{ type = "text"; analyzer = "standard" }
                author = @{ type = "keyword" }
                department = @{ type = "keyword" }
                tags = @{ type = "keyword" }
                file_type = @{ type = "keyword" }
                mime_type = @{ type = "keyword" }
                size_bytes = @{ type = "long" }
                created_at = @{ type = "date" }
                updated_at = @{ type = "date" }
                visibility = @{ type = "keyword" }
                folder_path = @{ type = "text" }
            }
        }
        settings = @{
            number_of_shards = 1
            number_of_replicas = 0
            refresh_interval = "5s"
        }
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/${INDEX_PREFIX}_documents" -Method Put -Body $documentsMapping -ContentType "application/json"
        Write-Success "Documents index created successfully"
    }
    catch {
        Write-Warning "Documents index creation failed or already exists: $($_.Exception.Message)"
    }

    # 2. Create Audit Logs Index
    Write-Info "Creating audit logs index..."
    
    $auditMapping = @{
        mappings = @{
            properties = @{
                organization_id = @{ type = "keyword" }
                file_id = @{ type = "keyword" }
                employee_id = @{ type = "keyword" }
                action = @{ type = "keyword" }
                ip_address = @{ type = "ip" }
                user_agent = @{ type = "text" }
                timestamp = @{ type = "date" }
                details = @{ type = "object" }
            }
        }
        settings = @{
            number_of_shards = 1
            number_of_replicas = 0
            refresh_interval = "1s"
        }
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/${INDEX_PREFIX}_audit_logs" -Method Put -Body $auditMapping -ContentType "application/json"
        Write-Success "Audit logs index created successfully"
    }
    catch {
        Write-Warning "Audit logs index creation failed or already exists: $($_.Exception.Message)"
    }

    # 3. Create Search History Index
    Write-Info "Creating search history index..."
    
    $searchMapping = @{
        mappings = @{
            properties = @{
                user_id = @{ type = "keyword" }
                organization_id = @{ type = "keyword" }
                query = @{ type = "text" }
                results_count = @{ type = "integer" }
                timestamp = @{ type = "date" }
            }
        }
        settings = @{
            number_of_shards = 1
            number_of_replicas = 0
        }
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/${INDEX_PREFIX}_search_history" -Method Put -Body $searchMapping -ContentType "application/json"
        Write-Success "Search history index created successfully"
    }
    catch {
        Write-Warning "Search history index creation failed or already exists: $($_.Exception.Message)"
    }

    # 4. Create Index Templates
    Write-Info "Creating index templates..."

    $documentsTemplate = @{
        index_patterns = @("${INDEX_PREFIX}_documents*")
        template = @{
            settings = @{
                number_of_shards = 1
                number_of_replicas = 0
                refresh_interval = "5s"
            }
        }
        priority = 100
    } | ConvertTo-Json -Depth 10

    $auditTemplate = @{
        index_patterns = @("${INDEX_PREFIX}_audit_logs*")
        template = @{
            settings = @{
                number_of_shards = 1
                number_of_replicas = 0
                refresh_interval = "1s"
            }
        }
        priority = 100
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/_index_template/${INDEX_PREFIX}_documents_template" -Method Put -Body $documentsTemplate -ContentType "application/json"
        Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/_index_template/${INDEX_PREFIX}_audit_logs_template" -Method Put -Body $auditTemplate -ContentType "application/json"
        Write-Success "Index templates created successfully"
    }
    catch {
        Write-Warning "Index templates creation failed: $($_.Exception.Message)"
    }

    # 5. Create sample data for testing
    Write-Info "Creating sample test data..."

    $sampleDocument = @{
        file_id = "test-file-1"
        organization_id = "test-org-1"
        title = "Sample Corporate Document"
        content = "This is a sample document for testing the Corporate Digital Library search functionality."
        author = "System Admin"
        department = "IT"
        tags = @("test", "sample", "corporate")
        file_type = "pdf"
        mime_type = "application/pdf"
        size_bytes = 1024
        created_at = "2024-12-28T00:00:00Z"
        visibility = "org"
    } | ConvertTo-Json -Depth 10

    $sampleAudit = @{
        organization_id = "test-org-1"
        file_id = "test-file-1"
        employee_id = "test-user-1"
        action = "upload"
        ip_address = "127.0.0.1"
        user_agent = "Corporate Digital Library Setup"
        timestamp = "2024-12-28T00:00:00Z"
        details = @{
            file_name = "sample-document.pdf"
            file_size = 1024
        }
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/${INDEX_PREFIX}_documents/_doc/test-doc-1" -Method Post -Body $sampleDocument -ContentType "application/json"
        Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/${INDEX_PREFIX}_audit_logs/_doc/test-audit-1" -Method Post -Body $sampleAudit -ContentType "application/json"
        Write-Success "Sample test data created"
    }
    catch {
        Write-Warning "Sample data creation failed: $($_.Exception.Message)"
    }
}

# Function to verify setup
function Test-ElasticsearchSetup {
    Write-Host ""
    Write-Info "Verifying Elasticsearch setup..."

    try {
        $health = Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/_cluster/health" -Method Get
        Write-Info "Cluster health: $($health.status)"
        
        $indices = Invoke-RestMethod -Uri "$ELASTICSEARCH_URL/_cat/indices/${INDEX_PREFIX}_*?format=json" -Method Get
        Write-Info "Created indices:"
        foreach ($index in $indices) {
            Write-Host "  - $($index.index) ($($index.'docs.count') docs, $($index.'store.size'))" -ForegroundColor Gray
        }
        
        Write-Success "Elasticsearch setup verification completed!"
    }
    catch {
        Write-Warning "Verification failed: $($_.Exception.Message)"
    }
}

# Function to show final information
function Show-SetupInfo {
    Write-Host ""
    Write-Host "🎉 Docker Elasticsearch Setup Complete!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Access Information:" -ForegroundColor Cyan
    Write-Host "----------------------" -ForegroundColor Cyan
    Write-Host "Elasticsearch URL: $ELASTICSEARCH_URL" -ForegroundColor White
    Write-Host "Kibana URL:        http://localhost:5601" -ForegroundColor White
    Write-Host ""
    Write-Host "🔍 Created Indices:" -ForegroundColor Cyan
    Write-Host "------------------" -ForegroundColor Cyan
    Write-Host "- ${INDEX_PREFIX}_documents      (Document search and storage)" -ForegroundColor White
    Write-Host "- ${INDEX_PREFIX}_audit_logs     (Activity tracking)" -ForegroundColor White
    Write-Host "- ${INDEX_PREFIX}_search_history (Search analytics)" -ForegroundColor White
    Write-Host ""
    Write-Host "🧪 Test Commands:" -ForegroundColor Cyan
    Write-Host "-----------------" -ForegroundColor Cyan
    Write-Host "# Test Elasticsearch connection:" -ForegroundColor Gray
    Write-Host "curl $ELASTICSEARCH_URL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Test document search:" -ForegroundColor Gray
    Write-Host "curl `"$ELASTICSEARCH_URL/${INDEX_PREFIX}_documents/_search?q=sample`"" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Test application health:" -ForegroundColor Gray
    Write-Host "curl http://localhost:3000/api/health" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Test search setup:" -ForegroundColor Gray
    Write-Host "curl http://localhost:3000/api/setup/search" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "--------------" -ForegroundColor Cyan
    Write-Host "1. Start your Next.js application: npm run dev" -ForegroundColor White
    Write-Host "2. Test the search functionality in the app" -ForegroundColor White
    Write-Host "3. Check Kibana for data visualization: http://localhost:5601" -ForegroundColor White
    Write-Host "4. Monitor logs: docker logs corporate-elasticsearch" -ForegroundColor White
    Write-Host ""
    Write-Host "🛑 To Stop Services:" -ForegroundColor Cyan
    Write-Host "-------------------" -ForegroundColor Cyan
    Write-Host "docker-compose -f docker-compose.simple.yml down" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "✅ Your Corporate Digital Library is ready with full search capabilities!" -ForegroundColor Green
    Write-Host ""
}

# Main execution
try {
    Write-Host "🏢 Corporate Digital Library - Docker Elasticsearch Setup" -ForegroundColor Magenta
    Write-Host "=========================================================" -ForegroundColor Magenta
    Write-Host ""

    # Check if Elasticsearch is already running
    if (Test-Elasticsearch) {
        Write-Warning "Elasticsearch is already running"
        $recreate = Read-Host "Do you want to recreate the indices? (y/N)"
        if ($recreate -eq "y" -or $recreate -eq "Y") {
            New-ElasticsearchIndices
            Test-ElasticsearchSetup
        }
    }
    else {
        # Full setup
        Start-ElasticsearchServices
        New-ElasticsearchIndices
        Test-ElasticsearchSetup
    }

    Show-SetupInfo
}
catch {
    Write-Error "Setup failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure Docker Desktop is running" -ForegroundColor Yellow
    Write-Host "2. Check available ports (9200, 5601)" -ForegroundColor Yellow
    Write-Host "3. Try: docker system prune -f" -ForegroundColor Yellow
    Write-Host "4. Restart Docker Desktop" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Press Enter to exit"