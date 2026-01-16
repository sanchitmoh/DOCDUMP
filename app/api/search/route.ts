import { NextRequest, NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'
import { authenticateRequest } from '@/lib/auth'

// Simple in-memory cache for search results
const searchCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute cache

function getCacheKey(searchParams: URLSearchParams, organizationId: string): string {
  const params = Array.from(searchParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return `${organizationId}:${params}`
}

function getFromCache(key: string): any | null {
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  searchCache.delete(key)
  return null
}

function setCache(key: string, data: any): void {
  searchCache.set(key, { data, timestamp: Date.now() })
  
  // Clean old cache entries (keep max 100 entries)
  if (searchCache.size > 100) {
    const oldestKey = Array.from(searchCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
    searchCache.delete(oldestKey)
  }
}

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

    // Check cache first
    const cacheKey = getCacheKey(request.nextUrl.searchParams, organizationId.toString())
    const cachedResult = getFromCache(cacheKey)
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true
      })
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
    const searchService = createSearchService()
    const searchResults = await searchService.searchDocuments(searchQuery)

    const response = {
      success: true,
      ...searchResults,
      pagination: {
        page,
        page_size: pageSize,
        total_pages: Math.ceil(searchResults.total / pageSize)
      }
    }

    // Cache the result
    setCache(cacheKey, response)

    return NextResponse.json(response)

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
    const searchService = createSearchService()
    const searchResults = await searchService.searchDocuments(searchQuery)

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