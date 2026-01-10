import { NextRequest, NextResponse } from 'next/server'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { createFileService } from '@/lib/services/file-service'
import { executeQuery } from '@/lib/database'
import { verifyToken, authenticateRequest } from '@/lib/auth'

// Helper function to check download permissions
function checkDownloadPermission(file: any, userId: number, userType: string): boolean {
  // Organization admins have full access
  if (userType === 'organization') {
    return true
  }

  // File owner has access
  if (file.created_by === userId) {
    return true
  }

  // Check file-level permissions (highest priority)
  if (file.file_permission) {
    return ['read', 'write', 'owner'].includes(file.file_permission)
  }

  // Check folder-level permissions
  if (file.folder_permission) {
    return ['read', 'write', 'admin'].includes(file.folder_permission)
  }

  // Check visibility settings
  switch (file.visibility) {
    case 'public':
      return true
    case 'org':
      return true // User is already verified to be in the same organization
    case 'private':
      return false // Already checked owner and permissions above
    default:
      return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId: fileIdParam } = await params
    const fileId = parseInt(fileIdParam)
    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 })
    }

    // Verify authentication - support both token and cookie auth
    let decoded
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.nextUrl.searchParams.get('token')
    
    if (token) {
      // Token-based auth
      decoded = verifyToken(token)
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    } else {
      // Cookie-based auth
      const auth = authenticateRequest(request)
      if (!auth.success || !auth.user) {
        return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
      }
      decoded = auth.user
    }

    const { userId, type: userType, organizationId } = decoded

    // Ensure userId and organizationId are defined
    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 })
    }

    // Get file information and check permissions
    const files = await executeQuery(`
      SELECT 
        f.*,
        fo.name as folder_name,
        fp.permission as folder_permission,
        fip.permission as file_permission
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN folder_permissions fp ON fo.id = fp.folder_id AND fp.employee_id = ?
      LEFT JOIN file_permissions fip ON f.id = fip.file_id AND fip.employee_id = ?
      WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
    `, [userId, userId, fileId, organizationId])

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = files[0]

    // Check download permissions
    const hasAccess = checkDownloadPermission(file, userId, userType)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if download is allowed
    if (!file.allow_download) {
      return NextResponse.json({ error: 'Download not allowed for this file' }, { status: 403 })
    }

    // Get preferred storage from query params
    const preferredStorage = request.nextUrl.searchParams.get('storage') as 's3' | 'local' | undefined

    // Initialize services
    const storageService = createHybridStorageService()
    const fileService = createFileService()

    // Track download
    await fileService.trackFileAccess(
      fileId,
      organizationId,
      userId,
      'download',
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || undefined
    )

    // Retrieve file from storage
    const fileData = await storageService.retrieveFile(
      fileId,
      organizationId,
      preferredStorage
    )

    console.log('File data retrieved:', {
      hasBuffer: !!fileData?.buffer,
      bufferLength: fileData?.buffer?.length,
      storageType: fileData?.storageType,
      source: fileData?.source,
      fileDataKeys: Object.keys(fileData || {})
    })

    if (!fileData || !fileData.buffer) {
      console.error('File data or buffer is missing:', fileData)
      return NextResponse.json({ 
        error: 'File content not found or corrupted',
        details: 'File data retrieval failed'
      }, { status: 404 })
    }

    // Set appropriate headers
    const headers = new Headers()
    headers.set('Content-Type', file.mime_type || 'application/octet-stream')
    headers.set('Content-Length', fileData.buffer.length.toString())
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    headers.set('Cache-Control', 'private, max-age=3600')
    headers.set('X-Storage-Source', fileData.storageType || 'unknown')
    headers.set('X-Source-Type', fileData.source || 'unknown')

    // Add checksum header for integrity verification
    if (file.checksum_sha256) {
      headers.set('X-Checksum-SHA256', file.checksum_sha256)
    }

    return new NextResponse(new Uint8Array(fileData.buffer), {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('File download error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Download failed'
    }, { status: 500 })
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId: fileIdParam } = await params
    const fileId = parseInt(fileIdParam)
    if (isNaN(fileId)) {
      return new NextResponse(null, { status: 400 })
    }

    // Verify authentication - support both token and cookie auth
    let decoded
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.nextUrl.searchParams.get('token')
    
    if (token) {
      // Token-based auth
      decoded = verifyToken(token)
      if (!decoded) {
        return new NextResponse(null, { status: 401 })
      }
    } else {
      // Cookie-based auth
      const auth = authenticateRequest(request)
      if (!auth.success || !auth.user) {
        return new NextResponse(null, { status: 401 })
      }
      decoded = auth.user
    }

    const { userId, type: userType, organizationId } = decoded

    // Ensure userId and organizationId are defined
    if (!userId || !organizationId) {
      return new NextResponse(null, { status: 401 })
    }

    // Get file information
    const files = await executeQuery(`
      SELECT 
        f.*,
        fp.permission as folder_permission,
        fip.permission as file_permission
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN folder_permissions fp ON fo.id = fp.folder_id AND fp.employee_id = ?
      LEFT JOIN file_permissions fip ON f.id = fip.file_id AND fip.employee_id = ?
      WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
    `, [userId, userId, fileId, organizationId])

    if (files.length === 0) {
      return new NextResponse(null, { status: 404 })
    }

    const file = files[0]

    // Check permissions
    const hasAccess = checkDownloadPermission(file, userId, userType)
    if (!hasAccess) {
      return new NextResponse(null, { status: 403 })
    }

    // Return file metadata headers
    const headers = new Headers()
    headers.set('Content-Type', file.mime_type || 'application/octet-stream')
    headers.set('Content-Length', file.size_bytes.toString())
    headers.set('Last-Modified', new Date(file.updated_at).toUTCString())
    headers.set('ETag', `"${file.checksum_sha256 || file.id}"`)
    
    if (file.checksum_sha256) {
      headers.set('X-Checksum-SHA256', file.checksum_sha256)
    }

    return new NextResponse(null, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('File HEAD error:', error)
    return new NextResponse(null, { status: 500 })
  }
}