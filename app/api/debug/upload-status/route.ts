import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery } from '@/lib/database'
import { createElasticsearchService } from '@/lib/search/elasticsearch'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { organizationId } = auth.user
    
    // Ensure organizationId is defined
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }

    // Get file information
    const fileInfo = await executeQuery(`
      SELECT 
        f.*,
        fo.name as folder_name,
        u.full_name as creator_name,
        fsl.storage_type as primary_storage,
        fsl.location_path as primary_location,
        fsl2.storage_type as backup_storage,
        fsl2.location_path as backup_location
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN organization_employees u ON f.created_by = u.id
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      LEFT JOIN file_storage_locations fsl2 ON f.id = fsl2.file_id AND fsl2.is_primary = 0
      WHERE f.id = ? AND f.organization_id = ?
    `, [fileId, organizationId])

    if (fileInfo.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileInfo[0]

    // Get text extraction status
    const extractionJobs = await executeQuery(`
      SELECT * FROM text_extraction_jobs 
      WHERE file_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [fileId])

    // Get extracted text content
    const extractedContent = await executeQuery(`
      SELECT content_type, LENGTH(extracted_text) as content_length, created_at
      FROM extracted_text_content 
      WHERE file_id = ?
    `, [fileId])

    // Get AI generated content
    const aiContent = await executeQuery(`
      SELECT content_type, LENGTH(content) as content_length, model_used, created_at
      FROM ai_generated_content 
      WHERE file_id = ?
    `, [fileId])

    // Check Elasticsearch status
    const searchService = createElasticsearchService()
    let elasticsearchStatus = 'unknown'
    let elasticsearchDoc = null

    try {
      const healthCheck = await searchService.healthCheck()
      elasticsearchStatus = healthCheck.status
      
      if (healthCheck.status === 'healthy') {
        // Try to search for the document to check if it exists
        try {
          const searchResult = await searchService.searchDocuments({
            query: `file_id:${fileId}`,
            organizationId: organizationId.toString(),
            pagination: { size: 1, from: 0 }
          })
          
          if (searchResult.results.length > 0) {
            elasticsearchDoc = {
              indexed: true,
              document_found: true,
              search_score: searchResult.results[0].score,
              title: searchResult.results[0].title
            }
          } else {
            elasticsearchDoc = { 
              indexed: false, 
              document_found: false,
              error: 'Document not found in search index' 
            }
          }
        } catch (esError: any) {
          elasticsearchDoc = { 
            error: `Search error: ${esError.message}`, 
            indexed: false 
          }
        }
      }
    } catch (esError) {
      elasticsearchStatus = 'error'
    }

    // Get file access logs
    const accessLogs = await executeQuery(`
      SELECT action, detail, created_at
      FROM file_audit_logs 
      WHERE file_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [fileId])

    // Get file tags
    const fileTags = await executeQuery(`
      SELECT tag, created_at
      FROM file_tags 
      WHERE file_id = ?
    `, [fileId])

    return NextResponse.json({
      success: true,
      file: {
        ...file,
        tags: fileTags.map(t => t.tag)
      },
      processing_status: {
        text_extraction: {
          jobs: extractionJobs,
          content: extractedContent,
          status: extractionJobs.length > 0 ? extractionJobs[0].status : 'not_started'
        },
        ai_processing: {
          content: aiContent,
          enabled: !!process.env.OPENAI_API_KEY,
          status: aiContent.length > 0 ? 'completed' : 'pending'
        },
        elasticsearch: {
          status: elasticsearchStatus,
          document: elasticsearchDoc,
          indexed: !!elasticsearchDoc && !elasticsearchDoc.error
        }
      },
      storage_info: {
        primary: {
          type: file.primary_storage,
          location: file.primary_location
        },
        backup: file.backup_storage ? {
          type: file.backup_storage,
          location: file.backup_location
        } : null
      },
      activity_logs: accessLogs,
      metadata: {
        view_count: file.view_count || 0,
        download_count: file.download_count || 0,
        last_viewed: file.last_viewed_at,
        last_downloaded: file.last_downloaded_at,
        created_at: file.created_at,
        updated_at: file.updated_at
      }
    })

  } catch (error) {
    console.error('Debug status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    }, { status: 500 })
  }
}