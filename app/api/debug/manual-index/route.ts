import { NextRequest, NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'

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
    
    // Create a simple test document
    const document = {
      file_id: fileId.toString(),
      organization_id: "3",
      title: `Test Document ${fileId}`,
      content: "This is a test document with some content for indexing",
      author: "Test Author",
      department: "IT",
      tags: ["test"],
      file_type: "document",
      mime_type: "text/plain",
      size_bytes: 100,
      created_at: new Date(),
      updated_at: new Date(),
      visibility: "org" as const,
      folder_path: "test",
      extracted_text: "This is extracted text for testing"
    }

    console.log('Attempting to index simple test document:', document)

    // Try to index the document
    const result = await searchService.indexDocument(document)
    
    return NextResponse.json({
      success: result,
      message: result ? 'Document indexed successfully' : 'Document indexing failed',
      document: document
    })

  } catch (error) {
    console.error('Manual index error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}