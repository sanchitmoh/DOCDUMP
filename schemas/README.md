# Storage & Search Schemas Documentation

This directory contains comprehensive schemas for Amazon S3 storage, Elasticsearch indexing, text extraction, and multimedia metadata support for the Corporate Digital Library system.

## Schema Files

### 1. `s3_storage_schema.sql`
Enhanced database schema for S3 storage with support for:
- **Remote Storage (S3)**: Full S3 integration with bucket, region, encryption, and storage classes
- **Offline/Local Storage**: Local filesystem storage with backup support
- **Hybrid Mode**: Synchronization between S3 and local storage
- **Storage Configurations**: Per-organization storage settings
- **Storage Locations**: Track multiple storage locations for redundancy
- **Sync Jobs**: Background synchronization for hybrid mode
- **Usage Tracking**: Storage usage statistics and quotas
- **Presigned URLs**: Caching for S3 presigned URLs
- **Operations Log**: Audit trail for all storage operations

**Key Tables:**
- `storage_configurations` - Organization-level storage settings
- `file_storage_locations` - Multiple storage locations per file
- `storage_sync_jobs` - Background sync jobs
- `storage_usage_stats` - Usage tracking
- `presigned_url_cache` - URL caching
- `storage_operations_log` - Audit logging

### 2. `elasticsearch_mappings.json`
Elasticsearch index mapping for comprehensive search across all file types:
- **Full-text search** on document content, extracted text, and metadata
- **Multimedia support** with nested mappings for images, videos, and audio
- **Text extraction** metadata indexing
- **OCR data** indexing
- **Faceted search** on tags, departments, file types, etc.
- **Completion suggester** for autocomplete
- **Custom analyzers** for better text search

**Key Features:**
- Supports documents, images, videos, audio files
- Nested multimedia metadata structures
- Text extraction and OCR indexing
- Search suggestions and autocomplete
- Configurable analyzers and tokenizers

### 3. `text_extraction_schema.sql`
Schema for text extraction from various file formats:
- **Extraction Jobs**: Track extraction processes with retry logic
- **Extracted Text**: Store extracted content with page-level granularity
- **Document Metadata**: PDF, DOCX, PPTX metadata extraction
- **OCR Results**: Image and scanned document OCR
- **Extraction Statistics**: Performance and success metrics
- **Search Index Status**: Track Elasticsearch indexing status

**Supported Formats:**
- PDF (pdfplumber, pdfminer)
- DOCX, PPTX, XLSX
- Images (Tesseract OCR, AWS Textract)
- Text files
- Custom extraction methods

**Key Tables:**
- `text_extraction_jobs` - Extraction job tracking
- `extracted_text_content` - Extracted text storage
- `document_metadata` - Document properties
- `ocr_results` - OCR data
- `search_index_status` - Indexing status

### 4. `multimedia_metadata_schema.sql`
Comprehensive metadata storage for multimedia files:
- **Image Metadata**: EXIF data, dimensions, color space, camera info, GPS
- **Video Metadata**: Codec, resolution, frame rate, audio tracks, subtitles
- **Audio Metadata**: ID3 tags, codec, bitrate, sample rate, album art
- **Processing Jobs**: Thumbnail generation, transcoding, analysis
- **Thumbnails**: Generated preview images

**Key Tables:**
- `image_metadata` - Image EXIF and properties
- `video_metadata` - Video codec and properties
- `audio_metadata` - Audio tags and properties
- `multimedia_processing_jobs` - Processing job tracking
- `multimedia_thumbnails` - Generated thumbnails

### 5. `storage_configuration_schema.json`
JSON schema for storage configuration validation:
- S3 configuration structure
- Local storage configuration
- Hybrid mode settings
- Storage limits and quotas
- Lifecycle policies

## Usage

### Database Setup

1. **Run the SQL schemas** in order:
   ```sql
   -- First, run the base schema
   source complete_database_schema.sql;
   
   -- Then add storage support
   source schemas/s3_storage_schema.sql;
   
   -- Add text extraction support
   source schemas/text_extraction_schema.sql;
   
   -- Add multimedia support
   source schemas/multimedia_metadata_schema.sql;
   ```

### Elasticsearch Setup

1. **Create the index** with the mapping:
   ```bash
   curl -X PUT "localhost:9200/files" -H 'Content-Type: application/json' -d @schemas/elasticsearch_mappings.json
   ```

2. **Index a document**:
   ```json
   {
     "file_id": 123,
     "organization_id": 1,
     "name": "document.pdf",
     "extracted_text": "...",
     "multimedia_metadata": {...}
   }
   ```

### Storage Configuration

Configure storage per organization:

```sql
INSERT INTO storage_configurations (
  organization_id,
  storage_type,
  s3_bucket_name,
  s3_region,
  s3_access_key_id,
  s3_secret_access_key
) VALUES (
  1,
  's3',
  'my-bucket',
  'us-east-1',
  'AKIA...',
  'encrypted_secret...'
);
```

### Text Extraction

Start a text extraction job:

```sql
INSERT INTO text_extraction_jobs (
  file_id,
  organization_id,
  extraction_method,
  priority
) VALUES (
  123,
  1,
  'pdfplumber',
  8
);
```

### Multimedia Processing

Extract image metadata:

```sql
INSERT INTO image_metadata (
  file_id,
  width,
  height,
  format,
  camera_make,
  camera_model
) VALUES (
  456,
  1920,
  1080,
  'JPEG',
  'Canon',
  'EOS 5D Mark IV'
);
```

## Remote vs Offline Storage

### Remote Storage (S3)
- Files stored in Amazon S3
- Access via presigned URLs
- Supports multiple storage classes
- Automatic lifecycle management
- CDN integration support

### Offline Storage (Local)
- Files stored on local filesystem
- Backup support
- No internet required
- Faster access for local users
- Suitable for air-gapped environments

### Hybrid Mode
- Synchronize between S3 and local
- Configurable sync direction
- Conflict resolution strategies
- Background sync jobs
- Redundancy and disaster recovery

## File Type Support

### Documents
- PDF, DOCX, PPTX, XLSX
- ODT, RTF, TXT, HTML, Markdown
- Text extraction and indexing
- Metadata extraction

### Images
- JPEG, PNG, GIF, WEBP, TIFF
- EXIF data extraction
- OCR support
- Thumbnail generation
- Color analysis

### Videos
- MP4, MKV, AVI, WebM
- Codec detection
- Frame extraction
- Thumbnail generation
- Subtitle support

### Audio
- MP3, AAC, FLAC, Opus, Vorbis
- ID3 tag extraction
- Album art support
- Lyrics support
- ReplayGain

## Search Capabilities

Elasticsearch provides:
- **Full-text search** across document content
- **Faceted filtering** by tags, departments, file types
- **Autocomplete** suggestions
- **Multimedia search** by metadata (camera, artist, etc.)
- **OCR search** for scanned documents
- **Fuzzy matching** for typos
- **Highlighting** of search results

## Best Practices

1. **Storage**: Use S3 for production, local for development/testing
2. **Indexing**: Index files asynchronously after upload
3. **Extraction**: Use appropriate extraction methods per file type
4. **Metadata**: Extract metadata in background jobs
5. **Thumbnails**: Generate thumbnails for faster previews
6. **Sync**: Use hybrid mode for redundancy
7. **Monitoring**: Track extraction and indexing success rates

## Migration Notes

When migrating from existing schema:
1. Add new columns to `files` table (storage_mode, etc.)
2. Migrate existing `storage_key` to new `s3_key` format
3. Create storage configurations for existing organizations
4. Re-index existing files in Elasticsearch
5. Extract metadata for existing multimedia files

## Security Considerations

- Encrypt S3 credentials in database
- Use IAM roles when possible (instead of access keys)
- Enable S3 encryption (AES256 or KMS)
- Restrict presigned URL expiration times
- Audit all storage operations
- Implement storage quotas per organization

