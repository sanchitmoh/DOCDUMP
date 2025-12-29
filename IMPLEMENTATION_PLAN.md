# Corporate Digital Library - S3 & Elasticsearch Implementation Plan

## 📋 Overview

This document outlines the implementation strategy for integrating **Amazon S3** for document storage, **Elasticsearch** for search and indexing, and **hybrid online/offline** functionality based on your comprehensive database schema.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Storage Layer │
│   (Next.js)     │◄──►│   (Next.js API) │◄──►│   (S3 + Local)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Elasticsearch  │
                       │   (Search &     │
                       │   Indexing)     │
                       └─────────────────┘
```

## 🗄️ Database Schema Analysis

Your schema is well-designed with the following key components:

### Core Tables
- ✅ **organizations** - Multi-tenant support
- ✅ **organization_employees** - User management
- ✅ **files** - File metadata with storage configuration
- ✅ **folders** - Hierarchical organization
- ✅ **departments** - Department-based access control

### Storage Infrastructure
- ✅ **storage_configurations** - Per-organization storage settings
- ✅ **file_storage_locations** - Multi-location file tracking
- ✅ **storage_sync_jobs** - Sync between S3 and local storage
- ✅ **presigned_url_cache** - URL caching for performance

### Search & Indexing
- ✅ **text_extraction_jobs** - OCR and text extraction
- ✅ **extracted_text_content** - Full-text content storage
- ✅ **search_index_status** - Elasticsearch sync tracking
- ✅ **document_metadata** - Rich document metadata

## 🚀 Implementation Phases

## Phase 1: Core Infrastructure Setup

### 1.1 Environment Configuration
```bash
# Add to .env.local
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=corporate-digital-library

ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password

STORAGE_MODE=hybrid # s3, local, hybrid
```

### 1.2 S3 Service Implementation
```typescript
// lib/storage/s3.ts
export class S3StorageService {
  async uploadFile(file: Buffer, key: string): Promise<string>
  async downloadFile(key: string): Promise<Buffer>
  async generatePresignedUrl(key: string, expires: number): Promise<string>
  async deleteFile(key: string): Promise<void>
  async copyFile(sourceKey: string, targetKey: string): Promise<void>
}
```

### 1.3 Local Storage Service
```typescript
// lib/storage/local.ts
export class LocalStorageService {
  async saveFile(file: Buffer, path: string): Promise<string>
  async readFile(path: string): Promise<Buffer>
  async deleteFile(path: string): Promise<void>
  async moveFile(sourcePath: string, targetPath: string): Promise<void>
}
```

### 1.4 Hybrid Storage Manager
```typescript
// lib/storage/hybrid.ts
export class HybridStorageManager {
  async uploadFile(file: Buffer, metadata: FileMetadata): Promise<StorageResult>
  async downloadFile(fileId: string): Promise<Buffer>
  async syncToRemote(fileId: string): Promise<void>
  async syncToLocal(fileId: string): Promise<void>
}
```

## Phase 2: Elasticsearch Integration

### 2.1 Elasticsearch Service
```typescript
// lib/search/elasticsearch.ts
export class ElasticsearchService {
  async indexDocument(fileId: string, content: DocumentContent): Promise<void>
  async searchDocuments(query: SearchQuery): Promise<SearchResult[]>
  async updateIndex(fileId: string, updates: Partial<DocumentContent>): Promise<void>
  async deleteFromIndex(fileId: string): Promise<void>
}
```

### 2.2 Document Processing Pipeline
```typescript
// lib/processing/document-processor.ts
export class DocumentProcessor {
  async extractText(file: Buffer, mimeType: string): Promise<string>
  async extractMetadata(file: Buffer, mimeType: string): Promise<DocumentMetadata>
  async generateThumbnail(file: Buffer, mimeType: string): Promise<Buffer>
  async processForSearch(fileId: string): Promise<void>
}
```

### 2.3 Search Index Schema
```json
{
  "mappings": {
    "properties": {
      "file_id": { "type": "keyword" },
      "organization_id": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "standard" },
      "content": { "type": "text", "analyzer": "standard" },
      "author": { "type": "keyword" },
      "department": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "file_type": { "type": "keyword" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  }
}
```

## Phase 3: API Implementation

### 3.1 File Upload API
```typescript
// app/api/files/upload/route.ts
export async function POST(request: NextRequest) {
  // 1. Validate user permissions
  // 2. Process multipart form data
  // 3. Store file in configured storage
  // 4. Create database record
  // 5. Queue for text extraction
  // 6. Queue for Elasticsearch indexing
}
```

### 3.2 File Download API
```typescript
// app/api/files/[id]/download/route.ts
export async function GET(request: NextRequest) {
  // 1. Validate user access
  // 2. Check storage locations
  // 3. Generate presigned URL or stream file
  // 4. Log download activity
}
```

### 3.3 Search API
```typescript
// app/api/search/route.ts
export async function POST(request: NextRequest) {
  // 1. Parse search query
  // 2. Apply organization/department filters
  // 3. Execute Elasticsearch query
  // 4. Return formatted results
}
```

## Phase 4: Background Processing

### 4.1 Text Extraction Worker
```typescript
// lib/workers/text-extraction.ts
export class TextExtractionWorker {
  async processJob(jobId: string): Promise<void> {
    // 1. Download file from storage
    // 2. Extract text based on file type
    // 3. Store extracted content
    // 4. Update job status
    // 5. Trigger search indexing
  }
}
```

### 4.2 Search Indexing Worker
```typescript
// lib/workers/search-indexing.ts
export class SearchIndexingWorker {
  async indexFile(fileId: string): Promise<void> {
    // 1. Gather file metadata
    // 2. Get extracted text content
    // 3. Create search document
    // 4. Index in Elasticsearch
    // 5. Update index status
  }
}
```

### 4.3 Storage Sync Worker
```typescript
// lib/workers/storage-sync.ts
export class StorageSyncWorker {
  async syncFiles(organizationId: string): Promise<void> {
    // 1. Compare local vs remote files
    // 2. Upload missing files to S3
    // 3. Download missing files locally
    // 4. Update storage locations
    // 5. Log sync operations
  }
}
```

## Phase 5: Frontend Implementation

### 5.1 File Upload Component
```typescript
// components/file-upload.tsx
export function FileUpload() {
  // 1. Drag & drop interface
  // 2. Progress tracking
  // 3. Metadata input
  // 4. Department/folder selection
}
```

### 5.2 Search Interface
```typescript
// components/search.tsx
export function SearchInterface() {
  // 1. Advanced search filters
  // 2. Real-time suggestions
  // 3. Result highlighting
  // 4. Faceted search
}
```

### 5.3 File Browser
```typescript
// components/file-browser.tsx
export function FileBrowser() {
  // 1. Folder navigation
  // 2. File preview
  // 3. Bulk operations
  // 4. Permission management
}
```

## 📊 Storage Configuration Management

### Per-Organization Settings
```typescript
interface StorageConfiguration {
  organizationId: string
  storageType: 'local' | 's3' | 'hybrid'
  s3Config?: {
    bucket: string
    region: string
    accessKeyId: string
    secretAccessKey: string
  }
  localConfig?: {
    basePath: string
    maxSize: number
  }
  syncSettings?: {
    enabled: boolean
    interval: number
    priority: 'local' | 'remote'
  }
}
```

## 🔍 Search Features Implementation

### Advanced Search Capabilities
- **Full-text search** across document content
- **Metadata search** (author, title, tags)
- **Department-based filtering**
- **Date range queries**
- **File type filtering**
- **Fuzzy matching**
- **Autocomplete suggestions**

### Search Query Examples
```typescript
// Simple text search
const results = await searchService.search({
  query: "quarterly report",
  organizationId: "123",
  filters: {
    department: "Finance",
    fileType: "pdf",
    dateRange: {
      from: "2024-01-01",
      to: "2024-12-31"
    }
  }
})

// Advanced search with facets
const results = await searchService.advancedSearch({
  query: {
    bool: {
      must: [
        { match: { content: "budget analysis" } },
        { term: { department: "Finance" } }
      ],
      filter: [
        { range: { created_at: { gte: "2024-01-01" } } }
      ]
    }
  },
  facets: ["department", "file_type", "author"]
})
```

## 🔄 Online/Offline Synchronization

### Sync Strategies
1. **Real-time sync** - Immediate upload to S3 when online
2. **Batch sync** - Periodic synchronization of offline changes
3. **Conflict resolution** - Handle concurrent modifications
4. **Priority queuing** - Critical files sync first

### Offline Capabilities
- **Local file storage** for offline access
- **Metadata caching** for search functionality
- **Queue management** for pending uploads
- **Conflict detection** and resolution

## 🛡️ Security Implementation

### Access Control
- **Role-based permissions** (read, write, admin)
- **Department-level isolation**
- **File-level permissions**
- **Audit logging** for all operations

### Data Protection
- **Encryption at rest** (S3 server-side encryption)
- **Encryption in transit** (HTTPS/TLS)
- **Presigned URL expiration**
- **Access token validation**

## 📈 Monitoring & Analytics

### Performance Metrics
- **Upload/download speeds**
- **Search response times**
- **Storage usage by organization**
- **Sync operation success rates**

### Business Metrics
- **Document access patterns**
- **Search query analytics**
- **User activity tracking**
- **Storage cost optimization**

## 🚀 Deployment Strategy

### Infrastructure Requirements
```yaml
# docker-compose.yml
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - ELASTICSEARCH_URL=${ELASTICSEARCH_URL}
  
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
  
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
```

### Scaling Considerations
- **Horizontal scaling** with load balancers
- **Database read replicas** for search queries
- **Elasticsearch cluster** for high availability
- **CDN integration** for file delivery

## 📋 Implementation Checklist

### Phase 1: Foundation ✅
- [ ] Set up AWS S3 bucket and IAM roles
- [ ] Configure Elasticsearch cluster
- [ ] Implement storage service abstractions
- [ ] Create database migration scripts
- [ ] Set up environment configurations

### Phase 2: Core Features ✅
- [ ] File upload/download APIs
- [ ] Text extraction pipeline
- [ ] Search indexing system
- [ ] Basic search functionality
- [ ] File browser interface

### Phase 3: Advanced Features ✅
- [ ] Advanced search with filters
- [ ] Offline synchronization
- [ ] Bulk operations
- [ ] Permission management
- [ ] Audit logging

### Phase 4: Optimization ✅
- [ ] Performance monitoring
- [ ] Caching strategies
- [ ] Search result ranking
- [ ] Storage cost optimization
- [ ] Security hardening

## 🔧 Development Tools

### Required Dependencies
```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x.x",
    "@elastic/elasticsearch": "^8.x.x",
    "multer": "^1.x.x",
    "pdf-parse": "^1.x.x",
    "mammoth": "^1.x.x",
    "tesseract.js": "^4.x.x",
    "sharp": "^0.32.x"
  }
}
```

### Development Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:migrate": "node scripts/migrate.js",
    "search:setup": "node scripts/setup-elasticsearch.js",
    "worker:start": "node scripts/start-workers.js"
  }
}
```

## 📚 Next Steps

1. **Review and approve** this implementation plan
2. **Set up development environment** with required services
3. **Create project structure** following the outlined architecture
4. **Implement Phase 1** foundation components
5. **Test integration** between services
6. **Iterate and refine** based on requirements

---

This implementation plan provides a comprehensive roadmap for building a robust, scalable corporate digital library with S3 storage, Elasticsearch search, and hybrid online/offline capabilities. The modular architecture ensures maintainability and allows for incremental development and deployment.