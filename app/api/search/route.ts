import { NextRequest, NextResponse } from 'next/server'
import { createElasticsearchService } from '@/lib/search/elasticsearch'
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

    // Parse search parameters
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const department = searchParams.getAll('department')
    const fileType = searchParams.getAll('file_type')
    const author = searchParams.getAll('author')
    const tags = searchParams.getAll('tags')
    const visibility = searchParams.getAll('visibility')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const sizeMin = searchParams.get('size_min')
    const sizeMax = searchParams.get('size_max')
    const folderPath = searchParams.get('folder_path')
    const hasContent = searchParams.get('has_content')
    const ocrConfidenceMin = searchParams.get('ocr_confidence_min')
    const searchType = searchParams.get('search_type') as 'basic' | 'advanced' | 'fuzzy' | 'exact' || 'basic'
    const highlight = searchParams.get('highlight') === 'true'
    const sortField = searchParams.get('sort_field') || 'created_at'
    const sortOrder = searchParams.get('sort_order') as 'asc' | 'desc' || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('page_size') || '20')

    // Build search query
    const searchQuery = {
      query,
      organizationId: organizationId.toString(),
      filters: {
        ...(department.length > 0 && { department }),
        ...(fileType.length > 0 && { file_type: fileType }),
        ...(author.length > 0 && { author }),
        ...(tags.length > 0 && { tags }),
        ...(visibility.length > 0 && { visibility }),
        ...(dateFrom || dateTo) && {
          date_range: {
            ...(dateFrom && { from: dateFrom }),
            ...(dateTo && { to: dateTo })
          }
        },
        ...(sizeMin || sizeMax) && {
          size_range: {
            ...(sizeMin && { min: parseInt(sizeMin) }),
            ...(sizeMax && { max: parseInt(sizeMax) })
          }
        },
        ...(folderPath && { folder_path: folderPath }),
        ...(hasContent !== null && { has_content: hasContent === 'true' }),
        ...(ocrConfidenceMin && { ocr_confidence_min: parseFloat(ocrConfidenceMin) })
      },
      sort: {
        field: sortField,
        order: sortOrder
      },
      pagination: {
        from: (page - 1) * pageSize,
        size: pageSize
      },
      search_type: searchType,
      highlight
    }

    // Execute search
    const elasticsearchService = createElasticsearchService()
    const searchResults = await elasticsearchService.searchDocuments(searchQuery)

    return NextResponse.json({
      success: true,
      ...searchResults,
      pagination: {
        page,
        page_size: pageSize,
        total_pages: Math.ceil(searchResults.total / pageSize)
      }
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 })
  }
}

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
    const searchQuery = {
      ...body,
      organizationId: organizationId.toString()
    }

    // Execute search
    const elasticsearchService = createElasticsearchService()
    const searchResults = await elasticsearchService.searchDocuments(searchQuery)

    return NextResponse.json({
      success: true,
      ...searchResults
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 })
  }
}