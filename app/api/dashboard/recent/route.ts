import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user

    // Get recently accessed files with comprehensive metadata
    const recentlyViewed = await executeQuery(`
      SELECT DISTINCT
        f.id,
        f.name as title,
        f.created_at as date,
        f.size_bytes,
        f.mime_type,
        f.file_type,
        f.tags,
        f.ai_description,
        f.visibility,
        f.storage_provider,
        
        -- Creator information
        COALESCE(oe.full_name, o.name) as author,
        
        -- Department information
        d.name as department,
        
        -- File metadata
        dm.title as document_title,
        dm.author as document_author,
        dm.page_count,
        dm.word_count,
        
        -- Multimedia metadata
        im.width as image_width,
        im.height as image_height,
        im.format as image_format,
        vm.duration_seconds as video_duration,
        vm.resolution_category as video_resolution,
        am.duration_seconds as audio_duration,
        am.artist as audio_artist,
        am.album as audio_album,
        
        -- Access information
        fal.created_at as last_accessed,
        fal.action as last_action,
        
        -- Thumbnails
        mt.storage_url as thumbnail_url,
        
        -- Text extraction status
        tej.status as extraction_status,
        etc.word_count as extracted_word_count,
        
        -- Storage locations
        fsl.storage_type as primary_storage_type,
        fsl.location_path as storage_path,
        
        -- Search index status
        sis.index_status,
        sis.indexed_at

      FROM file_audit_logs fal
      JOIN files f ON fal.file_id = f.id
      LEFT JOIN organization_employees oe ON f.created_by = oe.id
      LEFT JOIN organizations o ON f.organization_id = o.id
      LEFT JOIN departments d ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci AND d.organization_id = f.organization_id
      
      -- Document metadata
      LEFT JOIN document_metadata dm ON f.id = dm.file_id
      
      -- Multimedia metadata
      LEFT JOIN image_metadata im ON f.id = im.file_id
      LEFT JOIN video_metadata vm ON f.id = vm.file_id
      LEFT JOIN audio_metadata am ON f.id = am.file_id
      
      -- Thumbnails
      LEFT JOIN multimedia_thumbnails mt ON f.id = mt.file_id AND mt.size_category = 'medium'
      
      -- Text extraction
      LEFT JOIN text_extraction_jobs tej ON f.id = tej.file_id AND tej.status IN ('completed', 'processing')
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      
      -- Storage locations
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      
      -- Search index status
      LEFT JOIN search_index_status sis ON f.id = sis.file_id
      
      WHERE fal.employee_id = ? 
        AND f.organization_id = ? 
        AND fal.action IN ('view', 'download', 'preview')
        AND f.is_deleted = 0
        AND f.is_active = 1
      ORDER BY fal.created_at DESC
      LIMIT 20
    `, [userId, organizationId])

    // Format the results with rich metadata
    const formattedResults = recentlyViewed.map(doc => ({
      id: doc.id,
      title: doc.title,
      author: doc.author,
      date: doc.date,
      lastAccessed: doc.last_accessed,
      lastAction: doc.last_action,
      department: doc.department,
      
      // File properties
      sizeBytes: doc.size_bytes,
      mimeType: doc.mime_type,
      fileType: doc.file_type,
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      aiDescription: doc.ai_description,
      visibility: doc.visibility,
      storageProvider: doc.storage_provider,
      
      // Document metadata
      documentMetadata: doc.document_title || doc.document_author || doc.page_count || doc.word_count ? {
        title: doc.document_title,
        author: doc.document_author,
        pageCount: doc.page_count,
        wordCount: doc.word_count
      } : null,
      
      // Multimedia metadata
      imageMetadata: doc.image_width || doc.image_height ? {
        width: doc.image_width,
        height: doc.image_height,
        format: doc.image_format
      } : null,
      
      videoMetadata: doc.video_duration ? {
        duration: doc.video_duration,
        resolution: doc.video_resolution
      } : null,
      
      audioMetadata: doc.audio_duration ? {
        duration: doc.audio_duration,
        artist: doc.audio_artist,
        album: doc.audio_album
      } : null,
      
      // Processing status
      thumbnailUrl: doc.thumbnail_url,
      extractionStatus: doc.extraction_status,
      extractedWordCount: doc.extracted_word_count,
      indexStatus: doc.index_status,
      indexedAt: doc.indexed_at,
      
      // Storage information
      storageInfo: {
        type: doc.primary_storage_type,
        path: doc.storage_path
      }
    }))

    return NextResponse.json({
      success: true,
      recentlyViewed: formattedResults
    })

  } catch (error) {
    console.error('Recent documents error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recent documents'
    }, { status: 500 })
  }
}