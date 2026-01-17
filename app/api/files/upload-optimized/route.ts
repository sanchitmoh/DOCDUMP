import { NextRequest, NextResponse } from 'next/server'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { createEnhancedTextExtractionService } from '@/lib/services/enhanced-text-extraction'
import { createSearchService } from '@/lib/search'
import { executeQuery, executeSingle } from '@/lib/database'
import { authenticateRequest, getOrCreateSystemEmployee } from '@/lib/auth'
import { getRedisInstance } from '@/lib/cache/redis'
import { enhanceRedisWithQueue } from '@/lib/cache/enhanced-redis'
import * as fs from 'fs/promises'

// Enhanced debug logger with performance tracking
const debug = {
  log: (step: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`📁 [UPLOAD-OPT-${step}] ${timestamp} - ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (step: string, message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`❌ [UPLOAD-OPT-${step}] ${timestamp} - ${message}`, error)
  },
  success: (step: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`✅ [UPLOAD-OPT-${step}] ${timestamp} - ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  timing: (step: string, startTime: number, message: string) => {
    const duration = Date.now() - startTime
    console.log(`⏱️ [UPLOAD-OPT-${step}] ${message} (${duration}ms)`)
  },
  performance: (step: string, metrics: any) => {
    console.log(`📊 [UPLOAD-OPT-${step}] Performance:`, metrics)
  }
}

// Helper method to determine file type from MIME type
function getFileTypeFromMime(mimeType: string): string {
  const typeMap: { [key: string]: string } = {
    'application/pdf': 'pdf',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
    'application/vnd.ms-powerpoint': 'presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
    'text/plain': 'text',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/bmp': 'image',
    'image/tiff': 'image'
  }

  return typeMap[mimeType] || 'other'
}

// Determine optimal extraction method based on file characteristics
function determineExtractionMethod(file: File): {
  method: string
  priority: number
  useAsync: boolean
  estimatedTime: number
} {
  const fileSize = file.size
  const mimeType = file.type
  const fileName = file.name.toLowerCase()

  // Base priority: 5 (normal), higher numbers = higher priority
  let priority = 5
  let method = 'auto'
  let useAsync = false
  let estimatedTime = 5000 // 5 seconds default

  // Prioritize by file type and size
  if (mimeType === 'application/pdf') {
    if (fileSize > 10 * 1024 * 1024) { // > 10MB
      method = 'textract-async'
      priority = 7 // High priority for large PDFs
      useAsync = true
      estimatedTime = 30000 // 30 seconds
    } else if (fileSize > 1 * 1024 * 1024) { // > 1MB
      method = 'textract-sync'
      priority = 6
      estimatedTime = 10000 // 10 seconds
    } else {
      method = 'pdf-parse'
      priority = 5
      estimatedTime = 3000 // 3 seconds
    }
  } else if (mimeType.includes('image/')) {
    if (fileSize > 5 * 1024 * 1024) { // > 5MB
      method = 'textract-async'
      priority = 8 // Very high priority for large images (likely scanned docs)
      useAsync = true
      estimatedTime = 25000 // 25 seconds
    } else {
      method = 'textract-sync'
      priority = 7
      estimatedTime = 15000 // 15 seconds
    }
  } else if (mimeType.includes('word') || mimeType.includes('document')) {
    method = 'mammoth'
    priority = 4 // Lower priority, usually fast
    estimatedTime = 2000 // 2 seconds
  } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    method = 'xlsx'
    priority = 4
    estimatedTime = 3000 // 3 seconds
  } else if (mimeType === 'text/plain') {
    method = 'text'
    priority = 3 // Lowest priority, very fast
    estimatedTime = 1000 // 1 second
  }

  // Boost priority for urgent file types
  if (fileName.includes('urgent') || fileName.includes('priority') || fileName.includes('asap')) {
    priority = Math.min(priority + 2, 10) // Max priority is 10
  }

  // Reduce priority for backup/archive files
  if (fileName.includes('backup') || fileName.includes('archive') || fileName.includes('old')) {
    priority = Math.max(priority - 1, 1) // Min priority is 1
  }

  return { method, priority, useAsync, estimatedTime }
}

export async function POST(request: NextRequest) {
  const uploadStartTime = Date.now()
  const uploadId = Math.random().toString(36).substring(7)
  
  debug.log('INIT', `Starting optimized file upload process [ID: ${uploadId}]`)
  
  try {
    // Verify authentication
    debug.log('AUTH', 'Verifying authentication')
    const authStartTime = Date.now()
    
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      debug.error('AUTH', 'Authentication failed', { error: auth.error })
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    debug.timing('AUTH', authStartTime, 'Authentication verified')
    const { userId, type: userType, organizationId } = auth.user

    // Parse form data
    debug.log('PARSE', 'Parsing form data')
    const parseStartTime = Date.now()
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const folderId = formData.get('folderId') as string
    const description = formData.get('description') as string
    const tags = formData.get('tags') as string
    const visibility = formData.get('visibility') as string || 'private'
    const department = formData.get('department') as string
    const forceSync = formData.get('forceSync') === 'true' // Force synchronous processing

    debug.timing('PARSE', parseStartTime, 'Form data parsed')

    if (!file || !folderId) {
      debug.error('VALIDATION', 'Missing required fields')
      return NextResponse.json({ error: 'File and folder ID are required' }, { status: 400 })
    }

    // Determine extraction strategy
    const extractionStrategy = determineExtractionMethod(file)
    debug.log('STRATEGY', 'Extraction strategy determined', extractionStrategy)

    // Verify folder access (optimized query)
    debug.log('FOLDER', 'Verifying folder access')
    const folderCheckStartTime = Date.now()
    
    const folders = await executeQuery(`
      SELECT f.id, f.name, f.created_by, fp.permission 
      FROM folders f
      LEFT JOIN folder_permissions fp ON f.id = fp.folder_id AND fp.employee_id = ?
      WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
      LIMIT 1
    `, [userId, folderId, organizationId])

    debug.timing('FOLDER', folderCheckStartTime, 'Folder access check completed')

    if (folders.length === 0) {
      debug.error('FOLDER', 'Folder not found or access denied')
      return NextResponse.json({ error: 'Folder not found or access denied' }, { status: 403 })
    }

    const folder = folders[0]
    const hasWriteAccess = folder.created_by === userId || 
                          folder.permission === 'write' || 
                          folder.permission === 'admin' ||
                          userType === 'organization'

    if (!hasWriteAccess) {
      debug.error('FOLDER', 'Insufficient permissions')
      return NextResponse.json({ error: 'Insufficient permissions to upload to this folder' }, { status: 403 })
    }

    // Convert file to buffer
    debug.log('BUFFER', 'Converting file to buffer')
    const bufferStartTime = Date.now()
    
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    
    debug.timing('BUFFER', bufferStartTime, 'File buffer created')
    
    // Initialize services
    debug.log('SERVICES', 'Initializing services')
    const servicesStartTime = Date.now()
    
    const storageService = createHybridStorageService()
    const textExtractionService = createEnhancedTextExtractionService()
    const searchService = createSearchService()
    const redis = enhanceRedisWithQueue(getRedisInstance())

    debug.timing('SERVICES', servicesStartTime, 'Services initialized')

    // Store file using hybrid storage
    debug.log('STORAGE', 'Starting optimized file storage')
    const storageStartTime = Date.now()
    
    const storageResult = await storageService.storeFile(
      organizationId,
      fileBuffer,
      file.name,
      file.type,
      folderId,
      {
        uploadedBy: userId,
        userType,
        originalName: file.name,
        uploadTimestamp: new Date().toISOString(),
        extractionStrategy
      }
    )

    debug.timing('STORAGE', storageStartTime, 'File storage completed')

    // Update file record with metadata and extraction info
    let createdBy: number | null = null
    
    if (userType === 'employee') {
      createdBy = userId
    } else if (userType === 'organization') {
      try {
        createdBy = await getOrCreateSystemEmployee(organizationId, auth.user.email)
      } catch (error) {
        console.error('Error creating system employee for admin:', error)
        createdBy = null
      }
    }
    
    await executeSingle(`
      UPDATE files SET 
        description = ?,
        tags = ?,
        department = ?,
        created_by = ?,
        visibility = ?,
        file_type = ?,
        storage_config_id = (
          SELECT id FROM storage_configurations 
          WHERE organization_id = ? AND is_active = 1 
          LIMIT 1
        )
      WHERE id = ?
    `, [
      description || null,
      tags ? JSON.stringify(tags.split(',').map(t => t.trim())) : null,
      department || null,
      createdBy,
      visibility,
      getFileTypeFromMime(file.type),
      organizationId,
      storageResult.fileId
    ])

    // Create extraction job in database
    debug.log('EXTRACTION', 'Creating extraction job')
    const extractionStartTime = Date.now()
    
    const extractionJobResult = await executeSingle(`
      INSERT INTO text_extraction_jobs (
        file_id, organization_id, extraction_method, priority, status,
        estimated_duration_ms, created_by, metadata
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [
      storageResult.fileId,
      organizationId,
      extractionStrategy.method,
      extractionStrategy.priority,
      extractionStrategy.estimatedTime,
      createdBy,
      JSON.stringify({
        uploadId,
        fileSize: file.size,
        mimeType: file.type,
        useAsync: extractionStrategy.useAsync,
        forceSync
      })
    ])

    const extractionJobId = extractionJobResult.insertId
    debug.timing('EXTRACTION', extractionStartTime, 'Extraction job created')

    // Handle extraction based on strategy
    let extractionResult: any = null
    let processingMode = 'background'

    if (forceSync || (!extractionStrategy.useAsync && file.size < 1024 * 1024)) {
      // Synchronous processing for small files or when forced
      debug.log('SYNC-EXTRACT', 'Starting synchronous extraction')
      processingMode = 'synchronous'
      
      try {
        // Update job status
        await executeSingle(`
          UPDATE text_extraction_jobs 
          SET status = 'processing', started_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [extractionJobId])

        // Process extraction immediately
        if (storageResult.primaryLocation.storage_type === 's3') {
          // Create temporary file for extraction
          const tempDir = '/tmp'
          const tempFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          const tempFilePath = `${tempDir}/${tempFileName}`
          
          try {
            await fs.mkdir(tempDir, { recursive: true })
            await fs.writeFile(tempFilePath, fileBuffer)
            
            extractionResult = await textExtractionService.extractText(
              tempFilePath,
              file.type,
              file.size
            )
            
            await fs.unlink(tempFilePath)
          } catch (tempError) {
            console.error('Temp file processing failed:', tempError)
            extractionResult = {
              text: '',
              metadata: { error: tempError.message },
              success: false
            }
          }
        } else {
          // Use local file path
          extractionResult = await textExtractionService.extractText(
            storageResult.primaryLocation.location_path,
            file.type,
            file.size
          )
        }

        // Store extraction results
        if (extractionResult.success) {
          await executeSingle(`
            INSERT INTO extracted_text_content (
              file_id, extraction_job_id, content_type, extracted_text, 
              word_count, character_count, extraction_metadata
            ) VALUES (?, ?, 'full_text', ?, ?, ?, ?)
          `, [
            storageResult.fileId,
            extractionJobId,
            extractionResult.text,
            extractionResult.metadata.wordCount || 0,
            extractionResult.metadata.characterCount || extractionResult.text.length,
            JSON.stringify(extractionResult.metadata)
          ])

          // Update job status
          await executeSingle(`
            UPDATE text_extraction_jobs 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [extractionJobId])

          // Schedule immediate search indexing
          await redis.addJob('search-indexing', {
            fileId: storageResult.fileId,
            organizationId,
            action: 'index'
          }, 8) // High priority for immediate indexing

          debug.success('SYNC-EXTRACT', 'Synchronous extraction completed', {
            textLength: extractionResult.text.length,
            wordCount: extractionResult.metadata.wordCount
          })
        } else {
          // Mark job as failed
          await executeSingle(`
            UPDATE text_extraction_jobs 
            SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [extractionResult.error || 'Extraction failed', extractionJobId])
        }

      } catch (syncError) {
        debug.error('SYNC-EXTRACT', 'Synchronous extraction failed', syncError)
        
        // Mark job as failed and fall back to background processing
        await executeSingle(`
          UPDATE text_extraction_jobs 
          SET status = 'pending', error_message = NULL, started_at = NULL
          WHERE id = ?
        `, [extractionJobId])
        
        processingMode = 'background-fallback'
      }
    }

    // Queue background job if not processed synchronously or if sync failed
    if (processingMode !== 'synchronous' || !extractionResult?.success) {
      debug.log('BACKGROUND', 'Queuing background extraction job')
      
      try {
        await redis.addJob('unified-extraction', {
          jobId: extractionJobId,
          fileId: storageResult.fileId,
          organizationId,
          extractionMethod: extractionStrategy.method,
          uploadId,
          priority: extractionStrategy.priority
        }, extractionStrategy.priority)

        debug.success('BACKGROUND', 'Background job queued successfully', {
          jobId: extractionJobId,
          priority: extractionStrategy.priority,
          estimatedTime: extractionStrategy.estimatedTime
        })
      } catch (queueError) {
        debug.error('BACKGROUND', 'Failed to queue background job', queueError)
      }
    }

    // Schedule AI processing if enabled
    if (process.env.OPENAI_API_KEY && createdBy) {
      debug.log('AI', 'Scheduling AI processing')
      
      try {
        await redis.addJob('ai-processing', {
          fileId: storageResult.fileId,
          organizationId,
          userId: createdBy,
          uploadId,
          context: {
            fileName: file.name,
            fileType: getFileTypeFromMime(file.type),
            department: department || '',
            folderName: folder.name
          }
        }, 3) // Lower priority for AI processing

        debug.success('AI', 'AI processing job queued')
      } catch (aiQueueError) {
        debug.error('AI', 'Failed to queue AI processing', aiQueueError)
      }
    }

    // Log contribution
    if (createdBy) {
      await executeSingle(`
        INSERT INTO contributions (
          user_id, organization_id, file_id, action, details
        ) VALUES (?, ?, ?, 'upload', ?)
      `, [
        createdBy,
        organizationId,
        storageResult.fileId,
        JSON.stringify({
          file_name: file.name,
          file_size: fileBuffer.length,
          mime_type: file.type,
          folder_id: folderId,
          upload_id: uploadId,
          processing_mode: processingMode,
          extraction_strategy: extractionStrategy
        })
      ])
    }

    // Get complete file information for response
    debug.log('RESPONSE', 'Preparing optimized response')
    const responseStartTime = Date.now()
    
    const fileInfo = await executeQuery(`
      SELECT 
        f.*,
        fo.name as folder_name,
        u.full_name as uploaded_by_name,
        fsl.storage_type as primary_storage,
        tej.status as extraction_status,
        tej.priority as extraction_priority,
        tej.estimated_duration_ms
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN organization_employees u ON f.created_by = u.id
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      LEFT JOIN text_extraction_jobs tej ON f.id = tej.file_id AND tej.id = ?
      WHERE f.id = ?
    `, [extractionJobId, storageResult.fileId])

    debug.timing('RESPONSE', responseStartTime, 'Response prepared')

    // Performance metrics
    const totalProcessingTime = Date.now() - uploadStartTime
    debug.performance('COMPLETE', {
      uploadId,
      totalTime: totalProcessingTime,
      processingMode,
      extractionPriority: extractionStrategy.priority,
      estimatedExtractionTime: extractionStrategy.estimatedTime,
      fileSize: file.size,
      hasImmediateText: !!extractionResult?.success
    })

    debug.timing('UPLOAD', uploadStartTime, `Optimized upload process completed [ID: ${uploadId}]`)

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully with optimized processing',
      uploadId,
      processingTime: totalProcessingTime,
      processingMode,
      extractionJob: {
        id: extractionJobId,
        status: fileInfo[0]?.extraction_status || 'pending',
        priority: extractionStrategy.priority,
        estimatedTime: extractionStrategy.estimatedTime,
        method: extractionStrategy.method
      },
      file: {
        ...fileInfo[0],
        tags: (() => {
          const tagsValue = fileInfo[0]?.tags
          if (!tagsValue) return []
          
          if (Array.isArray(tagsValue)) return tagsValue
          
          if (typeof tagsValue === 'string') {
            try {
              const parsed = JSON.parse(tagsValue)
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return tagsValue.split(',').map(t => t.trim()).filter(Boolean)
            }
          }
          
          return []
        })(),
        storage_locations: {
          primary: storageResult.primaryLocation,
          backup: storageResult.backupLocation
        },
        extraction_info: {
          jobId: extractionJobId,
          status: fileInfo[0]?.extraction_status || 'pending',
          priority: extractionStrategy.priority,
          method: extractionStrategy.method,
          estimatedTime: extractionStrategy.estimatedTime,
          processingMode,
          immediateResult: extractionResult ? {
            success: extractionResult.success,
            textLength: extractionResult.text?.length || 0,
            wordCount: extractionResult.metadata?.wordCount || 0
          } : null
        },
        checksum: storageResult.checksum,
        upload_metadata: {
          upload_id: uploadId,
          processing_time_ms: totalProcessingTime,
          optimization_enabled: true,
          ai_processing_queued: !!process.env.OPENAI_API_KEY,
          background_processing_queued: processingMode !== 'synchronous'
        }
      }
    })

  } catch (error) {
    debug.error('UPLOAD', `Optimized upload failed [ID: ${uploadId}]`, error)
    debug.timing('UPLOAD', uploadStartTime, `Failed optimized upload [ID: ${uploadId}]`)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
      uploadId,
      processingTime: Date.now() - uploadStartTime
    }, { status: 500 })
  }
}