import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user

    // Get saved documents with comprehensive metadata
    const savedDocuments = await executeQuery(`
      SELECT 
        f.id,
        f.name as title,
        f.file_type as type,
        f.size_bytes,
        f.mime_type,
        f.created_at as date,
        f.tags,
        f.ai_description,
        f.visibility,
        f.storage_provider,
        si.created_at as savedDate,
        
        -- Creator information
        COALESCE(oe.full_name, o.name) as author,
        
        -- Department information
        d.name as department,
        
        -- Document metadata
        dm.title as document_title,
        dm.author as document_author,
        dm.page_count,
        dm.word_count,
        dm.is_encrypted,
        dm.is_password_protected,
        
        -- Multimedia metadata
        im.width as image_width,
        im.height as image_height,
        im.format as image_format,
        im.color_space,
        im.has_transparency,
        
        vm.duration_seconds as video_duration,
        vm.width as video_width,
        vm.height as video_height,
        vm.resolution_category,
        vm.video_codec,
        vm.has_audio,
        
        am.duration_seconds as audio_duration,
        am.artist,
        am.album,
        am.genre,
        am.bitrate as audio_bitrate,
        am.codec as audio_codec,
        
        -- Thumbnails
        mt.storage_url as thumbnail_url,
        mt.width as thumb_width,
        mt.height as thumb_height,
        
        -- Text extraction
        tej.status as extraction_status,
        etc.word_count as extracted_word_count,
        etc.confidence_score as extraction_confidence,
        
        -- Storage information
        fsl.storage_type as primary_storage,
        fsl.location_path,
        fsl.storage_class,
        
        -- Access statistics
        (SELECT COUNT(*) FROM file_audit_logs WHERE file_id = f.id AND action = 'view') as view_count,
        (SELECT COUNT(*) FROM file_audit_logs WHERE file_id = f.id AND action = 'download') as download_count,
        (SELECT MAX(created_at) FROM file_audit_logs WHERE file_id = f.id) as last_accessed,
        
        -- Search index status
        sis.index_status,
        sis.indexed_at

      FROM saved_items si
      JOIN files f ON si.file_id = f.id
      LEFT JOIN organization_employees oe ON f.created_by = oe.id
      LEFT JOIN organizations o ON f.organization_id = o.id
      LEFT JOIN departments d ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci AND d.organization_id = f.organization_id
      
      -- Metadata tables
      LEFT JOIN document_metadata dm ON f.id = dm.file_id
      LEFT JOIN image_metadata im ON f.id = im.file_id
      LEFT JOIN video_metadata vm ON f.id = vm.file_id
      LEFT JOIN audio_metadata am ON f.id = am.file_id
      
      -- Thumbnails
      LEFT JOIN multimedia_thumbnails mt ON f.id = mt.file_id AND mt.size_category = 'medium'
      
      -- Text extraction
      LEFT JOIN text_extraction_jobs tej ON f.id = tej.file_id AND tej.status = 'completed'
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      
      -- Storage
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      
      -- Search index
      LEFT JOIN search_index_status sis ON f.id = sis.file_id
      
      WHERE si.user_id = ? AND si.organization_id = ? AND f.is_deleted = 0
      ORDER BY si.created_at DESC
    `, [userId, organizationId])

    // Format file sizes and enrich data
    const formattedDocuments = savedDocuments.map(doc => ({
      id: doc.id,
      title: doc.title,
      author: doc.author,
      date: doc.date,
      savedDate: doc.savedDate,
      department: doc.department,
      
      // File properties
      type: doc.type?.toUpperCase() || 'FILE',
      size: formatFileSize(doc.size_bytes),
      sizeBytes: doc.size_bytes,
      mimeType: doc.mime_type,
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      aiDescription: doc.ai_description,
      visibility: doc.visibility,
      storageProvider: doc.storage_provider,
      
      // Document metadata
      documentMetadata: doc.document_title || doc.document_author || doc.page_count ? {
        title: doc.document_title,
        author: doc.document_author,
        pageCount: doc.page_count,
        wordCount: doc.word_count,
        isEncrypted: doc.is_encrypted,
        isPasswordProtected: doc.is_password_protected
      } : null,
      
      // Multimedia metadata
      imageMetadata: doc.image_width ? {
        width: doc.image_width,
        height: doc.image_height,
        format: doc.image_format,
        colorSpace: doc.color_space,
        hasTransparency: doc.has_transparency
      } : null,
      
      videoMetadata: doc.video_duration ? {
        duration: doc.video_duration,
        width: doc.video_width,
        height: doc.video_height,
        resolution: doc.resolution_category,
        codec: doc.video_codec,
        hasAudio: doc.has_audio
      } : null,
      
      audioMetadata: doc.audio_duration ? {
        duration: doc.audio_duration,
        artist: doc.artist,
        album: doc.album,
        genre: doc.genre,
        bitrate: doc.audio_bitrate,
        codec: doc.audio_codec
      } : null,
      
      // Processing and access info
      thumbnailUrl: doc.thumbnail_url,
      thumbnailSize: doc.thumb_width && doc.thumb_height ? {
        width: doc.thumb_width,
        height: doc.thumb_height
      } : null,
      
      extractionStatus: doc.extraction_status,
      extractedWordCount: doc.extracted_word_count,
      extractionConfidence: doc.extraction_confidence,
      
      viewCount: doc.view_count || 0,
      downloadCount: doc.download_count || 0,
      lastAccessed: doc.last_accessed,
      
      indexStatus: doc.index_status,
      indexedAt: doc.indexed_at,
      
      // Storage info
      storageInfo: {
        type: doc.primary_storage,
        path: doc.location_path,
        class: doc.storage_class
      }
    }))

    return NextResponse.json({
      success: true,
      savedDocuments: formattedDocuments
    })

  } catch (error) {
    console.error('Saved documents error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch saved documents'
    }, { status: 500 })
  }
}

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
    const { fileId } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Check if file exists and user has access
    const files = await executeQuery(`
      SELECT f.id, f.name, f.visibility, f.created_by,
             fp.permission as file_permission,
             fop.permission as folder_permission
      FROM files f
      LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
      LEFT JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
      WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
    `, [userId, userId, fileId, organizationId])

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = files[0]
    
    // Check access permissions
    const hasAccess = file.visibility === 'public' || 
                     file.visibility === 'org' ||
                     file.created_by === userId ||
                     file.file_permission === 'read' ||
                     file.file_permission === 'write' ||
                     file.file_permission === 'owner' ||
                     file.folder_permission === 'read' ||
                     file.folder_permission === 'write' ||
                     file.folder_permission === 'admin'

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if already saved
    const existing = await executeQuery(`
      SELECT id FROM saved_items 
      WHERE file_id = ? AND user_id = ? AND organization_id = ?
    `, [fileId, userId, organizationId])

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Document already saved' }, { status: 400 })
    }

    // Save document
    await executeSingle(`
      INSERT INTO saved_items (file_id, user_id, organization_id)
      VALUES (?, ?, ?)
    `, [fileId, userId, organizationId])

    // Log the action
    await executeSingle(`
      INSERT INTO file_audit_logs (
        organization_id, file_id, employee_id, action, detail
      ) VALUES (?, ?, ?, 'save', ?)
    `, [
      organizationId,
      fileId,
      userId,
      JSON.stringify({ fileName: file.name, timestamp: new Date().toISOString() })
    ])

    return NextResponse.json({
      success: true,
      message: 'Document saved successfully'
    })

  } catch (error) {
    console.error('Save document error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save document'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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
    const { fileId } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Get file info for logging
    const files = await executeQuery(`
      SELECT name FROM files WHERE id = ? AND organization_id = ?
    `, [fileId, organizationId])

    // Remove from saved documents
    const result = await executeSingle(`
      DELETE FROM saved_items 
      WHERE file_id = ? AND user_id = ? AND organization_id = ?
    `, [fileId, userId, organizationId])

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Saved document not found' }, { status: 404 })
    }

    // Log the action
    if (files.length > 0) {
      await executeSingle(`
        INSERT INTO file_audit_logs (
          organization_id, file_id, employee_id, action, detail
        ) VALUES (?, ?, ?, 'unsave', ?)
      `, [
        organizationId,
        fileId,
        userId,
        JSON.stringify({ fileName: files[0].name, timestamp: new Date().toISOString() })
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Document removed from saved list'
    })

  } catch (error) {
    console.error('Remove saved document error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove saved document'
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