import { NextRequest, NextResponse } from 'next/server'
import { createFileService } from '@/lib/services/file-service'
import { verifyToken } from '@/lib/auth'

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

    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { userId, organizationId, userType } = decoded

    const fileService = createFileService()

    // Get file to check permissions
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check admin access
    const hasAdminAccess = file.permission === 'owner' ||
                          file.created_by === userId ||
                          userType === 'organization'

    if (!hasAdminAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get file permissions
    const permissions = await fileService.getFilePermissions(fileId, organizationId)

    return NextResponse.json({
      success: true,
      permissions
    })

  } catch (error) {
    console.error('Error fetching file permissions:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch permissions'
    }, { status: 500 })
  }
}

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
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { userId, organizationId, userType } = decoded
    const body = await request.json()
    const { employeeId, permission, expiresAt } = body

    if (!employeeId || !permission) {
      return NextResponse.json({ 
        error: 'Employee ID and permission are required' 
      }, { status: 400 })
    }

    if (!['read', 'write', 'owner'].includes(permission)) {
      return NextResponse.json({ 
        error: 'Invalid permission. Must be: read, write, or owner' 
      }, { status: 400 })
    }

    const fileService = createFileService()

    // Get file to check permissions
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check admin access
    const hasAdminAccess = file.permission === 'owner' ||
                          file.created_by === userId ||
                          userType === 'organization'

    if (!hasAdminAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Set file permission
    await fileService.setFilePermission(
      fileId,
      employeeId,
      permission,
      organizationId,
      expiresAt ? new Date(expiresAt) : undefined
    )

    return NextResponse.json({
      success: true,
      message: 'File permission set successfully'
    })

  } catch (error) {
    console.error('Error setting file permission:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set permission'
    }, { status: 500 })
  }
}

export async function DELETE(
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
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { userId, organizationId, userType } = decoded
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    const fileService = createFileService()

    // Get file to check permissions
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check admin access
    const hasAdminAccess = file.permission === 'owner' ||
                          file.created_by === userId ||
                          userType === 'organization'

    if (!hasAdminAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Remove file permission
    await fileService.removeFilePermission(
      fileId,
      parseInt(employeeId),
      organizationId
    )

    return NextResponse.json({
      success: true,
      message: 'File permission removed successfully'
    })

  } catch (error) {
    console.error('Error removing file permission:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove permission'
    }, { status: 500 })
  }
}