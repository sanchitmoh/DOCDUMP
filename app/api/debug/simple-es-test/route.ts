import { NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'

export async function GET() {
  try {
    const searchService = createSearchService()
    
    // Test 1: Health check
    const health = await searchService.healthCheck()
    console.log('Health check:', health)
    
    // Test 2: Try to create index
    try {
      await searchService.createIndex()
      console.log('Index creation successful')
    } catch (error) {
      console.error('Index creation error:', error)
    }
    
    // Test 3: Try to index a simple document
    const testDocument = {
      file_id: "test-123",
      organization_id: "3",
      title: "Test Document",
      content: "This is a test document for Elasticsearch indexing",
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
      extracted_text: "This is extracted text"
    }
    
    console.log('Attempting to index test document:', testDocument)
    const indexResult = await searchService.indexDocument(testDocument)
    console.log('Index result:', indexResult)
    
    // Test 4: Try to search
    const searchResult = await searchService.searchDocuments({
      query: "test",
      organizationId: "3",
      pagination: { from: 0, size: 5 }
    })
    console.log('Search result:', searchResult)
    
    return NextResponse.json({
      success: true,
      tests: {
        health_check: health,
        index_creation: "success",
        document_indexing: indexResult,
        search_test: searchResult
      }
    })

  } catch (error) {
    console.error('Simple ES test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}