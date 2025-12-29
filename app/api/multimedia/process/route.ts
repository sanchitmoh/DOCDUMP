import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { userId, organizationId } = decoded
    const { fileId, processingType, options = {} } = await request.json()

    if (!fileId || !processingType) {
      return NextResponse.json({ 
        error: 'File ID and processing type are required' 
      }, { status: 400 })
    }

    // Verify file exists and user has access
    const files = await executeQuery(`
      SELECT f.id, f.name, f.mime_type, f.size_bytes, f.storage_provider, f.created_by,
             fsl.location_path, fsl.storage_type
      FROM files f
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
    `, [fileId, organizationId])

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = files[0]

    // Check if user has permission to process this file
    const hasPermission = file.created_by === userId || 
                         await checkFilePermission(fileId, userId, 'write')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validate processing type based on file type
    const validProcessingTypes = getValidProcessingTypes(file.mime_type)
    if (!validProcessingTypes.includes(processingType)) {
      return NextResponse.json({ 
        error: `Processing type '${processingType}' not supported for file type '${file.mime_type}'` 
      }, { status: 400 })
    }

    // Check if processing job already exists
    const existingJobs = await executeQuery(`
      SELECT id, status FROM multimedia_processing_jobs
      WHERE file_id = ? AND processing_type = ? AND status IN ('pending', 'processing')
    `, [fileId, processingType])

    if (existingJobs.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Processing job already exists',
        jobId: existingJobs[0].id,
        status: existingJobs[0].status
      })
    }

    // Create processing job
    const priority = options.priority || 5
    const jobResult = await executeSingle(`
      INSERT INTO multimedia_processing_jobs (
        file_id, organization_id, processing_type, priority, processing_options
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      fileId,
      organizationId,
      processingType,
      priority,
      JSON.stringify(options)
    ])

    const jobId = jobResult.insertId

    // Start processing based on type
    let processingResult
    try {
      // Update job status to processing
      await executeSingle(`
        UPDATE multimedia_processing_jobs 
        SET status = 'processing', started_at = NOW()
        WHERE id = ?
      `, [jobId])

      switch (processingType) {
        case 'thumbnail':
          processingResult = await generateThumbnail(file, options)
          break
        case 'preview':
          processingResult = await generatePreview(file, options)
          break
        case 'extract_metadata':
          processingResult = await extractMetadata(file, options)
          break
        case 'analyze':
          processingResult = await analyzeContent(file, options)
          break
        case 'transcode':
          processingResult = await transcodeMedia(file, options)
          break
        case 'ocr':
          processingResult = await performOCR(file, options)
          break
        default:
          throw new Error(`Unsupported processing type: ${processingType}`)
      }

      // Update job as completed
      await executeSingle(`
        UPDATE multimedia_processing_jobs 
        SET status = 'completed', completed_at = NOW(), output_files = ?
        WHERE id = ?
      `, [JSON.stringify(processingResult), jobId])

      // Log the processing activity
      await executeSingle(`
        INSERT INTO file_audit_logs (
          organization_id, file_id, employee_id, action, detail
        ) VALUES (?, ?, ?, 'process', ?)
      `, [
        organizationId,
        fileId,
        userId,
        JSON.stringify({
          processingType,
          jobId,
          options,
          result: processingResult
        })
      ])

    } catch (error) {
      // Update job as failed
      await executeSingle(`
        UPDATE multimedia_processing_jobs 
        SET status = 'failed', completed_at = NOW(), error_message = ?, error_code = ?
        WHERE id = ?
      `, [
        error instanceof Error ? error.message : 'Unknown error',
        'PROCESSING_ERROR',
        jobId
      ])

      throw error
    }

    return NextResponse.json({
      success: true,
      jobId,
      processingType,
      result: processingResult,
      message: 'Processing completed successfully'
    })

  } catch (error) {
    console.error('Multimedia processing error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { organizationId } = decoded
    const { searchParams } = new URL(request.url)
    
    const fileId = searchParams.get('fileId')
    const status = searchParams.get('status')
    const processingType = searchParams.get('processingType')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Build query conditions
    let whereConditions = ['mpj.organization_id = ?']
    let queryParams = [organizationId]

    if (fileId) {
      whereConditions.push('mpj.file_id = ?')
      queryParams.push(fileId)
    }

    if (status) {
      whereConditions.push('mpj.status = ?')
      queryParams.push(status)
    }

    if (processingType) {
      whereConditions.push('mpj.processing_type = ?')
      queryParams.push(processingType)
    }

    queryParams.push(limit)

    // Get processing jobs with file information
    const jobs = await executeQuery(`
      SELECT 
        mpj.id,
        mpj.file_id,
        mpj.processing_type,
        mpj.status,
        mpj.priority,
        mpj.retry_count,
        mpj.error_message,
        mpj.error_code,
        mpj.processing_options,
        mpj.output_files,
        mpj.started_at,
        mpj.completed_at,
        mpj.created_at,
        
        -- File information
        f.name as file_name,
        f.mime_type,
        f.size_bytes,
        f.file_type,
        
        -- Processing duration
        CASE 
          WHEN mpj.completed_at IS NOT NULL AND mpj.started_at IS NOT NULL 
          THEN TIMESTAMPDIFF(SECOND, mpj.started_at, mpj.completed_at)
          ELSE NULL 
        END as processing_duration_seconds

      FROM multimedia_processing_jobs mpj
      JOIN files f ON mpj.file_id = f.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY mpj.created_at DESC
      LIMIT ?
    `, queryParams)

    // Format results
    const formattedJobs = jobs.map(job => ({
      id: job.id,
      fileId: job.file_id,
      fileName: job.file_name,
      fileType: job.file_type,
      mimeType: job.mime_type,
      fileSizeBytes: job.size_bytes,
      processingType: job.processing_type,
      status: job.status,
      priority: job.priority,
      retryCount: job.retry_count,
      errorMessage: job.error_message,
      errorCode: job.error_code,
      processingOptions: job.processing_options ? JSON.parse(job.processing_options) : null,
      outputFiles: job.output_files ? JSON.parse(job.output_files) : null,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdAt: job.created_at,
      processingDuration: job.processing_duration_seconds
    }))

    return NextResponse.json({
      success: true,
      jobs: formattedJobs,
      total: formattedJobs.length
    })

  } catch (error) {
    console.error('Get processing jobs error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch processing jobs'
    }, { status: 500 })
  }
}

// Helper functions for different processing types
async function generateThumbnail(file: any, options: any) {
  // Mock implementation - in real app, this would use image processing libraries
  const thumbnailSizes = options.sizes || ['small', 'medium', 'large']
  const results = []

  for (const size of thumbnailSizes) {
    const dimensions = getThumbnailDimensions(size)
    
    // Create thumbnail record
    const thumbnailResult = await executeSingle(`
      INSERT INTO multimedia_thumbnails (
        file_id, thumbnail_type, size_category, width, height, 
        storage_key, format, quality
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      file.id,
      getMediaType(file.mime_type),
      size,
      dimensions.width,
      dimensions.height,
      `thumbnails/${file.id}_${size}.jpg`,
      'JPEG',
      options.quality || 85
    ])

    results.push({
      id: thumbnailResult.insertId,
      size,
      dimensions,
      storageKey: `thumbnails/${file.id}_${size}.jpg`
    })
  }

  return { thumbnails: results }
}

async function generatePreview(file: any, options: any) {
  // Mock implementation for preview generation
  return {
    previewUrl: `previews/${file.id}_preview.jpg`,
    duration: options.duration || 30,
    format: 'JPEG'
  }
}

async function extractMetadata(file: any, options: any) {
  const mediaType = getMediaType(file.mime_type)
  
  switch (mediaType) {
    case 'image':
      return await extractImageMetadata(file)
    case 'video':
      return await extractVideoMetadata(file)
    case 'audio':
      return await extractAudioMetadata(file)
    default:
      return await extractDocumentMetadata(file)
  }
}

async function extractImageMetadata(file: any) {
  // Mock implementation - in real app, use libraries like sharp, exifr
  const metadata = {
    width: 1920,
    height: 1080,
    format: 'JPEG',
    colorSpace: 'RGB',
    hasTransparency: false,
    dpi: { x: 72, y: 72 },
    camera: {
      make: 'Canon',
      model: 'EOS R5',
      lens: 'RF 24-70mm f/2.8L IS USM'
    }
  }

  // Store in image_metadata table
  await executeSingle(`
    INSERT INTO image_metadata (
      file_id, width, height, format, color_space, has_transparency,
      dpi_x, dpi_y, camera_make, camera_model, lens_model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      width = VALUES(width), height = VALUES(height), format = VALUES(format)
  `, [
    file.id, metadata.width, metadata.height, metadata.format,
    metadata.colorSpace, metadata.hasTransparency, metadata.dpi.x, metadata.dpi.y,
    metadata.camera.make, metadata.camera.model, metadata.camera.lens
  ])

  return metadata
}

async function extractVideoMetadata(file: any) {
  // Mock implementation - in real app, use ffprobe or similar
  const metadata = {
    duration: 120.5,
    width: 1920,
    height: 1080,
    frameRate: 30,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    bitrate: 5000000
  }

  // Store in video_metadata table
  await executeSingle(`
    INSERT INTO video_metadata (
      file_id, duration_seconds, width, height, frame_rate,
      video_codec, has_audio, video_bitrate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      duration_seconds = VALUES(duration_seconds), width = VALUES(width)
  `, [
    file.id, metadata.duration, metadata.width, metadata.height,
    metadata.frameRate, metadata.videoCodec, true, metadata.bitrate
  ])

  return metadata
}

async function extractAudioMetadata(file: any) {
  // Mock implementation - in real app, use music-metadata or similar
  const metadata = {
    duration: 245.7,
    bitrate: 320000,
    sampleRate: 44100,
    channels: 2,
    codec: 'MP3',
    title: 'Sample Song',
    artist: 'Sample Artist',
    album: 'Sample Album',
    year: 2024
  }

  // Store in audio_metadata table
  await executeSingle(`
    INSERT INTO audio_metadata (
      file_id, duration_seconds, bitrate, sample_rate, channels,
      codec, title, artist, album, year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      duration_seconds = VALUES(duration_seconds), bitrate = VALUES(bitrate)
  `, [
    file.id, metadata.duration, metadata.bitrate, metadata.sampleRate,
    metadata.channels, metadata.codec, metadata.title, metadata.artist,
    metadata.album, metadata.year
  ])

  return metadata
}

async function extractDocumentMetadata(file: any) {
  // Mock implementation for document metadata
  const metadata = {
    pageCount: 25,
    wordCount: 5000,
    title: 'Sample Document',
    author: 'John Doe',
    createdDate: new Date(),
    isEncrypted: false
  }

  // Store in document_metadata table
  await executeSingle(`
    INSERT INTO document_metadata (
      file_id, document_type, page_count, word_count, title, author,
      created_date, is_encrypted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      page_count = VALUES(page_count), word_count = VALUES(word_count)
  `, [
    file.id, getDocumentType(file.mime_type), metadata.pageCount,
    metadata.wordCount, metadata.title, metadata.author,
    metadata.createdDate, metadata.isEncrypted
  ])

  return metadata
}

async function analyzeContent(file: any, options: any) {
  // Mock content analysis
  return {
    contentType: 'document',
    language: 'en',
    sentiment: 'neutral',
    topics: ['business', 'technology'],
    entities: ['Company Name', 'Product Name']
  }
}

async function transcodeMedia(file: any, options: any) {
  // Mock transcoding
  return {
    outputFormat: options.format || 'mp4',
    quality: options.quality || 'high',
    outputPath: `transcoded/${file.id}_${options.format || 'mp4'}`
  }
}

async function performOCR(file: any, options: any) {
  // Mock OCR processing
  const ocrResult = {
    text: 'Sample extracted text from image',
    confidence: 95.5,
    language: options.language || 'en',
    wordCount: 6
  }

  // Store OCR results
  await executeSingle(`
    INSERT INTO ocr_results (
      file_id, ocr_engine, language, confidence_score, word_count, ocr_text
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      confidence_score = VALUES(confidence_score), ocr_text = VALUES(ocr_text)
  `, [
    file.id, 'tesseract', ocrResult.language, ocrResult.confidence,
    ocrResult.wordCount, ocrResult.text
  ])

  return ocrResult
}

// Helper functions
function getValidProcessingTypes(mimeType: string): string[] {
  const imageTypes = ['thumbnail', 'extract_metadata', 'analyze', 'ocr']
  const videoTypes = ['thumbnail', 'preview', 'extract_metadata', 'transcode', 'analyze']
  const audioTypes = ['thumbnail', 'extract_metadata', 'transcode', 'analyze']
  const documentTypes = ['thumbnail', 'extract_metadata', 'analyze', 'ocr']

  if (mimeType.startsWith('image/')) return imageTypes
  if (mimeType.startsWith('video/')) return videoTypes
  if (mimeType.startsWith('audio/')) return audioTypes
  return documentTypes
}

function getMediaType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document_preview'
}

function getDocumentType(mimeType: string): string {
  const typeMap: { [key: string]: string } = {
    'application/pdf': 'pdf',
    'application/msword': 'docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-excel': 'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt'
  }
  return typeMap[mimeType] || 'other'
}

function getThumbnailDimensions(size: string): { width: number; height: number } {
  const dimensions = {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 }
  }
  return dimensions[size] || dimensions.medium
}

async function checkFilePermission(fileId: number, userId: number, requiredPermission: string): Promise<boolean> {
  const permissions = await executeQuery(`
    SELECT fp.permission, fop.permission as folder_permission
    FROM files f
    LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
    LEFT JOIN folder_permissions fop ON f.folder_id = fop.folder_id AND fop.employee_id = ?
    WHERE f.id = ?
  `, [userId, userId, fileId])

  if (permissions.length === 0) return false

  const filePermission = permissions[0].permission
  const folderPermission = permissions[0].folder_permission

  const hasPermission = filePermission === requiredPermission || 
                       filePermission === 'owner' ||
                       folderPermission === 'admin' ||
                       folderPermission === 'write'

  return hasPermission
}