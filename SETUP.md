# Corporate Digital Library - Setup Guide

## 🚀 Complete Setup Guide for S3 & Elasticsearch Integration

This guide provides step-by-step instructions for setting up AWS S3, Elasticsearch, and all required services for the Corporate Digital Library system with enterprise security standards.

## 📋 Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ running
- AWS Account with appropriate permissions
- Docker and Docker Compose (for Elasticsearch)
- Git installed

## 🔧 1. AWS S3 Setup

### 1.1 Create S3 Bucket

1. **Login to AWS Console** → Navigate to S3
2. **Create Bucket**:
   ```
   Bucket Name: corporate-digital-library-[your-org]
   Region: us-east-1 (or your preferred region)
   Block Public Access: Enable (all options)
   Versioning: Enable
   Encryption: Enable (SSE-S3)
   ```

### 1.2 Create IAM User for Application

1. **Navigate to IAM** → Users → Create User
2. **User Details**:
   ```
   Username: corporate-digital-library-app
   Access Type: Programmatic access
   ```

3. **Create Custom Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:GetObjectVersion",
           "s3:PutObjectAcl",
           "s3:GetObjectAcl"
         ],
         "Resource": "arn:aws:s3:::corporate-digital-library-[your-org]/*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "s3:ListBucket",
           "s3:GetBucketLocation",
           "s3:GetBucketVersioning"
         ],
         "Resource": "arn:aws:s3:::corporate-digital-library-[your-org]"
       }
     ]
   }
   ```

4. **Attach Policy** to the user
5. **Save Access Keys** (Access Key ID and Secret Access Key)

### 1.3 Configure CORS for S3 Bucket

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## 🔍 2. Elasticsearch Setup

### 2.1 Using Docker Compose (Recommended for Development)

Create `docker-compose.elasticsearch.yml`:

```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: corporate-elasticsearch
    environment:
      - node.name=corporate-es-node
      - cluster.name=corporate-digital-library
      - discovery.type=single-node
      - bootstrap.memory_lock=true
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
      - xpack.security.enabled=true
      - xpack.security.authc.api_key.enabled=true
      - ELASTIC_PASSWORD=your_strong_password_here
      - xpack.security.transport.ssl.enabled=false
      - xpack.security.http.ssl.enabled=false
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
      - ./elasticsearch/config:/usr/share/elasticsearch/config
    ports:
      - "9200:9200"
      - "9300:9300"
    networks:
      - elastic

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: corporate-kibana
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=elastic
      - ELASTICSEARCH_PASSWORD=your_strong_password_here
    ports:
      - "5601:5601"
    networks:
      - elastic
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
    driver: local

networks:
  elastic:
    driver: bridge
```

### 2.2 Start Elasticsearch

```bash
# Start Elasticsearch and Kibana
docker-compose -f docker-compose.elasticsearch.yml up -d

# Check if Elasticsearch is running
curl -u elastic:your_strong_password_here http://localhost:9200

# Expected response:
{
  "name" : "corporate-es-node",
  "cluster_name" : "corporate-digital-library",
  "version" : {
    "number" : "8.11.0"
  }
}
```

### 2.3 Create Elasticsearch Indices

Create `elasticsearch/mappings/documents.json`:

```json
{
  "mappings": {
    "properties": {
      "file_id": { "type": "keyword" },
      "organization_id": { "type": "keyword" },
      "title": { 
        "type": "text", 
        "analyzer": "standard",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "content": { 
        "type": "text", 
        "analyzer": "standard" 
      },
      "author": { "type": "keyword" },
      "department": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "file_type": { "type": "keyword" },
      "mime_type": { "type": "keyword" },
      "size_bytes": { "type": "long" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "extracted_text": { 
        "type": "text", 
        "analyzer": "standard" 
      },
      "ocr_confidence": { "type": "float" },
      "language": { "type": "keyword" },
      "visibility": { "type": "keyword" },
      "folder_path": { "type": "text" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "custom_text_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop", "snowball"]
        }
      }
    }
  }
}
```

Create `elasticsearch/mappings/audit_logs.json`:

```json
{
  "mappings": {
    "properties": {
      "organization_id": { "type": "keyword" },
      "file_id": { "type": "keyword" },
      "employee_id": { "type": "keyword" },
      "action": { "type": "keyword" },
      "details": { "type": "object" },
      "ip_address": { "type": "ip" },
      "user_agent": { "type": "text" },
      "timestamp": { "type": "date" }
    }
  }
}
```

```bash
# Create the main documents index
curl -X PUT "localhost:9200/corporate_documents" \
  -u elastic:your_strong_password_here \
  -H "Content-Type: application/json" \
  -d @elasticsearch/mappings/documents.json

# Create the audit logs index
curl -X PUT "localhost:9200/corporate_audit_logs" \
  -u elastic:your_strong_password_here \
  -H "Content-Type: application/json" \
  -d @elasticsearch/mappings/audit_logs.json
```

### 2.4 Production Elasticsearch Setup (AWS OpenSearch)

For production, use AWS OpenSearch Service:

1. **Create OpenSearch Domain**:
   ```
   Domain Name: corporate-digital-library
   Version: OpenSearch 2.3
   Instance Type: t3.small.search (minimum)
   Number of Instances: 1 (can scale later)
   Storage: 20GB EBS
   Network: VPC (recommended)
   Access Policy: Custom (restrict to your application IPs)
   ```

2. **Configure Access Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/corporate-digital-library-app"
         },
         "Action": "es:*",
         "Resource": "arn:aws:es:us-east-1:YOUR_ACCOUNT_ID:domain/corporate-digital-library/*"
       }
     ]
   }
}
   ```

## 🗄️ 3. Database Setup

### 3.1 Run Database Migrations

```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS coprate_digital_library CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"

# Run the complete schema
mysql -u root -p coprate_digital_library < complete_database_schema.sql

# Verify tables were created
mysql -u root -p coprate_digital_library -e "SHOW TABLES;"
```

### 3.2 Create Database Indexes for Performance

```sql
-- Additional performance indexes
CREATE INDEX idx_files_storage_search ON files(organization_id, is_deleted, is_active);
CREATE INDEX idx_files_created_date ON files(created_at DESC);
CREATE INDEX idx_extraction_jobs_priority ON text_extraction_jobs(status, priority DESC, created_at);
CREATE INDEX idx_search_index_pending ON search_index_status(index_status, organization_id);
```

## 🔐 4. Environment Configuration

### 4.1 Update .env.local

```bash
# Database Configuration
DATABASE_URL="mysql://root:admin@localhost:3306/coprate_digital_library"
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=admin
DB_NAME=coprate_digital_library

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_here_min_32_chars
JWT_EXPIRES_IN=7d

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=corporate-digital-library-your-org
AWS_S3_PRESIGNED_URL_EXPIRES=3600

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_strong_password_here
ELASTICSEARCH_INDEX_PREFIX=corporate

# Storage Configuration
STORAGE_MODE=hybrid
LOCAL_STORAGE_PATH=./storage/files
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,jpeg,png,gif

# Text Extraction Configuration
ENABLE_OCR=true
OCR_LANGUAGE=eng
TESSERACT_PATH=/usr/bin/tesseract

# Background Jobs Configuration
ENABLE_BACKGROUND_JOBS=true
JOB_CONCURRENCY=5
JOB_RETRY_ATTEMPTS=3

# Security Configuration
ENABLE_AUDIT_LOGGING=true
SESSION_TIMEOUT=3600
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MAX_UPLOAD_SIZE=100
NEXT_PUBLIC_SUPPORTED_FORMATS=PDF,DOC,DOCX,XLS,XLSX,PPT,PPTX,TXT,JPG,PNG

# CAPTCHA Configuration (Choose one)
# Google reCAPTCHA v2 (Checkbox) - RECOMMENDED FOR DEVELOPMENT
# Get keys from: https://www.google.com/recaptcha/admin/create
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

## 📦 5. Install Dependencies

### 5.1 Core Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install @elastic/elasticsearch
npm install multer @types/multer
npm install pdf-parse mammoth xlsx
npm install tesseract.js sharp
npm install bull redis ioredis
npm install helmet cors express-rate-limit
npm install winston morgan
npm install joi zod
npm install bcryptjs jsonwebtoken
npm install nodemailer @types/nodemailer
```

### 5.2 Development Dependencies

```bash
npm install --save-dev @types/pdf-parse
npm install --save-dev @types/sharp
npm install --save-dev @types/bcryptjs
npm install --save-dev @types/jsonwebtoken
npm install --save-dev jest @types/jest
npm install --save-dev supertest @types/supertest
```

## 🏃‍♂️ 6. Start Services

### 6.1 Start Required Services

```bash
# Start MySQL (if not running)
sudo systemctl start mysql

# Start Redis (for job queues)
sudo systemctl start redis

# Start Elasticsearch
docker-compose -f docker-compose.elasticsearch.yml up -d

# Verify all services are running
curl http://localhost:9200/_cluster/health
redis-cli ping
mysql -u root -p -e "SELECT 1;"
```

### 6.2 Initialize Application

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Setup Elasticsearch indices
npm run search:setup

# Start the application
npm run dev
```

## 🧪 7. Testing Setup

### 7.1 Test S3 Connection

```bash
# Test S3 connectivity
curl -X GET "http://localhost:3000/api/setup/storage"
```

### 7.2 Test Elasticsearch Connection

```bash
# Test Elasticsearch connectivity
curl -X GET "http://localhost:3000/api/setup/search"
```

### 7.3 Test File Upload

```bash
# Test file upload
curl -X POST "http://localhost:3000/api/files/upload" \
  -H "Authorization: Bearer your_jwt_token" \
  -F "file=@test-document.pdf" \
  -F "folder_id=1"
```

## 🔒 8. Security Implementation

### 8.1 AWS Security
- ✅ S3 bucket has public access blocked
- ✅ IAM user has minimal required permissions
- ✅ S3 bucket encryption is enabled (AES256)
- ✅ Versioning is enabled for data recovery
- ✅ Access logging is configured
- ✅ CORS properly configured for web access
- ✅ Presigned URLs with expiration times

### 8.2 Elasticsearch Security
- ✅ Authentication is enabled
- ✅ Strong passwords are used
- ✅ Network access is restricted
- ✅ SSL/TLS is configured for production
- ✅ Index access is controlled
- ✅ API key authentication for applications

### 8.3 Application Security
- ✅ JWT tokens have expiration
- ✅ Rate limiting is implemented
- ✅ Input validation is enforced
- ✅ File type restrictions are in place
- ✅ Audit logging is enabled
- ✅ HTTPS enforced in production
- ✅ File integrity checks with checksums
- ✅ Secure file permissions (600)

## 📊 9. Monitoring Setup

### 9.1 Application Monitoring

```bash
# Install monitoring dependencies
npm install @sentry/nextjs
npm install prom-client
npm install express-prometheus-middleware
```

### 9.2 Log Management

```bash
# Configure log rotation
sudo nano /etc/logrotate.d/corporate-digital-library

# Add log rotation config
/var/log/corporate-digital-library/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
}
```

### 9.3 Health Checks

Create health check endpoints:

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await testDatabaseConnection(),
    elasticsearch: await testElasticsearchConnection(),
    s3: await testS3Connection(),
    redis: await testRedisConnection(),
  }
  
  const allHealthy = Object.values(checks).every(check => check.status === 'healthy')
  
  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  }, { status: allHealthy ? 200 : 503 })
}
```

## 🚀 10. Production Deployment

### 10.1 Build for Production

```bash
# Build the application
npm run build

# Start in production mode
npm start
```

### 10.2 Process Management

```bash
# Install PM2 for process management
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'corporate-digital-library',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 10.3 Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File upload size limit
    client_max_body_size 100M;
}
```

## 🔧 11. Troubleshooting

### Common Issues and Solutions

1. **S3 Connection Issues**:
   ```bash
   # Check AWS credentials
   aws configure list
   
   # Test S3 access
   aws s3 ls s3://your-bucket-name
   ```

2. **Elasticsearch Connection Issues**:
   ```bash
   # Check Elasticsearch status
   curl -u elastic:password http://localhost:9200/_cluster/health
   
   # Check logs
   docker logs corporate-elasticsearch
   ```

3. **Database Connection Issues**:
   ```bash
   # Test MySQL connection
   mysql -u root -p -e "SELECT 1;"
   
   # Check database exists
   mysql -u root -p -e "SHOW DATABASES;"
   ```

4. **File Upload Issues**:
   - Check file size limits
   - Verify MIME type restrictions
   - Check storage permissions
   - Review error logs

5. **Search Issues**:
   - Verify Elasticsearch indices exist
   - Check index mappings
   - Review search query syntax
   - Monitor Elasticsearch logs

## 📚 Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Next.js Documentation](https://nextjs.org/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)

---

## ✅ Setup Verification Checklist

- [ ] AWS S3 bucket created and configured
- [ ] IAM user created with proper permissions
- [ ] Elasticsearch cluster running and accessible
- [ ] Database schema deployed successfully
- [ ] Environment variables configured
- [ ] All dependencies installed
- [ ] Services started and running
- [ ] Basic functionality tested
- [ ] Security measures implemented
- [ ] Monitoring configured
- [ ] Health checks working
- [ ] File upload/download working
- [ ] Search functionality working
- [ ] Audit logging enabled

Once all items are checked, your Corporate Digital Library system is ready for enterprise use with full S3 and Elasticsearch integration!