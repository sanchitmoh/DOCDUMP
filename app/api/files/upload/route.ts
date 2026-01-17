import { NextRequest, NextResponse } from 'next/server'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { createEnhancedTextExtractionService } from '@/lib/services/enhanced-text-extraction'
import { createServerlessExtractionService } from '@/lib/services/serverless-extraction'
import { createSearchService } from '@/lib/search'
import { executeQuery, executeSingle } from '@/lib/database'
import { authenticateRequest, getOrCreateSystemEmployee } from '@/lib/auth'
import * as fs from 'fs/promises'

// Enhanced debug logger
const debug = {
  log: (step: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`📁 [UPLOAD-${step}] ${timestamp} - ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (step: string, message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`❌ [UPLOAD-${step}] ${timestamp} - ${message}`, error)
  },
  success: (step: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`✅ [UPLOAD-${step}] ${timestamp} - ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  timing: (step: string, startTime: number, message: string) => {
    const duration = Date.now() - startTime
    console.log(`⏱️ [UPLOAD-${step}] ${message} (${duration}ms)`)
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

// Helper method to determine extraction method
export async function POST(request: NextRequest) {
  const uploadStartTime = Date.now()
  const uploadId = Math.random().toString(36).substring(7)
  
  debug.log('INIT', `Starting file upload process [ID: ${uploadId}]`)
  
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
    debug.log('AUTH', 'User authenticated', { 
      userId: auth.user.userId, 
      type: auth.user.type, 
      organizationId: auth.user.organizationId 
    })

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

    debug.timing('PARSE', parseStartTime, 'Form data parsed')
    debug.log('PARSE', 'Upload parameters', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      folderId,
      visibility,
      department,
      tagsCount: tags ? tags.split(',').length : 0
    })

    if (!file) {
      debug.error('VALIDATION', 'No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!folderId) {
      debug.error('VALIDATION', 'No folder ID provided')
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
    }

    debug.success('VALIDATION', 'Basic validation passed', {
      fileSize: `${Math.round(file.size / 1024)}KB`,
      mimeType: file.type
    })

    // Verify folder access
    debug.log('FOLDER', 'Verifying folder access')
    const folderCheckStartTime = Date.now()
    
    const folders = await executeQuery(`
      SELECT f.*, fp.permission 
      FROM folders f
      LEFT JOIN folder_permissions fp ON f.id = fp.folder_id AND fp.employee_id = ?
      WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
    `, [userId, folderId, organizationId])

    debug.timing('FOLDER', folderCheckStartTime, 'Folder access check completed')

    if (folders.length === 0) {
      debug.error('FOLDER', 'Folder not found or access denied', { folderId, organizationId })
      return NextResponse.json({ error: 'Folder not found or access denied' }, { status: 403 })
    }

    const folder = folders[0]
    const hasWriteAccess = folder.created_by === userId || 
                          folder.permission === 'write' || 
                          folder.permission === 'admin' ||
                          userType === 'organization'

    if (!hasWriteAccess) {
      debug.error('FOLDER', 'Insufficient permissions', { 
        folderCreatedBy: folder.created_by, 
        userPermission: folder.permission, 
        userType 
      })
      return NextResponse.json({ error: 'Insufficient permissions to upload to this folder' }, { status: 403 })
    }

    debug.success('FOLDER', 'Folder access verified', { 
      folderName: folder.name, 
      permission: folder.permission || 'owner' 
    })

    // Convert file to buffer
    debug.log('BUFFER', 'Converting file to buffer')
    const bufferStartTime = Date.now()
    
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    
    debug.timing('BUFFER', bufferStartTime, 'File buffer created')
    debug.log('BUFFER', 'Buffer details', { 
      bufferSize: fileBuffer.length,
      originalSize: file.size,
      checksum: require('crypto').createHash('sha256').update(fileBuffer).digest('hex').substring(0, 16) + '...'
    })
    
    // Initialize services
    debug.log('SERVICES', 'Initializing services')
    const servicesStartTime = Date.now()
    
    const storageService = createHybridStorageService()
    const textExtractionService = createEnhancedTextExtractionService()
    const serverlessExtractionService = createServerlessExtractionService()
    const searchService = createSearchService()

    debug.timing('SERVICES', servicesStartTime, 'Services initialized')

    // Store file using hybrid storage
    debug.log('STORAGE', 'Starting file storage process')
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
        uploadTimestamp: new Date().toISOString()
      }
    )

    debug.timing('STORAGE', storageStartTime, 'File storage completed')
    debug.success('STORAGE', 'File stored successfully', {
      fileId: storageResult.fileId,
      primaryLocation: storageResult.primaryLocation?.storage_type,
      backupLocation: storageResult.backupLocation?.storage_type,
      checksum: storageResult.checksum?.substring(0, 16) + '...'
    })

    // Update file record with additional metadata
    // Update file metadata with proper user tracking for both admin and employee
    let createdBy: number | null = null
    
    if (userType === 'employee') {
      createdBy = userId // Use employee ID directly
    } else if (userType === 'organization') {
      // For organization admins, create/use system employee record
      try {
        createdBy = await getOrCreateSystemEmployee(organizationId, auth.user.email)
      } catch (error) {
        console.error('Error creating system employee for admin:', error)
        createdBy = null // Fallback to null if system employee creation fails
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

    // Extract text directly using serverless extraction service
    let extractedText = ''
    let extractionMetadata: any = {}
    let extractionJobId: number | null = null
    
    try {
      debug.log('EXTRACTION', `Starting serverless extraction for: ${file.name} (${file.type})`)
      const extractionStartTime = Date.now()
      
      // Use serverless extraction service for immediate processing
      const extractionResult = await serverlessExtractionService.processExtractionImmediate(
        storageResult.fileId,
        organizationId,
        {
          enableAI: !!process.env.OPENAI_API_KEY,
          enableOCR: true,
          enableTextract: true,
          priority: 8
        }
      )
      
      debug.timing('EXTRACTION', extractionStartTime, 'Serverless extraction completed')
      
      if (extractionResult.success) {
        extractedText = extractionResult.textLength > 0 ? 'Text extracted successfully' : ''
        extractionMetadata = {
          method: extractionResult.method,
          wordCount: extractionResult.wordCount,
          characterCount: extractionResult.textLength,
          processingTimeMs: extractionResult.processingTimeMs,
          success: true
        }
        
        debug.success('EXTRACTION', `Extraction successful: ${extractionResult.textLength} chars, ${extractionResult.wordCount} words`, {
          method: extractionResult.method,
          processingTime: extractionResult.processingTimeMs
        })
        
        // Get the actual extracted text from database for search indexing
        const textResult = await executeQuery(`
          SELECT extracted_text FROM extracted_text_content 
          WHERE file_id = ? AND content_type = 'full_text'
          ORDER BY created_at DESC LIMIT 1
        `, [storageResult.fileId])
        
        if (textResult.length > 0) {
          extractedText = textResult[0].extracted_text || ''
        }
        
      } else {
        debug.error('EXTRACTION', 'Extraction failed', extractionResult.error)
        extractionMetadata = {
          method: 'failed',
          error: extractionResult.error,
          processingTimeMs: extractionResult.processingTimeMs,
          success: false
        }
      }
      
    } catch (error) {
      debug.error('EXTRACTION', 'Extraction service error', error)
      extractionMetadata = { 
        error: error instanceof Error ? error.message : 'Unknown error',
        method: 'service-error',
        success: false
      }
    }

    // Index file in Elasticsearch
    try {
      // First, test the connection
      const healthCheck = await searchService.healthCheck()
      console.log('Elasticsearch health check:', healthCheck)
      
      if (healthCheck.status === 'healthy') {
        const indexed = await searchService.indexDocument({
          file_id: storageResult.fileId.toString(),
          organization_id: organizationId.toString(),
          title: file.name,
          content: extractedText, // Use extracted text
          author: userId.toString(),
          department: department || '',
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
          file_type: getFileTypeFromMime(file.type),
          mime_type: file.type,
          size_bytes: fileBuffer.length,
          created_at: new Date(),
          updated_at: new Date(),
          visibility: visibility as any,
          folder_path: folder.name
        })
        
        if (!indexed) {
          console.warn('Document was not indexed in Elasticsearch, but upload will continue')
        } else {
          console.log('Document successfully indexed in Elasticsearch')
        }
      } else {
        console.warn('Elasticsearch is not healthy, skipping indexing:', healthCheck.message)
      }
    } catch (error) {
      console.warn('Failed to index document in Elasticsearch:', error)
    }

    // Log contribution (only if we have a valid user ID)
    if (createdBy) {
      await executeSingle(`
        INSERT INTO contributions (
          user_id, organization_id, file_id, action, details
        ) VALUES (?, ?, ?, 'upload', ?)
      `, [
        createdBy, // Use the same createdBy ID that we used for the file record
        organizationId,
        storageResult.fileId,
        JSON.stringify({
        file_name: file.name,
        file_size: fileBuffer.length,
        mime_type: file.type,
        folder_id: folderId,
        storage_locations: [
          storageResult.primaryLocation.storage_type,
          storageResult.backupLocation?.storage_type
        ].filter(Boolean)
      })
    ])
    } // End of contribution logging if statement

    // Generate AI-powered description and tags if enabled
    if (process.env.OPENAI_API_KEY) {
      debug.log('AI', 'OpenAI API key found, starting AI processing')
      
      try {
        const { createAIService } = await import('@/lib/services/ai-service')
        const aiService = createAIService()
        
        debug.log('AI', 'AI service initialized successfully')
        
        // Get organization and department names for context
        const orgInfoStartTime = Date.now()
        const orgInfo = await executeQuery(`
          SELECT o.name as org_name, d.name as dept_name
          FROM organizations o
          LEFT JOIN departments d ON d.organization_id = o.id AND d.name COLLATE utf8mb4_general_ci = ? COLLATE utf8mb4_general_ci
          WHERE o.id = ?
        `, [department, organizationId])

        const organizationName = orgInfo[0]?.org_name || ''
        const departmentName = orgInfo[0]?.dept_name || department || ''
        
        debug.timing('AI', orgInfoStartTime, 'Organization info retrieved')
        debug.log('AI', 'Context information', { organizationName, departmentName })

        // Enhanced AI processing with better context
        const aiContext = {
          fileName: file.name,
          fileType: getFileTypeFromMime(file.type),
          department: departmentName,
          organization: organizationName,
          fileSize: file.size,
          mimeType: file.type,
          folderPath: folder.name
        }

        // Schedule enhanced AI generation after a delay to allow text extraction
        setTimeout(async () => {
          const aiProcessingStartTime = Date.now()
          debug.log('AI-DELAYED', 'Starting delayed AI processing', { fileId: storageResult.fileId })
          
          try {
            // Get extracted text if available
            const extractedTextResult = await executeQuery(`
              SELECT extracted_text FROM extracted_text_content 
              WHERE file_id = ? AND content_type = 'full_text'
            `, [storageResult.fileId])

            const content = extractedTextResult.length > 0 
              ? extractedTextResult[0].extracted_text 
              : `File: ${file.name}\nType: ${getFileTypeFromMime(file.type)}\nSize: ${Math.round(file.size / 1024)}KB`

            debug.log('AI-DELAYED', 'Content prepared for AI processing', { 
              hasExtractedText: extractedTextResult.length > 0,
              contentLength: content.length 
            })

            // Generate advanced description if not provided
            if (!description) {
              debug.log('AI-DELAYED', 'Generating AI description')
              try {
                const descriptionResult = await aiService.generateContent({
                  type: 'description',
                  content,
                  context: aiContext,
                  options: {
                    maxLength: 300,
                    tone: 'professional',
                    model: 'gpt-3.5-turbo'
                  }
                })

                await executeSingle(`
                  UPDATE files SET ai_description = ? WHERE id = ?
                `, [descriptionResult.result, storageResult.fileId])

                debug.success('AI-DELAYED', 'AI description generated and saved', {
                  length: (descriptionResult.result as string).length,
                  tokensUsed: descriptionResult.tokensUsed
                })
              } catch (descError) {
                debug.error('AI-DELAYED', 'Failed to generate description', descError)
              }
            }

            // Generate smart tags if not provided
            if (!tags) {
              debug.log('AI-DELAYED', 'Generating smart tags')
              try {
                // Get existing tags for context
                const existingTags = await executeQuery(`
                  SELECT DISTINCT tag FROM file_tags ft
                  JOIN files f ON ft.file_id = f.id
                  WHERE f.organization_id = ?
                  ORDER BY tag
                  LIMIT 50
                `, [organizationId])

                const contextWithTags = {
                  ...aiContext,
                  existingTags: existingTags.map(row => row.tag)
                }

                const smartTags = await aiService.generateSmartTags(content, contextWithTags, 8)

                if (smartTags.length > 0) {
                  // Update file tags
                  await executeSingle(`
                    UPDATE files SET tags = ? WHERE id = ?
                  `, [JSON.stringify(smartTags), storageResult.fileId])

                  // Update normalized tags table
                  const tagValues = smartTags.map((tag: string) => [storageResult.fileId, tag])
                  const placeholders = tagValues.map(() => '(?, ?)').join(', ')
                  const flatValues = tagValues.flat()

                  await executeSingle(`
                    INSERT INTO file_tags (file_id, tag) VALUES ${placeholders}
                  `, flatValues)

                  debug.success('AI-DELAYED', 'Smart tags generated and saved', { 
                    tags: smartTags,
                    count: smartTags.length 
                  })
                }
              } catch (tagsError) {
                debug.error('AI-DELAYED', 'Failed to generate smart tags', tagsError)
              }
            }

            // Generate advanced document analysis
            try {
              debug.log('AI-DELAYED', 'Performing document analysis')
              const analysis = await aiService.analyzeDocument(content, aiContext)
              
              // Handle organization admin vs employee user
              let validUserId: number | null = null
              
              if (userId) {
                // Check if this is an organization admin or employee
                const userCheck = await executeQuery<{ id: number }>(`
                  SELECT id FROM organization_employees WHERE id = ? AND organization_id = ?
                `, [userId, organizationId])
                
                if (userCheck && userCheck.length > 0) {
                  // Valid employee ID
                  validUserId = userId
                } else {
                  // Might be organization admin, get or create system employee
                  const { getOrCreateSystemEmployee } = await import('@/lib/auth')
                  try {
                    // Get organization admin email for system employee creation
                    const orgData = await executeQuery<{ admin_email: string }>(`
                      SELECT admin_email FROM organizations WHERE id = ?
                    `, [organizationId])
                    
                    if (orgData && orgData.length > 0) {
                      validUserId = await getOrCreateSystemEmployee(organizationId, orgData[0].admin_email)
                    }
                  } catch (error) {
                    debug.warn('AI-DELAYED', 'Could not create system employee, using NULL for generated_by', error)
                    validUserId = null
                  }
                }
              }
              
              // Store analysis results
              await executeSingle(`
                INSERT INTO ai_generated_content (
                  file_id, organization_id, content_type, content, 
                  generated_by, model_used, created_at
                ) VALUES (?, ?, 'analysis', ?, ?, 'gpt-4-turbo-preview', CURRENT_TIMESTAMP)
              `, [
                storageResult.fileId,
                organizationId,
                JSON.stringify(analysis),
                validUserId
              ])

              debug.success('AI-DELAYED', 'Document analysis completed and saved', {
                quality: analysis.quality,
                classification: analysis.classification,
                sentiment: analysis.sentiment
              })
            } catch (analysisError) {
              debug.error('AI-DELAYED', 'Document analysis failed', analysisError)
            }

            debug.timing('AI-DELAYED', aiProcessingStartTime, 'AI processing completed')
            debug.success('AI-DELAYED', `Enhanced AI processing completed for file ${storageResult.fileId}`)
            
          } catch (aiError) {
            debug.error('AI-DELAYED', 'AI processing failed', aiError)
          }
        }, 5000) // Increased delay to 5 seconds for better text extraction

        // NEW: Enhanced AI Assistant Processing
        if (process.env.ENABLE_AI_ANALYSIS === 'true') {
          setTimeout(async () => {
            debug.log('AI-ENHANCED', 'Starting enhanced AI assistant processing', { fileId: storageResult.fileId })
            
            try {
              // Process file for advanced analytics
              const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai-assistant/process-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileId: storageResult.fileId,
                  fileName: file.name,
                  fileContent: fileBuffer.toString('base64'),
                  userId: createdBy || userId,
                  orgId: organizationId,
                  fileType: getFileTypeFromMime(file.type)
                })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.success) {
                  debug.success('AI-ENHANCED', 'Enhanced AI processing completed', {
                    fileId: storageResult.fileId,
                    summary: result.data.summary?.substring(0, 100) + '...',
                    insightsCount: result.data.insights?.length || 0,
                    questionsCount: result.data.suggestedQuestions?.length || 0,
                    dataType: result.data.analytics?.dataType
                  });
                } else {
                  debug.error('AI-ENHANCED', 'Enhanced AI processing failed', result.error);
                }
              } else {
                debug.error('AI-ENHANCED', 'Enhanced AI processing request failed', response.statusText);
              }
            } catch (enhancedAiError) {
              debug.error('AI-ENHANCED', 'Enhanced AI processing error', enhancedAiError);
            }
          }, 7000); // Process after basic AI processing
        }

      } catch (aiError) {
        debug.error('AI', 'AI service initialization failed', aiError)
      }
    } else {
      debug.log('AI', 'OpenAI API key not found, skipping AI processing')
    }

    // Get complete file information
    debug.log('RESPONSE', 'Preparing response with file information')
    const responseStartTime = Date.now()
    
    const fileInfo = await executeQuery(`
      SELECT 
        f.*,
        fo.name as folder_name,
        u.full_name as uploaded_by_name,
        fsl.storage_type as primary_storage,
        fsl.location_path as primary_location
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN organization_employees u ON f.created_by = u.id
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      WHERE f.id = ?
    `, [storageResult.fileId])

    debug.timing('RESPONSE', responseStartTime, 'File information retrieved')

    if (fileInfo.length === 0) {
      debug.error('RESPONSE', 'Failed to retrieve uploaded file information')
      throw new Error('Failed to retrieve uploaded file information')
    }

    debug.timing('UPLOAD', uploadStartTime, `Complete upload process finished [ID: ${uploadId}]`)
    debug.success('UPLOAD', 'File upload completed successfully', {
      uploadId,
      fileId: storageResult.fileId,
      fileName: file.name,
      fileSize: `${Math.round(file.size / 1024)}KB`,
      totalProcessingTime: `${Date.now() - uploadStartTime}ms`,
      hasAI: !!process.env.OPENAI_API_KEY,
      hasTextExtraction: extractionMetadata.success || false,
      elasticsearchIndexed: true
    })

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      uploadId,
      processingTime: Date.now() - uploadStartTime,
      file: {
        ...fileInfo[0],
        tags: (() => {
          const tagsValue = fileInfo[0].tags;
          if (!tagsValue) return [];
          
          // If it's already an array, return it
          if (Array.isArray(tagsValue)) return tagsValue;
          
          // If it's a string, try to parse as JSON first
          if (typeof tagsValue === 'string') {
            try {
              const parsed = JSON.parse(tagsValue);
              return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
              // If JSON parsing fails, treat as comma-separated string
              return tagsValue.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
            }
          }
          
          // Fallback to empty array
          return [];
        })(),
        storage_locations: {
          primary: storageResult.primaryLocation,
          backup: storageResult.backupLocation
        },
        extraction_info: {
          success: extractedText.length > 0,
          text_length: extractedText.length,
          word_count: extractionMetadata.wordCount || 0,
          method: extractionMetadata.method || 'none',
          processing_time_ms: extractionMetadata.processingTimeMs || 0,
          metadata: extractionMetadata
        },
        checksum: storageResult.checksum,
        upload_metadata: {
          upload_id: uploadId,
          processing_time_ms: Date.now() - uploadStartTime,
          ai_processing_enabled: !!process.env.OPENAI_API_KEY,
          text_extraction_enabled: extractedText.length > 0,
          elasticsearch_indexed: true
        }
      }
    })

  } catch (error) {
    debug.error('UPLOAD', `Upload failed [ID: ${uploadId}]`, error)
    debug.timing('UPLOAD', uploadStartTime, `Failed upload process [ID: ${uploadId}]`)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
      uploadId,
      processingTime: Date.now() - uploadStartTime
    }, { status: 500 })
  }
}