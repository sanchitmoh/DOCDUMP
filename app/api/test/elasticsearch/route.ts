import { NextRequest, NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'

export async function GET(request: NextRequest) {
  try {
    const searchService = createSearchService()
    
    // Test basic connection
    const healthCheck = await searchService.healthCheck()
    
    // Try to get cluster info
    let clusterInfo = null
    try {
      const client = (searchService as any).client
      const info = await client.info()
      clusterInfo = {
        version: info.body?.version || info.version,
        cluster_name: info.body?.cluster_name || info.cluster_name,
        tagline: info.body?.tagline || info.tagline
      }
    } catch (infoError) {
      console.error('Error getting cluster info:', infoError)
      clusterInfo = { error: infoError instanceof Error ? infoError.message : 'Unknown error' }
    }

    return NextResponse.json({
      success: true,
      health: healthCheck,
      cluster_info: clusterInfo,
      config: {
        url: process.env.ELASTICSEARCH_URL,
        username: process.env.ELASTICSEARCH_USERNAME ? '***' : undefined,
        index_prefix: process.env.ELASTICSEARCH_INDEX_PREFIX
      }
    })

  } catch (error) {
    console.error('Elasticsearch test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        url: process.env.ELASTICSEARCH_URL,
        username: process.env.ELASTICSEARCH_USERNAME ? '***' : undefined,
        index_prefix: process.env.ELASTICSEARCH_INDEX_PREFIX
      }
    }, { status: 500 })
  }
}