import { NextRequest, NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'

export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      elasticsearch_url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      tests: {}
    }

    // Test Search connection
    try {
      const searchService = createSearchService()
      const searchHealth = await searchService.healthCheck()
      results.tests.search = searchHealth

      // Test index creation
      try {
        await esService.createIndex()
        results.tests.index_creation = {
          status: 'healthy',
          message: 'Index creation successful'
        }
      } catch (error) {
        results.tests.index_creation = {
          status: 'unhealthy',
          message: `Index creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }

    } catch (error) {
      results.tests.elasticsearch = {
        status: 'unhealthy',
        message: `Elasticsearch connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Overall status
    const allHealthy = Object.values(results.tests).every((test: any) => test.status === 'healthy')
    results.overall_status = allHealthy ? 'healthy' : 'unhealthy'

    return NextResponse.json(results, { 
      status: allHealthy ? 200 : 503 
    })

  } catch (error) {
    console.error('Search setup test error:', error)
    
    return NextResponse.json({
      overall_status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}