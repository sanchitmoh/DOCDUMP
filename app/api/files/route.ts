import { NextRequest, NextResponse } from 'next/server'
import { createFileService } from '@/lib/services/file-service'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user
    
    // Ensure userId and organizationId are defined (they should be after successful auth)
    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'User ID or Organization ID not found' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    
    const folderId = searchParams.get('folderId')
    const search = searchParams.get('search')
    const fileType = searchParams.get('fileType')
    const mimeType = searchParams.get('mimeType')
    const department = searchParams.get('department')
    const createdBy = searchParams.get('createdBy')
    const visibility = searchParams.get('visibility')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const sizeMin = searchParams.get('sizeMin')
    const sizeMax = searchParams.get('sizeMax')
    
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') as 'ASC' | 'DESC' || 'ASC'

    const fileService = createFileService()

    if (search) {
      // Search files
      const result = await fileService.searchFiles(
        organizationId,
        search,
        userId,
        {
          folderId: folderId ? parseInt(folderId) : undefined,
          fileType: fileType || undefined,
          mimeType: mimeType || undefined,
          department: department || undefined,
          createdBy: createdBy ? parseInt(createdBy) : undefined,
          visibility: visibility || undefined,
          tags: tags || undefined,
          dateRange: (dateFrom || dateTo) ? {
            from: dateFrom || undefined,
            to: dateTo || undefined
          } : undefined,
          sizeRange: (sizeMin || sizeMax) ? {
            min: sizeMin ? parseInt(sizeMin) : undefined,
            max: sizeMax ? parseInt(sizeMax) : undefined
          } : undefined
        },
        {
          limit,
          offset,
          sortBy,
          sortOrder
        }
      )

      return NextResponse.json({
        success: true,
        files: result.files,
        total: result.total,
        pagination: {
          limit,
          offset,
          has_more: offset + limit < result.total
        }
      })
    } else if (folderId) {
      // Get files in specific folder
      const result = await fileService.getFilesInFolder(
        parseInt(folderId),
        organizationId,
        userId,
        limit,
        offset
      )

      return NextResponse.json({
        success: true,
        files: result.files,
        total: result.total,
        pagination: {
          limit,
          offset,
          has_more: offset + limit < result.total
        }
      })
    } else {
      return NextResponse.json({ 
        error: 'Either folderId or search parameter is required' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error fetching files:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch files'
    }, { status: 500 })
  }
}