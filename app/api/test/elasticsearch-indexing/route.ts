import { NextRequest, NextResponse } from 'next/server'
import { createElasticsearchService } from '@/lib/search/elasticsearch'
import { executeQuery } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const searchService = createElasticsearchService()
    
    // Test 1: Basic connection
    const healthCheck = await searchService.healthCheck()
    
    // Test 2: Check if documents index exists
    let indexExists = false
    let indexStats = null
    try {
      const client = (searchService as any).client
      const indexName = 'corporate_documents' // Match the service's naming convention
      const exists = await client.indices.exists({ index: indexName })
      indexExists = exists.body || exists
      
      if (indexExists) {
        const stats = await client.indices.stats({ index: indexName })
        indexStats = {
          total_docs: stats.body?._all?.total?.docs?.count || stats._all?.total?.docs?.count || 0,
          index_size: stats.body?._all?.total?.store?.size_in_bytes || stats._all?.total?.store?.size_in_bytes || 0
        }
      }
    } catch (error) {
      console.error('Error checking index:', error)
    }

    // Test 3: Get files from database that should be indexed
    const filesInDB = await executeQuery(`
      SELECT 
        f.id,
        f.name,
        f.file_type,
        f.created_at,
        LENGTH(etc.extracted_text) as text_length,
        sis.index_status,
        sis.indexed_at,
        sis.error_message
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      LEFT JOIN search_index_status sis ON f.id = sis.file_id
      WHERE f.is_deleted = 0
      ORDER BY f.id DESC
      LIMIT 10
    `)

    // Test 4: Try to search for documents
    let searchResults = null
    try {
      searchResults = await searchService.searchDocuments({
        query: '*',
        organizationId: '3',
        pagination: { from: 0, size: 5 }
      })
    } catch (error) {
      console.error('Search test failed:', error)
      searchResults = { error: error instanceof Error ? error.message : 'Search failed' }
    }

    // Test 5: Check search index status table
    const indexStatusStats = await executeQuery(`
      SELECT 
        index_status,
        COUNT(*) as count
      FROM search_index_status
      GROUP BY index_status
    `)

    return NextResponse.json({
      success: true,
      tests: {
        elasticsearch_health: healthCheck,
        index_exists: indexExists,
        index_stats: indexStats,
        files_in_database: {
          total: filesInDB.length,
          files: filesInDB
        },
        search_test: searchResults,
        index_status_stats: indexStatusStats
      },
      summary: {
        elasticsearch_connected: healthCheck.status === 'healthy',
        index_exists: indexExists,
        documents_in_index: indexStats?.total_docs || 0,
        files_in_database: filesInDB.length,
        search_working: !searchResults?.error
      }
    })

  } catch (error) {
    console.error('Elasticsearch indexing test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, fileId } = await request.json()
    const searchService = createElasticsearchService()

    if (action === 'reindex-file' && fileId) {
      // Test manual indexing of a specific file
      const files = await executeQuery(`
        SELECT 
          f.*,
          fo.name as folder_name,
          u.full_name as author_name,
          etc.extracted_text,
          dm.title as doc_title,
          dm.author as doc_author,
          dm.subject as doc_subject,
          dm.keywords as doc_keywords
        FROM files f
        JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        WHERE f.id = ? AND f.is_deleted = 0
      `, [fileId])

      if (files.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'File not found'
        }, { status: 404 })
      }

      const file = files[0]
      
      // Create document for indexing
      const document = {
        file_id: fileId.toString(),
        organization_id: file.organization_id.toString(),
        title: file.doc_title || file.name,
        content: file.extracted_text || '',
        author: file.doc_author || file.author_name || '',
        department: file.department || '',
        tags: file.tags ? JSON.parse(file.tags) : [],
        file_type: file.file_type || 'other',
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        created_at: new Date(file.created_at),
        updated_at: new Date(file.updated_at),
        visibility: file.visibility,
        folder_path: file.folder_name,
        extracted_text: file.extracted_text || '',
        document_title: file.doc_title || '',
        document_author: file.doc_author || '',
        document_subject: file.doc_subject || '',
        document_keywords: file.doc_keywords || ''
      }

      // Index the document
      await searchService.indexDocument(document)

      // Update search index status
      await executeQuery(`
        INSERT INTO search_index_status (file_id, organization_id, index_status, indexed_at)
        VALUES (?, ?, 'indexed', NOW())
        ON DUPLICATE KEY UPDATE
          index_status = 'indexed',
          indexed_at = NOW(),
          error_message = NULL
      `, [fileId, file.organization_id])

      return NextResponse.json({
        success: true,
        message: `File ${fileId} indexed successfully`,
        document: {
          file_id: document.file_id,
          title: document.title,
          content_length: document.content.length,
          has_extracted_text: !!document.extracted_text
        }
      })

    } else if (action === 'reindex-all') {
      // Reindex all files with extracted text
      const files = await executeQuery(`
        SELECT 
          f.*,
          fo.name as folder_name,
          u.full_name as author_name,
          etc.extracted_text,
          dm.title as doc_title,
          dm.author as doc_author,
          dm.subject as doc_subject,
          dm.keywords as doc_keywords
        FROM files f
        JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        WHERE f.is_deleted = 0
        ORDER BY f.id DESC
        LIMIT 20
      `)

      let indexed = 0
      let errors = 0

      for (const file of files) {
        try {
          const document = {
            file_id: file.id.toString(),
            organization_id: file.organization_id.toString(),
            title: file.doc_title || file.name,
            content: file.extracted_text || '',
            author: file.doc_author || file.author_name || '',
            department: file.department || '',
            tags: file.tags ? JSON.parse(file.tags) : [],
            file_type: file.file_type || 'other',
            mime_type: file.mime_type,
            size_bytes: file.size_bytes,
            created_at: new Date(file.created_at),
            updated_at: new Date(file.updated_at),
            visibility: file.visibility,
            folder_path: file.folder_name,
            extracted_text: file.extracted_text || '',
            document_title: file.doc_title || '',
            document_author: file.doc_author || '',
            document_subject: file.doc_subject || '',
            document_keywords: file.doc_keywords || ''
          }

          await searchService.indexDocument(document)

          // Update search index status
          await executeQuery(`
            INSERT INTO search_index_status (file_id, organization_id, index_status, indexed_at)
            VALUES (?, ?, 'indexed', NOW())
            ON DUPLICATE KEY UPDATE
              index_status = 'indexed',
              indexed_at = NOW(),
              error_message = NULL
          `, [file.id, file.organization_id])

          indexed++
        } catch (error) {
          console.error(`Error indexing file ${file.id}:`, error)
          errors++
        }
      }

      return NextResponse.json({
        success: true,
        message: `Reindexing completed`,
        results: {
          total_files: files.length,
          indexed: indexed,
          errors: errors
        }
      })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "reindex-file" with fileId or "reindex-all"'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Elasticsearch indexing action error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}