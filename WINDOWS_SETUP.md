# Windows Setup Guide - Corporate Digital Library

## 🐳 Docker Desktop Issues & Solutions

### Issue: Docker Desktop Not Running
```
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.48/images/...
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

## 🔧 Solution Options

### Option 1: Install/Start Docker Desktop (Recommended)

1. **Download Docker Desktop for Windows:**
   - Visit: https://www.docker.com/products/docker-desktop/
   - Download and install Docker Desktop

2. **Start Docker Desktop:**
   - Open Docker Desktop from Start Menu
   - Wait for it to fully start (whale icon in system tray)
   - Ensure it shows "Docker Desktop is running"

3. **Verify Docker is working:**
   ```cmd
   docker --version
   docker-compose --version
   ```

4. **Run Elasticsearch:**
   ```cmd
   docker-compose -f docker-compose.simple.yml up -d
   ```

### Option 2: Use Elasticsearch Cloud (Easiest)

1. **Sign up for Elastic Cloud:**
   - Visit: https://cloud.elastic.co/
   - Create free account (14-day trial)
   - Create deployment

2. **Update .env.local:**
   ```env
   ELASTICSEARCH_URL=https://your-deployment-url.es.region.cloud.es.io:9243
   ELASTICSEARCH_USERNAME=elastic
   ELASTICSEARCH_PASSWORD=your-generated-password
   ```

### Option 3: Local Installation (Without Docker)

#### Install Elasticsearch Directly

1. **Download Elasticsearch:**
   ```cmd
   # Download from https://www.elastic.co/downloads/elasticsearch
   # Extract to C:\elasticsearch-8.11.0
   ```

2. **Configure Elasticsearch:**
   - Edit `C:\elasticsearch-8.11.0\config\elasticsearch.yml`
   ```yaml
   cluster.name: corporate-digital-library
   node.name: node-1
   network.host: localhost
   http.port: 9200
   discovery.type: single-node
   xpack.security.enabled: false
   ```

3. **Start Elasticsearch:**
   ```cmd
   cd C:\elasticsearch-8.11.0\bin
   elasticsearch.bat
   ```

4. **Install Kibana (Optional):**
   ```cmd
   # Download from https://www.elastic.co/downloads/kibana
   # Extract to C:\kibana-8.11.0
   cd C:\kibana-8.11.0\bin
   kibana.bat
   ```

### Option 4: Use Alternative Search (Temporary)

For development, you can temporarily disable Elasticsearch and use MySQL full-text search:

1. **Update .env.local:**
   ```env
   # Disable Elasticsearch temporarily
   ELASTICSEARCH_URL=
   ELASTICSEARCH_USERNAME=
   ELASTICSEARCH_PASSWORD=
   ```

2. **The application will fall back to MySQL search**

## 🚀 Quick Docker Setup (If Docker Works)

### Step 1: Check Docker Status
```cmd
docker --version
docker ps
```

### Step 2: Use Simple Configuration
```cmd
# Use the simplified Docker Compose file
docker-compose -f docker-compose.simple.yml up -d
```

### Step 3: Verify Services
```cmd
# Check if containers are running
docker ps

# Test Elasticsearch
curl http://localhost:9200

# Access Kibana
# Open browser: http://localhost:5601
```

### Step 4: Create Indices
```cmd
# Create documents index
curl -X PUT "http://localhost:9200/corporate_documents" -H "Content-Type: application/json" -d "{\"mappings\":{\"properties\":{\"title\":{\"type\":\"text\"},\"content\":{\"type\":\"text\"},\"organization_id\":{\"type\":\"keyword\"}}}}"

# Create audit logs index  
curl -X PUT "http://localhost:9200/corporate_audit_logs" -H "Content-Type: application/json" -d "{\"mappings\":{\"properties\":{\"action\":{\"type\":\"keyword\"},\"timestamp\":{\"type\":\"date\"},\"organization_id\":{\"type\":\"keyword\"}}}}"
```

## 🔍 Troubleshooting

### Docker Desktop Won't Start
1. **Check Windows Version:**
   - Requires Windows 10/11 Pro, Enterprise, or Education
   - Or Windows 10/11 Home with WSL2

2. **Enable Virtualization:**
   - Enable Hyper-V in Windows Features
   - Or enable WSL2 for Windows Home

3. **Check System Requirements:**
   - At least 4GB RAM
   - 64-bit processor with virtualization support

### Alternative: Use WSL2 with Docker
```cmd
# Install WSL2
wsl --install

# Install Docker in WSL2
# Follow Linux installation guide
```

### Memory Issues
If you get memory errors:

1. **Reduce Elasticsearch memory:**
   ```yaml
   environment:
     - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
   ```

2. **Increase Docker memory:**
   - Docker Desktop → Settings → Resources → Memory
   - Increase to at least 4GB

## 🎯 Recommended Approach

For **development on Windows**:

1. **First choice:** Install Docker Desktop and use `docker-compose.simple.yml`
2. **Second choice:** Use Elastic Cloud (free trial)
3. **Third choice:** Local Elasticsearch installation
4. **Fallback:** Disable search temporarily and use MySQL

## 📞 Need Help?

If you continue having issues:

1. **Check Docker Desktop status** in system tray
2. **Restart Docker Desktop** completely
3. **Try the simple Docker Compose file** first
4. **Use Elastic Cloud** for immediate testing
5. **Disable Elasticsearch** temporarily to continue development

## ✅ Verification Commands

Once any option is working:

```cmd
# Test Elasticsearch
curl http://localhost:9200

# Test health endpoint
curl http://localhost:3000/api/health

# Test search setup
curl http://localhost:3000/api/setup/search
```

Choose the option that works best for your Windows setup!