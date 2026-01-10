import { NextRequest, NextResponse } from 'next/server'
import { createSearchIntegrationService } from '@/lib/services/search-integration'
import { authenticateRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { organizationId } = auth.user
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { action, fileId } = body

    const searchService = createSearchIntegrationService()

    switch (action) {
      case 'index_file':
        if (!fileId) {
          return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
        }
        
        const indexResult = await searchService.indexFile(parseInt(fileId))
        return NextResponse.json({
          success: indexResult,
          message: indexResult ? 'File indexed successfully' : 'Failed to index file'
        })

      case 'remove_file':
        if (!fileId) {
          return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
        }
        
        const removeResult = await searchService.removeFileFromIndex(parseInt(fileId))
        return NextResponse.json({
          success: removeResult,
          message: removeResult ? 'File removed from index' : 'Failed to remove file from index'
        })

      case 'bulk_index':
        const bulkResult = await searchService.bulkIndexFiles(organizationId, 100)
        return NextResponse.json({
          success: true,
          message: `Bulk indexing complete: ${bulkResult.success} success, ${bulkResult.failed} failed`,
          ...bulkResult
        })

      case 'reindex_all':
        const reindexResult = await searchService.reindexOrganization(organizationId)
        return NextResponse.json({
          success: reindexResult,
          message: reindexResult ? 'Organization reindexed successfully' : 'Reindexing failed'
        })

      case 'health_check':
        const health = await searchService.healthCheck()
        return NextResponse.json({
          success: health.status === 'healthy',
          ...health
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Search management API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search management failed'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    // Health check
    const searchService = createSearchIntegrationService()
    const health = await searchService.healthCheck()

    return NextResponse.json({
      success: health.status === 'healthy',
      ...health
    })

  } catch (error) {
    console.error('Search management API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    }, { status: 500 })
  }
}