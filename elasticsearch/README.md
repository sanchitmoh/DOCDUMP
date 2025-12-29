# Corporate Digital Library - Elasticsearch Setup

This directory contains the complete Elasticsearch configuration for the Corporate Digital Library system with enterprise security standards.

## 📁 Directory Structure

```
elasticsearch/
├── config/
│   ├── elasticsearch.yml      # Main Elasticsearch configuration
│   ├── jvm.options           # JVM settings and memory configuration
│   └── log4j2.properties     # Logging configuration
├── mappings/
│   ├── documents.json         # Document index mapping
│   └── audit_logs.json       # Audit logs index mapping
├── data/                      # Elasticsearch data (created automatically)
├── logs/                      # Elasticsearch logs (created automatically)
├── plugins/                   # Elasticsearch plugins (optional)
└── README.md                  # This file

kibana/
├── config/
│   └── kibana.yml            # Kibana configuration
└── data/                     # Kibana data (created automatically)

scripts/
├── setup-elasticsearch.sh    # Linux/Mac setup script
└── setup-elasticsearch.bat   # Windows setup script
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available for Elasticsearch
- Ports 9200, 9300, 5601, and 9100 available

### Option 1: Automated Setup (Recommended)

**Linux/Mac:**
```bash
chmod +x scripts/setup-elasticsearch.sh
./scripts/setup-elasticsearch.sh
```

**Windows:**
```cmd
scripts\setup-elasticsearch.bat
```

### Option 2: Manual Setup

1. **Create required directories:**
   ```bash
   mkdir -p elasticsearch/{data,logs,plugins}
   mkdir -p kibana/data
   ```

2. **Start services:**
   ```bash
   docker-compose -f docker-compose.elasticsearch.yml up -d
   ```

3. **Wait for Elasticsearch to be ready:**
   ```bash
   curl -u elastic:CorporateLib2024! http://localhost:9200/_cluster/health
   ```

4. **Create indices:**
   ```bash
   # Documents index
   curl -u elastic:CorporateLib2024! -X PUT "http://localhost:9200/corporate_documents" \
     -H "Content-Type: application/json" \
     -d @elasticsearch/mappings/documents.json

   # Audit logs index
   curl -u elastic:CorporateLib2024! -X PUT "http://localhost:9200/corporate_audit_logs" \
     -H "Content-Type: application/json" \
     -d @elasticsearch/mappings/audit_logs.json
   ```

## 🔧 Configuration Details

### Elasticsearch Configuration

- **Cluster Name:** `corporate-digital-library`
- **Node Name:** `corporate-es-node`
- **Memory:** 2GB heap size (configurable)
- **Security:** Basic authentication enabled
- **SSL/TLS:** Disabled for development (enable for production)

### Default Credentials

- **Username:** `elastic`
- **Password:** `CorporateLib2024!`

⚠️ **Security Note:** Change the default password in production!

### Kibana Configuration

- **Port:** 5601
- **Index:** `.kibana-corporate`
- **Security:** Enabled with Elasticsearch integration
- **Session Timeout:** 30 minutes

## 🔍 Access URLs

- **Elasticsearch:** http://localhost:9200
- **Kibana:** http://localhost:5601
- **Elasticsearch Head:** http://localhost:9100

## 📊 Index Mappings

### Documents Index (`corporate_documents`)

Stores searchable document content with the following fields:

- `file_id` - Unique file identifier
- `organization_id` - Organization scope
- `title` - Document title with autocomplete
- `content` - Full document text
- `extracted_text` - OCR extracted text
- `author`, `department`, `tags` - Metadata
- `file_type`, `mime_type` - File information
- `created_at`, `updated_at` - Timestamps
- `permissions` - Access control (nested)
- `metadata` - Additional document properties

### Audit Logs Index (`corporate_audit_logs`)

Tracks all system activities:

- `organization_id` - Organization scope
- `file_id`, `folder_id` - Resource identifiers
- `employee_id` - User who performed action
- `action` - Type of action performed
- `ip_address` - Client IP address
- `user_agent` - Client browser/app
- `timestamp` - When action occurred
- `details` - Additional action metadata

## 🔒 Security Features

### Authentication
- Basic authentication enabled
- API key support available
- Session management in Kibana

### Authorization
- Organization-level data isolation
- Role-based access control ready
- Index-level security

### Audit Logging
- All document access logged
- User activity tracking
- IP address and session tracking

## 🚀 Performance Tuning

### Memory Settings
- Heap size: 2GB (50% of container memory)
- Index buffer: 10% of heap
- Circuit breakers configured

### Indexing Performance
- Refresh interval: 5s for documents, 1s for audit logs
- Bulk indexing optimized
- Thread pool settings tuned

### Search Performance
- Result window: 50,000 documents
- Highlight settings optimized
- Synonym filters for better matching

## 📈 Monitoring

### Health Checks
```bash
# Cluster health
curl -u elastic:CorporateLib2024! http://localhost:9200/_cluster/health

# Node stats
curl -u elastic:CorporateLib2024! http://localhost:9200/_nodes/stats

# Index stats
curl -u elastic:CorporateLib2024! http://localhost:9200/corporate_*/_stats
```

### Kibana Monitoring
- Access Kibana at http://localhost:5601
- Use Stack Monitoring for cluster overview
- Create custom dashboards for business metrics

## 🔧 Maintenance

### Backup
```bash
# Create snapshot repository
curl -u elastic:CorporateLib2024! -X PUT "http://localhost:9200/_snapshot/corporate_backup" \
  -H "Content-Type: application/json" \
  -d '{"type": "fs", "settings": {"location": "/usr/share/elasticsearch/backup"}}'

# Create snapshot
curl -u elastic:CorporateLib2024! -X PUT "http://localhost:9200/_snapshot/corporate_backup/snapshot_1"
```

### Index Management
```bash
# List indices
curl -u elastic:CorporateLib2024! http://localhost:9200/_cat/indices?v

# Delete old audit logs (example)
curl -u elastic:CorporateLib2024! -X DELETE "http://localhost:9200/corporate_audit_logs-2024.01.*"

# Reindex documents
curl -u elastic:CorporateLib2024! -X POST "http://localhost:9200/_reindex" \
  -H "Content-Type: application/json" \
  -d '{"source": {"index": "old_index"}, "dest": {"index": "new_index"}}'
```

## 🐛 Troubleshooting

### Common Issues

1. **Out of Memory Errors**
   - Increase Docker memory limit
   - Reduce heap size in `jvm.options`
   - Check for memory leaks

2. **Connection Refused**
   - Check if Docker containers are running
   - Verify port availability
   - Check firewall settings

3. **Authentication Failures**
   - Verify credentials
   - Check if security is enabled
   - Reset elastic password if needed

4. **Slow Search Performance**
   - Check index size and sharding
   - Optimize queries
   - Consider index warming

### Logs Location
- **Elasticsearch logs:** `elasticsearch/logs/`
- **Docker logs:** `docker logs corporate-elasticsearch`
- **Kibana logs:** `docker logs corporate-kibana`

### Reset Everything
```bash
# Stop services
docker-compose -f docker-compose.elasticsearch.yml down -v

# Remove data
rm -rf elasticsearch/data/* elasticsearch/logs/* kibana/data/*

# Restart
docker-compose -f docker-compose.elasticsearch.yml up -d
```

## 🔄 Production Deployment

### Security Hardening
1. Enable SSL/TLS encryption
2. Change default passwords
3. Configure proper firewall rules
4. Set up certificate-based authentication
5. Enable audit logging

### Scaling
1. Add more Elasticsearch nodes
2. Configure proper sharding strategy
3. Set up load balancing
4. Implement monitoring and alerting

### Backup Strategy
1. Regular automated snapshots
2. Cross-region backup replication
3. Disaster recovery procedures
4. Data retention policies

## 📚 Additional Resources

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana Documentation](https://www.elastic.co/guide/en/kibana/current/index.html)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Elasticsearch Security](https://www.elastic.co/guide/en/elasticsearch/reference/current/security-settings.html)