import { NextRequest, NextResponse } from 'next/server'
import { createFileService } from '@/lib/services/file-service'
import { authenticateRequest } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId: fileIdParam } = await params
    const fileId = parseInt(fileIdParam)
    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 })
    }

    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user
    
    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'User ID or Organization ID not found' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body // 'view' or 'download'

    if (!action || !['view', 'download'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "view" or "download"' }, { status: 400 })
    }

    const fileService = createFileService()

    // Check if user has access to the file
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check permission
    if (!file.permission && file.visibility === 'private') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // For downloads, check if downloads are allowed
    if (action === 'download' && !file.allow_download) {
      return NextResponse.json({ error: 'Downloads not allowed for this file' }, { status: 403 })
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Track the access
    await fileService.trackFileAccess(
      fileId,
      organizationId,
      userId,
      action as 'view' | 'download',
      ipAddress,
      userAgent
    )

    return NextResponse.json({
      success: true,
      message: `File ${action} tracked successfully`,
      file: {
        id: file.id,
        name: file.name,
        view_count: action === 'view' ? (file.view_count || 0) + 1 : file.view_count,
        download_count: action === 'download' ? (file.download_count || 0) + 1 : file.download_count
      }
    })

  } catch (error) {
    console.error('Error tracking file access:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track file access'
    }, { status: 500 })
  }
}