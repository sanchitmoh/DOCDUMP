# Schema Usage Examples

This document provides practical examples for using the storage, search, and multimedia schemas.

## Table of Contents
1. [S3 Storage Setup](#s3-storage-setup)
2. [File Upload with S3](#file-upload-with-s3)
3. [Text Extraction](#text-extraction)
4. [Elasticsearch Indexing](#elasticsearch-indexing)
5. [Multimedia Processing](#multimedia-processing)
6. [Search Queries](#search-queries)

---

## S3 Storage Setup

### Configure S3 Storage for an Organization

```sql
-- Create storage configuration
INSERT INTO storage_configurations (
  organization_id,
  storage_type,
  s3_bucket_name,
  s3_region,
  s3_encryption_type,
  max_file_size_bytes,
  storage_quota_bytes
) VALUES (
  1,
  's3',
  'corporate-library-bucket',
  'us-east-1',
  'AES256',
  10737418240,  -- 10GB max file size
  1099511627776  -- 1TB quota
);
```

### Configure Hybrid Storage (S3 + Local)

```sql
INSERT INTO storage_configurations (
  organization_id,
  storage_type,
  s3_bucket_name,
  s3_region,
  local_storage_path,
  hybrid_primary_storage,
  hybrid_sync_enabled,
  hybrid_sync_interval_minutes
) VALUES (
  1,
  'hybrid',
  'corporate-library-bucket',
  'us-east-1',
  '/var/lib/library/files',
  's3',
  1,
  60  -- sync every hour
);
```

---

## File Upload with S3

### Upload File and Store Metadata

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

async function uploadFileToS3(
  file: File,
  organizationId: number,
  folderId: number,
  userId: number
) {
  // 1. Generate S3 key
  const timestamp = Date.now();
  const fileId = await getNextFileId();
  const s3Key = `${organizationId}/${folderId}/${fileId}-${file.name}`;
  
  // 2. Calculate checksum
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');
  
  // 3. Upload to S3
  const s3Client = new S3Client({ region: 'us-east-1' });
  await s3Client.send(new PutObjectCommand({
    Bucket: 'corporate-library-bucket',
    Key: s3Key,
    Body: fileBuffer,
    ContentType: file.type,
    ServerSideEncryption: 'AES256',
    Metadata: {
      'file-id': fileId.toString(),
      'organization-id': organizationId.toString(),
      'checksum': checksum
    }
  }));
  
  // 4. Store file metadata in database
  await db.query(`
    INSERT INTO files (
      folder_id, organization_id, name, mime_type,
      size_bytes, storage_mode, storage_provider,
      s3_bucket, s3_key, checksum_sha256,
      created_by
    ) VALUES (?, ?, ?, ?, ?, 'remote', 's3', ?, ?, ?, ?)
  `, [
    folderId, organizationId, file.name, file.type,
    file.size, 'corporate-library-bucket', s3Key,
    checksum, userId
  ]);
  
  // 5. Create storage location record
  await db.query(`
    INSERT INTO file_storage_locations (
      file_id, storage_type, location_path,
      is_primary, checksum_sha256, size_bytes
    ) VALUES (?, 's3', ?, 1, ?, ?)
  `, [fileId, s3Key, checksum, file.size]);
  
  return fileId;
}
```

### Generate Presigned URL for Download

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

async function getPresignedDownloadUrl(fileId: number, expiresIn: number = 3600) {
  // Get file metadata
  const file = await db.query('SELECT s3_bucket, s3_key FROM files WHERE id = ?', [fileId]);
  
  // Check cache first
  const cached = await db.query(`
    SELECT presigned_url FROM presigned_url_cache
    WHERE file_id = ? AND url_type = 'download' AND expires_at > NOW()
    ORDER BY expires_at DESC LIMIT 1
  `, [fileId]);
  
  if (cached.length > 0) {
    return cached[0].presigned_url;
  }
  
  // Generate new presigned URL
  const command = new GetObjectCommand({
    Bucket: file.s3_bucket,
    Key: file.s3_key
  });
  
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  
  // Cache the URL
  await db.query(`
    INSERT INTO presigned_url_cache (
      file_id, url_type, presigned_url, expires_at
    ) VALUES (?, 'download', ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
  `, [fileId, url, expiresIn]);
  
  return url;
}
```

---

## Text Extraction

### Start Text Extraction Job

```typescript
async function extractTextFromFile(fileId: number, organizationId: number) {
  // Get file metadata
  const file = await db.query(`
    SELECT mime_type, s3_bucket, s3_key FROM files WHERE id = ?
  `, [fileId]);
  
  // Determine extraction method based on MIME type
  let extractionMethod: ExtractionMethod;
  if (file.mime_type === 'application/pdf') {
    extractionMethod = 'pdfplumber';
  } else if (file.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    extractionMethod = 'docx';
  } else if (file.mime_type.startsWith('image/')) {
    extractionMethod = 'tesseract';
  } else {
    extractionMethod = 'custom';
  }
  
  // Create extraction job
  const [job] = await db.query(`
    INSERT INTO text_extraction_jobs (
      file_id, organization_id, extraction_method, status, priority
    ) VALUES (?, ?, ?, 'pending', 5)
    RETURNING id
  `, [fileId, organizationId, extractionMethod]);
  
  // Process extraction (in background worker)
  await processExtractionJob(job.id);
  
  return job.id;
}

async function processExtractionJob(jobId: number) {
  const job = await db.query('SELECT * FROM text_extraction_jobs WHERE id = ?', [jobId]);
  const file = await db.query('SELECT * FROM files WHERE id = ?', [job.file_id]);
  
  try {
    await db.query(`
      UPDATE text_extraction_jobs SET status = 'processing', started_at = NOW()
      WHERE id = ?
    `, [jobId]);
    
    // Download file from S3
    const fileContent = await downloadFromS3(file.s3_bucket, file.s3_key);
    
    // Extract text based on method
    let extractedText: string;
    let metadata: any = {};
    
    switch (job.extraction_method) {
      case 'pdfplumber':
        const pdf = await extractPDFText(fileContent);
        extractedText = pdf.text;
        metadata = pdf.metadata;
        break;
      case 'docx':
        extractedText = await extractDOCXText(fileContent);
        break;
      case 'tesseract':
        const ocr = await performOCR(fileContent);
        extractedText = ocr.text;
        metadata = { confidence: ocr.confidence };
        break;
    }
    
    // Store extracted text
    await db.query(`
      INSERT INTO extracted_text_content (
        file_id, extraction_job_id, content_type,
        extracted_text, word_count, character_count
      ) VALUES (?, ?, 'full_text', ?, ?, ?)
    `, [
      job.file_id,
      jobId,
      extractedText,
      extractedText.split(/\s+/).length,
      extractedText.length
    ]);
    
    // Update job status
    await db.query(`
      UPDATE text_extraction_jobs
      SET status = 'completed', completed_at = NOW()
      WHERE id = ?
    `, [jobId]);
    
    // Index in Elasticsearch
    await indexFileInElasticsearch(job.file_id);
    
  } catch (error) {
    await db.query(`
      UPDATE text_extraction_jobs
      SET status = 'failed', error_message = ?, error_code = ?
      WHERE id = ?
    `, [error.message, error.code, jobId]);
  }
}
```

---

## Elasticsearch Indexing

### Index File in Elasticsearch

```typescript
import { Client } from '@elastic/elasticsearch';

const esClient = new Client({ node: 'http://localhost:9200' });

async function indexFileInElasticsearch(fileId: number) {
  // Get file with all metadata
  const file = await getFileWithMetadata(fileId);
  
  // Build Elasticsearch document
  const doc: ElasticsearchFileDocument = {
    file_id: file.id,
    organization_id: file.organization_id,
    folder_id: file.folder_id,
    name: file.name,
    description: file.description,
    mime_type: file.mime_type,
    file_type: file.file_type,
    size_bytes: file.size_bytes,
    storage_mode: file.storage_mode,
    storage_provider: file.storage_provider,
    s3_bucket: file.s3_bucket,
    s3_key: file.s3_key,
    created_by: file.created_by,
    created_at: file.created_at,
    updated_at: file.updated_at,
    visibility: file.visibility,
    is_active: file.is_active,
    is_deleted: file.is_deleted,
    checksum_sha256: file.checksum_sha256,
    full_text_searchable: true,
    indexed_at: new Date(),
    index_version: 1
  };
  
  // Add extracted text
  if (file.extracted_text && file.extracted_text.length > 0) {
    doc.extracted_text = file.extracted_text
      .map(et => et.extracted_text)
      .join('\n\n');
    doc.text_extraction = {
      status: 'completed',
      extracted_at: file.extracted_text[0].created_at,
      method: 'pdfplumber',
      page_count: file.extracted_text.length,
      word_count: file.extracted_text.reduce((sum, et) => sum + (et.word_count || 0), 0),
      character_count: file.extracted_text.reduce((sum, et) => sum + (et.character_count || 0), 0)
    };
  }
  
  // Add multimedia metadata
  if (file.image_metadata) {
    doc.multimedia_metadata = {
      type: 'image',
      image: file.image_metadata
    };
  } else if (file.video_metadata) {
    doc.multimedia_metadata = {
      type: 'video',
      video: file.video_metadata
    };
  } else if (file.audio_metadata) {
    doc.multimedia_metadata = {
      type: 'audio',
      audio: file.audio_metadata
    };
  } else if (file.document_metadata) {
    doc.multimedia_metadata = {
      type: 'document',
      document: file.document_metadata
    };
  }
  
  // Add OCR data
  if (file.ocr_results && file.ocr_results.length > 0) {
    const ocr = file.ocr_results[0];
    doc.ocr_data = {
      has_ocr: true,
      ocr_text: ocr.ocr_text,
      ocr_confidence: ocr.confidence_score,
      ocr_language: ocr.language,
      ocr_engine: ocr.ocr_engine
    };
  }
  
  // Index document
  await esClient.index({
    index: 'files',
    id: `file_${fileId}`,
    document: doc
  });
  
  // Update index status
  await db.query(`
    INSERT INTO search_index_status (
      file_id, organization_id, index_name, index_status,
      indexed_at, document_id
    ) VALUES (?, ?, 'files', 'indexed', NOW(), ?)
    ON DUPLICATE KEY UPDATE
      index_status = 'indexed',
      indexed_at = NOW(),
      last_indexed_at = NOW()
  `, [fileId, file.organization_id, `file_${fileId}`]);
}
```

---

## Multimedia Processing

### Extract Image Metadata

```typescript
import sharp from 'sharp';
import ExifReader from 'exifreader';

async function extractImageMetadata(fileId: number, fileBuffer: Buffer) {
  const image = sharp(fileBuffer);
  const metadata = await image.metadata();
  const exif = ExifReader.load(fileBuffer);
  
  const imageMetadata: ImageMetadata = {
    file_id: fileId,
    width: metadata.width!,
    height: metadata.height!,
    format: metadata.format!.toUpperCase() as ImageFormat,
    color_space: metadata.space as ColorSpace,
    has_transparency: metadata.hasAlpha || false,
    has_alpha_channel: metadata.hasAlpha || false,
    quality: metadata.quality,
    dpi_x: metadata.density ? metadata.density / 2.54 : null,
    dpi_y: metadata.density ? metadata.density / 2.54 : null,
    orientation: metadata.width! > metadata.height! ? 'landscape' : 'portrait',
    camera_make: exif.Make?.description,
    camera_model: exif.Model?.description,
    focal_length: exif.FocalLength?.value,
    aperture: exif.FNumber?.value,
    iso_speed: exif.ISOSpeedRatings?.value,
    date_taken: exif.DateTimeOriginal?.value,
    gps_latitude: exif.GPSLatitude?.value,
    gps_longitude: exif.GPSLongitude?.value,
    exif_data_json: exif
  };
  
  // Analyze dominant colors
  const { dominant } = await image.stats();
  imageMetadata.dominant_colors = dominant.map(c => `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`);
  
  // Store in database
  await db.query(`
    INSERT INTO image_metadata SET ?
    ON DUPLICATE KEY UPDATE ?
  `, [imageMetadata, imageMetadata]);
  
  // Generate thumbnail
  await generateThumbnail(fileId, fileBuffer);
  
  return imageMetadata;
}

async function generateThumbnail(fileId: number, fileBuffer: Buffer) {
  const thumbnail = await sharp(fileBuffer)
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  // Upload thumbnail to S3
  const thumbnailKey = `thumbnails/${fileId}_medium.jpg`;
  await uploadToS3('thumbnails-bucket', thumbnailKey, thumbnail);
  
  // Store thumbnail metadata
  await db.query(`
    INSERT INTO multimedia_thumbnails (
      file_id, thumbnail_type, size_category,
      storage_key, storage_url, format, width, height
    ) VALUES (?, 'image', 'medium', ?, ?, 'JPEG', 300, 300)
  `, [fileId, thumbnailKey, `https://cdn.example.com/${thumbnailKey}`]);
}
```

### Extract Video Metadata

```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';

async function extractVideoMetadata(fileId: number, videoPath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      const videoMetadata: VideoMetadata = {
        file_id: fileId,
        duration_seconds: metadata.format.duration || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        aspect_ratio: videoStream?.display_aspect_ratio,
        frame_rate: parseFloat(videoStream?.r_frame_rate?.split('/')[0] || '0') / parseFloat(videoStream?.r_frame_rate?.split('/')[1] || '1'),
        video_codec: videoStream?.codec_name as VideoCodec,
        video_bitrate: parseInt(metadata.format.bit_rate || '0'),
        has_audio: !!audioStream,
        audio_codec: audioStream?.codec_name as AudioCodec,
        audio_bitrate: parseInt(audioStream?.bit_rate || '0'),
        audio_sample_rate: audioStream?.sample_rate,
        audio_channels: audioStream?.channels,
        container_format: metadata.format.format_name?.split(',')[0] as ContainerFormat,
        file_size_bytes: parseInt(metadata.format.size || '0')
      };
      
      // Determine resolution category
      if (videoMetadata.width >= 7680) videoMetadata.resolution_category = '8K';
      else if (videoMetadata.width >= 3840) videoMetadata.resolution_category = '4K';
      else if (videoMetadata.width >= 2048) videoMetadata.resolution_category = '2K';
      else if (videoMetadata.width >= 1920) videoMetadata.resolution_category = 'FullHD';
      else if (videoMetadata.width >= 1280) videoMetadata.resolution_category = 'HD';
      else videoMetadata.resolution_category = 'SD';
      
      // Store in database
      db.query(`
        INSERT INTO video_metadata SET ?
        ON DUPLICATE KEY UPDATE ?
      `, [videoMetadata, videoMetadata]).then(() => {
        resolve(videoMetadata);
      }).catch(reject);
    });
  });
}
```

---

## Search Queries

### Basic Full-Text Search

```typescript
async function searchFiles(query: SearchQuery) {
  const esQuery: any = {
    bool: {
      must: [
        {
          match: {
            organization_id: query.organization_id
          }
        },
        {
          match: {
            is_deleted: false
          }
        }
      ]
    }
  };
  
  // Add text query
  if (query.query) {
    esQuery.bool.should = [
      {
        multi_match: {
          query: query.query,
          fields: ['name^3', 'description^2', 'extracted_text', 'ai_description'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      },
      {
        match_phrase: {
          name: {
            query: query.query,
            boost: 2
          }
        }
      }
    ];
    esQuery.bool.minimum_should_match = 1;
  }
  
  // Add filters
  const filters: any[] = [];
  
  if (query.folder_id) {
    filters.push({ term: { folder_id: query.folder_id } });
  }
  
  if (query.tags && query.tags.length > 0) {
    filters.push({ terms: { tags: query.tags } });
  }
  
  if (query.file_types && query.file_types.length > 0) {
    filters.push({ terms: { file_type: query.file_types } });
  }
  
  if (query.mime_types && query.mime_types.length > 0) {
    filters.push({ terms: { mime_type: query.mime_types } });
  }
  
  if (query.date_from || query.date_to) {
    filters.push({
      range: {
        created_at: {
          gte: query.date_from,
          lte: query.date_to
        }
      }
    });
  }
  
  if (filters.length > 0) {
    esQuery.bool.filter = filters;
  }
  
  // Execute search
  const result = await esClient.search({
    index: 'files',
    body: {
      query: esQuery,
      highlight: {
        fields: {
          name: {},
          extracted_text: { fragment_size: 150 }
        }
      },
      sort: query.sort_by === 'relevance' ? undefined : [
        { [query.sort_by || 'created_at']: { order: query.sort_order || 'desc' } }
      ],
      from: ((query.page || 1) - 1) * (query.page_size || 20),
      size: query.page_size || 20
    }
  });
  
  return result.body.hits.hits.map((hit: any) => ({
    file_id: hit._source.file_id,
    score: hit._score,
    highlights: hit.highlight ? Object.values(hit.highlight).flat() : [],
    file: hit._source
  }));
}
```

### Advanced Multimedia Search

```typescript
// Search for images taken with a specific camera
async function searchImagesByCamera(organizationId: number, cameraMake: string, cameraModel: string) {
  const result = await esClient.search({
    index: 'files',
    body: {
      query: {
        bool: {
          must: [
            { term: { organization_id: organizationId } },
            { term: { 'multimedia_metadata.type': 'image' } },
            { match: { 'multimedia_metadata.image.camera_make': cameraMake } },
            { match: { 'multimedia_metadata.image.camera_model': cameraModel } }
          ]
        }
      }
    }
  });
  
  return result.body.hits.hits;
}

// Search for videos by resolution
async function searchVideosByResolution(organizationId: number, minWidth: number, minHeight: number) {
  const result = await esClient.search({
    index: 'files',
    body: {
      query: {
        bool: {
          must: [
            { term: { organization_id: organizationId } },
            { term: { 'multimedia_metadata.type': 'video' } },
            { range: { 'multimedia_metadata.video.width': { gte: minWidth } } },
            { range: { 'multimedia_metadata.video.height': { gte: minHeight } } }
          ]
        }
      }
    }
  });
  
  return result.body.hits.hits;
}

// Search for audio files by artist
async function searchAudioByArtist(organizationId: number, artist: string) {
  const result = await esClient.search({
    index: 'files',
    body: {
      query: {
        bool: {
          must: [
            { term: { organization_id: organizationId } },
            { term: { 'multimedia_metadata.type': 'audio' } },
            { match: { 'multimedia_metadata.audio.artist': artist } }
          ]
        }
      }
    }
  });
  
  return result.body.hits.hits;
}
```

---

## Hybrid Storage Sync

### Sync Files Between S3 and Local

```typescript
async function syncStorage(organizationId: number, direction: 's3_to_local' | 'local_to_s3') {
  // Create sync job
  const [job] = await db.query(`
    INSERT INTO storage_sync_jobs (
      organization_id, sync_type, source_storage, target_storage, status
    ) VALUES (?, 'full', ?, ?, 'running')
    RETURNING id
  `, [
    organizationId,
    direction === 's3_to_local' ? 's3' : 'local',
    direction === 's3_to_local' ? 'local' : 's3'
  ]);
  
  try {
    // Get files to sync
    const files = await db.query(`
      SELECT * FROM files
      WHERE organization_id = ? AND is_deleted = 0
    `, [organizationId]);
    
    let processed = 0;
    
    for (const file of files) {
      if (direction === 's3_to_local') {
        // Download from S3 and save locally
        const fileContent = await downloadFromS3(file.s3_bucket, file.s3_key);
        const localPath = `${localBasePath}/${file.s3_key}`;
        await fs.writeFile(localPath, fileContent);
        
        // Update file record
        await db.query(`
          UPDATE files SET local_path = ?, is_synced = 1, last_sync_at = NOW()
          WHERE id = ?
        `, [localPath, file.id]);
        
        // Create storage location record
        await db.query(`
          INSERT INTO file_storage_locations (
            file_id, storage_type, location_path, is_backup
          ) VALUES (?, 'local', ?, 1)
        `, [file.id, localPath]);
        
      } else {
        // Upload local file to S3
        const fileContent = await fs.readFile(file.local_path);
        await uploadToS3(file.s3_bucket, file.s3_key, fileContent);
        
        // Update file record
        await db.query(`
          UPDATE files SET is_synced = 1, last_sync_at = NOW()
          WHERE id = ?
        `, [file.id]);
      }
      
      processed++;
      
      // Update progress
      await db.query(`
        UPDATE storage_sync_jobs
        SET files_processed = ?, progress_percent = ?
        WHERE id = ?
      `, [
        processed,
        Math.round((processed / files.length) * 100),
        job.id
      ]);
    }
    
    // Complete job
    await db.query(`
      UPDATE storage_sync_jobs
      SET status = 'completed', completed_at = NOW()
      WHERE id = ?
    `, [job.id]);
    
  } catch (error) {
    await db.query(`
      UPDATE storage_sync_jobs
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `, [error.message, job.id]);
  }
}
```


