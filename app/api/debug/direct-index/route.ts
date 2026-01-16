import { NextRequest, NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'
import { executeQuery } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({
        success: false,
        error: 'fileId is required'
      }, { status: 400 })
    }

    const searchService = createSearchService()
    
    // Get file data
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
      visibility: file.visibility || 'org',
      folder_path: file.folder_name,
      extracted_text: file.extracted_text || ''
    }

    console.log('Attempting to index document:', {
      file_id: document.file_id,
      organization_id: document.organization_id,
      title: document.title,
      content_length: document.content.length,
      author: document.author,
      file_type: document.file_type
    })

    // Try to index the document
    const result = await searchService.indexDocument(document)
    
    return NextResponse.json({
      success: result,
      message: result ? 'Document indexed successfully' : 'Document indexing failed',
      document_info: {
        file_id: document.file_id,
        organization_id: document.organization_id,
        title: document.title,
        content_length: document.content.length,
        author: document.author,
        file_type: document.file_type,
        has_extracted_text: !!document.extracted_text
      }
    })

  } catch (error) {
    console.error('Direct index error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}