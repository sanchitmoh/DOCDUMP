import { NextRequest, NextResponse } from 'next/server'
import { getRedisInstance } from '@/lib/cache/redis'
import { executeQuery } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { fileIds } = await request.json()
    const redis = getRedisInstance()
    
    if (!fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json({
        success: false,
        error: 'fileIds array is required'
      }, { status: 400 })
    }

    let queued = 0
    let errors = 0
    const results = []

    for (const fileId of fileIds) {
      try {
        // Get file info
        const files = await executeQuery(`
          SELECT f.id, f.organization_id, f.name, etc.extracted_text
          FROM files f
          LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
          WHERE f.id = ? AND f.is_deleted = 0
        `, [fileId])

        if (files.length === 0) {
          results.push({ fileId, status: 'not_found' })
          errors++
          continue
        }

        const file = files[0]
        
        // Add to search indexing queue
        await redis.addJob('search-indexing', {
          fileId: file.id,
          organizationId: file.organization_id,
          action: 'index'
        }, 2) // Medium priority

        results.push({ 
          fileId, 
          status: 'queued',
          name: file.name,
          hasExtractedText: !!file.extracted_text
        })
        queued++

      } catch (error) {
        console.error(`Error queuing file ${fileId}:`, error)
        results.push({ 
          fileId, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${queued} files for reindexing`,
      results: {
        total: fileIds.length,
        queued,
        errors,
        details: results
      }
    })

  } catch (error) {
    console.error('Reindex files error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Get files that need reindexing (have extracted text but failed indexing)
    const files = await executeQuery(`
      SELECT 
        f.id,
        f.name,
        f.file_type,
        LENGTH(etc.extracted_text) as text_length,
        sis.index_status,
        sis.indexed_at,
        sis.error_message
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      LEFT JOIN search_index_status sis ON f.id = sis.file_id
      WHERE f.is_deleted = 0 
        AND etc.extracted_text IS NOT NULL 
        AND LENGTH(etc.extracted_text) > 100
        AND (sis.index_status IS NULL OR sis.index_status = 'failed')
      ORDER BY f.id DESC
    `)

    return NextResponse.json({
      success: true,
      files_needing_reindex: files,
      count: files.length
    })

  } catch (error) {
    console.error('Get files needing reindex error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}