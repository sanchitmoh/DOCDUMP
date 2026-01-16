import { NextRequest, NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'

export async function GET(request: NextRequest) {
  try {
    const searchService = createSearchService()
    
    // Test different search queries
    const tests = []
    
    // Test 1: Search for "test" (should find our test document)
    try {
      const testSearch = await searchService.searchDocuments({
        query: "test",
        organizationId: "3",
        pagination: { from: 0, size: 10 }
      })
      tests.push({
        name: "Search for 'test'",
        success: true,
        results: testSearch.results.length,
        total: testSearch.total,
        documents: testSearch.results.map(r => ({ file_id: r.file_id, title: r.title, score: r.score }))
      })
    } catch (error) {
      tests.push({
        name: "Search for 'test'",
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 2: Search for all documents
    try {
      const allSearch = await searchService.searchDocuments({
        query: "*",
        organizationId: "3",
        pagination: { from: 0, size: 10 }
      })
      tests.push({
        name: "Search for all documents",
        success: true,
        results: allSearch.results.length,
        total: allSearch.total,
        documents: allSearch.results.map(r => ({ file_id: r.file_id, title: r.title, score: r.score }))
      })
    } catch (error) {
      tests.push({
        name: "Search for all documents",
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 3: Search for "document" (should find test document and possibly others)
    try {
      const docSearch = await searchService.searchDocuments({
        query: "document",
        organizationId: "3",
        pagination: { from: 0, size: 10 }
      })
      tests.push({
        name: "Search for 'document'",
        success: true,
        results: docSearch.results.length,
        total: docSearch.total,
        documents: docSearch.results.map(r => ({ file_id: r.file_id, title: r.title, score: r.score }))
      })
    } catch (error) {
      tests.push({
        name: "Search for 'document'",
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    return NextResponse.json({
      success: true,
      tests: tests
    })

  } catch (error) {
    console.error('Test search error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}