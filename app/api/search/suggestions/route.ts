import { NextRequest, NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
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

    // Get query parameter
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        suggestions: []
      })
    }

    // Get suggestions
    const searchService = createSearchService()
    const suggestions = await searchService.getSearchSuggestions(query, organizationId.toString())

    return NextResponse.json({
      success: true,
      suggestions
    })

  } catch (error) {
    console.error('Search suggestions API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get suggestions'
    }, { status: 500 })
  }
}