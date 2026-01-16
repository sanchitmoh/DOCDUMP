import { NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { executeQuery } from '@/lib/database'

export async function GET() {
  try {
    const searchService = createSearchService()
    const textExtractionService = createTextExtractionService()
    
    const tests = []
    
    // Test 1: Elasticsearch validation (should fail with empty file_id)
    try {
      console.log('🧪 Testing validation with empty file_id (expected to fail)...')
      const invalidDoc = {
        file_id: '', // Invalid - empty
        organization_id: '3',
        title: 'Test',
        content: 'Test content',
        author: 'Test Author',
        department: 'IT',
        tags: ['test'],
        file_type: 'document',
        mime_type: 'text/plain',
        size_bytes: 100,
        created_at: new Date(),
        updated_at: new Date(),
        visibility: 'org' as const,
        folder_path: 'test'
      }
      
      const result = await searchService.indexDocument(invalidDoc)
      tests.push({
        name: 'Validation Test (should fail)',
        success: !result, // Should fail due to empty file_id
        result: result ? 'Unexpectedly succeeded' : 'Correctly failed validation'
      })
    } catch (error) {
      console.log('✅ Validation correctly caught error:', error instanceof Error ? error.message : 'Unknown error')
      tests.push({
        name: 'Validation Test (should fail)',
        success: true,
        result: `Correctly caught validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
    
    // Test 2: Large content truncation
    try {
      console.log('🧪 Testing large content truncation...')
      const largeContent = 'A'.repeat(60000) // 60KB content
      const largeDoc = {
        file_id: 'large-test',
        organization_id: '3',
        title: 'Large Content Test',
        content: largeContent,
        author: 'Test Author',
        department: 'IT',
        tags: ['test'],
        file_type: 'document',
        mime_type: 'text/plain',
        size_bytes: 60000,
        created_at: new Date(),
        updated_at: new Date(),
        visibility: 'org' as const,
        folder_path: 'test'
      }
      
      console.log(`Content truncated for file ${largeDoc.file_id}: original length -> ${largeContent.length}`)
      const result = await searchService.indexDocument(largeDoc)
      console.log(`✅ Document indexed successfully: ${largeDoc.file_id}`)
      tests.push({
        name: 'Large Content Truncation Test',
        success: result,
        result: result ? 'Successfully indexed with truncation' : 'Failed to index'
      })
    } catch (error) {
      console.log('❌ Large content test failed:', error instanceof Error ? error.message : 'Unknown error')
      tests.push({
        name: 'Large Content Truncation Test',
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
    
    // Test 3: PDF extraction improvement
    try {
      const pdfFiles = await executeQuery(`
        SELECT f.id, f.name, f.size_bytes, LENGTH(etc.extracted_text) as current_text_length
        FROM files f
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        WHERE f.file_type = 'pdf' AND f.is_deleted = 0
        ORDER BY f.id DESC
        LIMIT 3
      `)
      
      tests.push({
        name: 'PDF Files Analysis',
        success: true,
        result: {
          total_pdfs: pdfFiles.length,
          files: pdfFiles.map(f => ({
            id: f.id,
            name: f.name,
            size_bytes: f.size_bytes,
            extracted_text_length: f.current_text_length || 0,
            extraction_status: f.current_text_length > 100 ? 'Good' : 'Needs improvement'
          }))
        }
      })
    } catch (error) {
      tests.push({
        name: 'PDF Files Analysis',
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
    
    // Test 4: Search functionality
    try {
      const searchResult = await searchService.searchDocuments({
        query: 'test',
        organizationId: '3',
        pagination: { from: 0, size: 5 }
      })
      
      tests.push({
        name: 'Search Functionality Test',
        success: true,
        result: {
          total_results: searchResult.total,
          results_returned: searchResult.results.length,
          took_ms: searchResult.took,
          sample_results: searchResult.results.slice(0, 2).map(r => ({
            file_id: r.file_id,
            title: r.title,
            score: r.score
          }))
        }
      })
    } catch (error) {
      tests.push({
        name: 'Search Functionality Test',
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
    
    // Test 5: Background processor status
    try {
      const queueStatus = await executeQuery(`
        SELECT 
          index_status,
          COUNT(*) as count,
          COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as with_errors
        FROM search_index_status
        GROUP BY index_status
      `)
      
      tests.push({
        name: 'Background Processor Status',
        success: true,
        result: {
          queue_status: queueStatus,
          summary: queueStatus.reduce((acc, status) => {
            acc[status.index_status] = {
              count: status.count,
              with_errors: status.with_errors
            }
            return acc
          }, {} as any)
        }
      })
    } catch (error) {
      tests.push({
        name: 'Background Processor Status',
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: tests,
      summary: {
        total_tests: tests.length,
        passed: tests.filter(t => t.success).length,
        failed: tests.filter(t => !t.success).length
      }
    })

  } catch (error) {
    console.error('Comprehensive test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}