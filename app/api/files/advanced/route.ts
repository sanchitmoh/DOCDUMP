import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

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

    const { userId, organizationId, userType } = decoded
    const { searchParams } = new URL(request.url)
    
    // Advanced filtering parameters
    const search = searchParams.get('search') || ''
    const fileType = searchParams.get('fileType') || ''
    const department = searchParams.get('department') || ''
    const storageType = searchParams.get('storageType') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const minSize = searchParams.get('minSize') || ''
    const maxSize = searchParams.get('maxSize') || ''
    const hasExtraction = searchParams.get('hasExtraction') || ''
    const isIndexed = searchParams.get('isIndexed') || ''
    const visibility = searchParams.get('visibility') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'DESC'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    // Build dynamic WHERE clause
    let whereConditions = ['f.organization_id = ?', 'f.is_deleted = 0']
    let queryParams = [organizationId]

    // Access control based on user type
    if (userType !== 'organization') {
      whereConditions.push(`(
        f.visibility = 'public' OR 
        f.visibility = 'org' OR 
        f.created_by = ? OR
        fp.permission IS NOT NULL OR
        fop.permission IS NOT NULL
      )`)
      queryParams.push(userId)
    }

    // Search filters
    if (search) {
      whereConditions.push(`(
        f.name LIKE ? OR 
        f.ai_description LIKE ? OR 
        dm.title LIKE ? OR 
        dm.author LIKE ? OR
        etc.extracted_text LIKE ? OR
        JSON_SEARCH(f.tags, 'one', ?) IS NOT NULL
      )`)
      const searchTerm = `%${search}%`
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, search)
    }

    if (fileType) {
      whereConditions.push('f.file_type = ?')
      queryParams.push(fileType)
    }

    if (department) {
      whereConditions.push('f.department = ?')
      queryParams.push(department)
    }

    if (storageType) {
      whereConditions.push('f.storage_provider = ?')
      queryParams.push(storageType)
    }

    if (dateFrom) {
      whereConditions.push('f.created_at >= ?')
      queryParams.push(dateFrom)
    }

    if (dateTo) {
      whereConditions.push('f.created_at <= ?')
      queryParams.push(dateTo)
    }

    if (minSize) {
      whereConditions.push('f.size_bytes >= ?')
      queryParams.push(parseInt(minSize))
    }

    if (maxSize) {
      whereConditions.push('f.size_bytes <= ?')
      queryParams.push(parseInt(maxSize))
    }

    if (hasExtraction === 'true') {
      whereConditions.push('tej.status = "completed"')
    } else if (hasExtraction === 'false') {
      whereConditions.push('tej.id IS NULL')
    }

    if (isIndexed === 'true') {
      whereConditions.push('sis.index_status = "indexed"')
    } else if (isIndexed === 'false') {
      whereConditions.push('(sis.index_status IS NULL OR sis.index_status != "indexed")')
    }

    if (visibility) {
      whereConditions.push('f.visibility = ?')
      queryParams.push(visibility)
    }

    // Build ORDER BY clause
    const allowedSortFields = {
      'created_at': 'f.created_at',
      'name': 'f.name',
      'size': 'f.size_bytes',
      'type': 'f.file_type',
      'department': 'f.department',
      'views': 'view_count',
      'downloads': 'download_count'
    }

    const sortField = allowedSortFields[sortBy] || 'f.created_at'
    const orderBy = `${sortField} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`

    // Main query with comprehensive joins
    const filesQuery = `
      SELECT 
        f.id,
        f.name,
        f.file_type,
        f.mime_type,
        f.size_bytes,
        f.created_at,
        f.updated_at,
        f.tags,
        f.ai_description,
        f.visibility,
        f.storage_provider,
        f.storage_mode,
        f.checksum_sha256,
        
        -- Creator information
        COALESCE(oe.full_name, o.name) as author,
        oe.email as author_email,
        
        -- Department information
        d.name as department,
        d.description as department_description,
        
        -- Folder information
        fo.name as folder_name,
        fo.description as folder_description,
        
        -- Document metadata
        dm.title as document_title,
        dm.author as document_author,
        dm.page_count,
        dm.word_count,
        dm.is_encrypted,
        dm.is_password_protected,
        dm.pdf_version,
        
        -- Image metadata
        im.width as image_width,
        im.height as image_height,
        im.format as image_format,
        im.color_space,
        im.has_transparency,
        im.camera_make,
        im.camera_model,
        im.date_taken,
        
        -- Video metadata
        vm.duration_seconds as video_duration,
        vm.width as video_width,
        vm.height as video_height,
        vm.resolution_category,
        vm.video_codec,
        vm.has_audio,
        vm.has_subtitles,
        
        -- Audio metadata
        am.duration_seconds as audio_duration,
        am.artist,
        am.album,
        am.genre,
        am.year,
        am.bitrate as audio_bitrate,
        am.codec as audio_codec,
        
        -- Thumbnails
        mt.storage_url as thumbnail_url,
        mt.width as thumb_width,
        mt.height as thumb_height,
        
        -- Text extraction
        tej.status as extraction_status,
        tej.extraction_method,
        etc.word_count as extracted_word_count,
        etc.confidence_score as extraction_confidence,
        
        -- OCR results
        ocr.confidence_score as ocr_confidence,
        ocr.language as ocr_language,
        ocr.word_count as ocr_word_count,
        
        -- Storage locations
        fsl.storage_type as primary_storage,
        fsl.location_path,
        fsl.storage_class,
        fsl.checksum_sha256 as storage_checksum,
        
        -- Access statistics
        (SELECT COUNT(*) FROM file_audit_logs WHERE file_id = f.id AND action = 'view') as view_count,
        (SELECT COUNT(*) FROM file_audit_logs WHERE file_id = f.id AND action = 'download') as download_count,
        (SELECT MAX(created_at) FROM file_audit_logs WHERE file_id = f.id) as last_accessed,
        
        -- Search index status
        sis.index_status,
        sis.indexed_at,
        sis.document_id as elasticsearch_id,
        
        -- Permissions
        fp.permission as file_permission,
        fop.permission as folder_permission,
        
        -- Saved status for current user
        (SELECT COUNT(*) FROM saved_items WHERE file_id = f.id AND user_id = ?) as is_saved,
        
        -- File versions count
        (SELECT COUNT(*) FROM file_versions WHERE file_id = f.id) as version_count,
        
        -- Processing jobs status
        (SELECT COUNT(*) FROM multimedia_processing_jobs WHERE file_id = f.id AND status = 'pending') as pending_jobs

      FROM files f
      LEFT JOIN organization_employees oe ON f.created_by = oe.id
      LEFT JOIN organizations o ON f.organization_id = o.id
      LEFT JOIN departments d ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci AND d.organization_id = f.organization_id
      LEFT JOIN folders fo ON f.folder_id = fo.id
      
      -- Metadata tables
      LEFT JOIN document_metadata dm ON f.id = dm.file_id
      LEFT JOIN image_metadata im ON f.id = im.file_id
      LEFT JOIN video_metadata vm ON f.id = vm.file_id
      LEFT JOIN audio_metadata am ON f.id = am.file_id
      
      -- Processing tables
      LEFT JOIN multimedia_thumbnails mt ON f.id = mt.file_id AND mt.size_category = 'medium'
      LEFT JOIN text_extraction_jobs tej ON f.id = tej.file_id AND tej.status = 'completed'
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      LEFT JOIN ocr_results ocr ON f.id = ocr.file_id
      
      -- Storage tables
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      
      -- Search index
      LEFT JOIN search_index_status sis ON f.id = sis.file_id
      
      -- Permissions
      LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
      LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
      
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `

    // Add user ID for saved status and permissions, then pagination params
    const finalParams = [...queryParams, userId, userId, userId, limit, offset]

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT f.id) as total
      FROM files f
      LEFT JOIN organization_employees oe ON f.created_by = oe.id
      LEFT JOIN organizations o ON f.organization_id = o.id
      LEFT JOIN departments d ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci AND d.organization_id = f.organization_id
      LEFT JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN document_metadata dm ON f.id = dm.file_id
      LEFT JOIN text_extraction_jobs tej ON f.id = tej.file_id AND tej.status = 'completed'
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      LEFT JOIN search_index_status sis ON f.id = sis.file_id
      LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
      LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
      WHERE ${whereConditions.join(' AND ')}
    `

    const countParams = [...queryParams, userId, userId]

    // Execute queries
    const [files, countResult] = await Promise.all([
      executeQuery(filesQuery, finalParams),
      executeQuery(countQuery, countParams)
    ])

    const total = countResult[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    // Format results with rich metadata
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      fileType: file.file_type,
      mimeType: file.mime_type,
      size: formatFileSize(file.size_bytes),
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      tags: file.tags ? JSON.parse(file.tags) : [],
      aiDescription: file.ai_description,
      visibility: file.visibility,
      storageProvider: file.storage_provider,
      storageMode: file.storage_mode,
      checksum: file.checksum_sha256,
      
      // Creator and organization info
      author: file.author,
      authorEmail: file.author_email,
      department: file.department,
      departmentDescription: file.department_description,
      
      // Folder info
      folder: {
        name: file.folder_name,
        description: file.folder_description
      },
      
      // Document metadata
      documentMetadata: file.document_title || file.document_author || file.page_count ? {
        title: file.document_title,
        author: file.document_author,
        pageCount: file.page_count,
        wordCount: file.word_count,
        isEncrypted: file.is_encrypted,
        isPasswordProtected: file.is_password_protected,
        pdfVersion: file.pdf_version
      } : null,
      
      // Image metadata
      imageMetadata: file.image_width ? {
        width: file.image_width,
        height: file.image_height,
        format: file.image_format,
        colorSpace: file.color_space,
        hasTransparency: file.has_transparency,
        camera: file.camera_make || file.camera_model ? {
          make: file.camera_make,
          model: file.camera_model
        } : null,
        dateTaken: file.date_taken
      } : null,
      
      // Video metadata
      videoMetadata: file.video_duration ? {
        duration: file.video_duration,
        width: file.video_width,
        height: file.video_height,
        resolution: file.resolution_category,
        codec: file.video_codec,
        hasAudio: file.has_audio,
        hasSubtitles: file.has_subtitles
      } : null,
      
      // Audio metadata
      audioMetadata: file.audio_duration ? {
        duration: file.audio_duration,
        artist: file.artist,
        album: file.album,
        genre: file.genre,
        year: file.year,
        bitrate: file.audio_bitrate,
        codec: file.audio_codec
      } : null,
      
      // Processing info
      thumbnailUrl: file.thumbnail_url,
      thumbnailSize: file.thumb_width && file.thumb_height ? {
        width: file.thumb_width,
        height: file.thumb_height
      } : null,
      
      // Text extraction
      extraction: {
        status: file.extraction_status,
        method: file.extraction_method,
        wordCount: file.extracted_word_count,
        confidence: file.extraction_confidence
      },
      
      // OCR results
      ocr: file.ocr_confidence ? {
        confidence: file.ocr_confidence,
        language: file.ocr_language,
        wordCount: file.ocr_word_count
      } : null,
      
      // Storage info
      storage: {
        type: file.primary_storage,
        path: file.location_path,
        class: file.storage_class,
        checksum: file.storage_checksum
      },
      
      // Access and usage stats
      stats: {
        viewCount: file.view_count || 0,
        downloadCount: file.download_count || 0,
        lastAccessed: file.last_accessed,
        versionCount: file.version_count || 0,
        pendingJobs: file.pending_jobs || 0
      },
      
      // Search and indexing
      searchIndex: {
        status: file.index_status,
        indexedAt: file.indexed_at,
        elasticsearchId: file.elasticsearch_id
      },
      
      // User-specific info
      permissions: {
        file: file.file_permission,
        folder: file.folder_permission
      },
      isSaved: file.is_saved > 0
    }))

    return NextResponse.json({
      success: true,
      files: formattedFiles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        search,
        fileType,
        department,
        storageType,
        dateFrom,
        dateTo,
        minSize,
        maxSize,
        hasExtraction,
        isIndexed,
        visibility
      },
      sorting: {
        sortBy,
        sortOrder
      }
    })

  } catch (error) {
    console.error('Advanced files query error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch files'
    }, { status: 500 })
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}