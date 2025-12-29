import { NextRequest, NextResponse } from 'next/server'
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

    // Use the exact same query as the background processor
    const fileInfo = await executeQuery(`
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
      WHERE f.id = ? AND f.organization_id = ?
    `, [fileId, 3])

    if (fileInfo.length === 0) {
      return NextResponse.json({
        success: false,
        error: `File ${fileId} not found`
      }, { status: 404 })
    }

    const file = fileInfo[0]

    // Create the document structure exactly as the background processor does
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

    return NextResponse.json({
      success: true,
      file_data: file,
      document_structure: document,
      analysis: {
        has_extracted_text: !!file.extracted_text,
        extracted_text_length: file.extracted_text ? file.extracted_text.length : 0,
        title: document.title,
        content_length: document.content.length,
        visibility: document.visibility,
        missing_fields: {
          visibility: !file.visibility,
          mime_type: !file.mime_type,
          department: !file.department
        }
      }
    })

  } catch (error) {
    console.error('Test DB query error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}