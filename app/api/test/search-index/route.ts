import { NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'
import { executeQuery } from '@/lib/database'

export async function GET() {
  try {
    const searchService = createSearchService()
    
    // Test 1: Health check
    const health = await searchService.healthCheck()
    
    // Test 2: Get a recent file from database
    const files = await executeQuery<any>(
      `SELECT f.*, o.name as org_name
       FROM files f
       LEFT JOIN organizations o ON f.organization_id = o.id
       WHERE f.is_deleted = 0
       ORDER BY f.created_at DESC
       LIMIT 5`
    )
    
    // Test 3: Try to search for documents
    let searchResults = null
    if (files.length > 0) {
      try {
        searchResults = await searchService.searchDocuments({
          query: '*',
          organizationId: files[0].organization_id.toString(),
          pagination: { from: 0, size: 10 }
        })
      } catch (error) {
        searchResults = {
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health,
      database: {
        total_files: files.length,
        recent_files: files.map(f => ({
          id: f.id,
          name: f.name,
          organization: f.org_name,
          department: f.department,
          created_at: f.created_at
        }))
      },
      search_index: searchResults ? {
        total_indexed: searchResults.total || 0,
        results_count: searchResults.results?.length || 0,
        error: searchResults.error
      } : {
        message: 'No files to search'
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const searchService = createSearchService()
    
    // Get files that need indexing
    const files = await executeQuery<any>(
      `SELECT f.*, o.name as org_name
       FROM files f
       LEFT JOIN organizations o ON f.organization_id = o.id
       WHERE f.is_deleted = 0
       ORDER BY f.created_at DESC
       LIMIT 10`
    )
    
    const results = []
    
    for (const file of files) {
      try {
        // Parse tags safely
        let tags = []
        if (file.tags) {
          try {
            tags = typeof file.tags === 'string' ? JSON.parse(file.tags) : file.tags
          } catch (e) {
            tags = []
          }
        }
        
        const indexed = await searchService.indexDocument({
          file_id: file.id.toString(),
          organization_id: file.organization_id.toString(),
          title: file.name || 'Untitled',
          content: file.ai_description || '',
          author: '',
          department: file.department || '',
          tags: tags,
          file_type: file.file_type || 'other',
          mime_type: file.mime_type || 'application/octet-stream',
          size_bytes: file.size_bytes || 0,
          created_at: new Date(file.created_at),
          updated_at: new Date(file.updated_at),
          extracted_text: file.ai_description || '',
          visibility: file.visibility || 'private',
          folder_path: ''
        })
        
        results.push({
          file_id: file.id,
          file_name: file.name,
          indexed: indexed,
          status: indexed ? '✅ Success' : '❌ Failed'
        })
      } catch (error) {
        results.push({
          file_id: file.id,
          file_name: file.name,
          indexed: false,
          status: '❌ Error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total_processed: results.length,
      successful: results.filter(r => r.indexed).length,
      failed: results.filter(r => !r.indexed).length,
      results
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
