import { NextRequest, NextResponse } from 'next/server'
import { createFolderService } from '@/lib/services/folder-service'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId: folderIdParam } = await params
    const folderId = parseInt(folderIdParam)
    if (isNaN(folderId)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 })
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

    const folderService = createFolderService()

    // Check folder access (admin permission required to view permissions)
    const hasAccess = await folderService.checkFolderPermission(
      folderId,
      userId,
      organizationId,
      'admin'
    )

    if (!hasAccess && userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get folder permissions
    const permissions = await folderService.getFolderPermissions(folderId, organizationId)

    return NextResponse.json({
      success: true,
      permissions
    })

  } catch (error) {
    console.error('Error fetching folder permissions:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch permissions'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId: folderIdParam } = await params
    const folderId = parseInt(folderIdParam)
    if (isNaN(folderId)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 })
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
    const { employeeId, permission } = body

    if (!employeeId || !permission) {
      return NextResponse.json({ 
        error: 'Employee ID and permission are required' 
      }, { status: 400 })
    }

    if (!['read', 'write', 'admin'].includes(permission)) {
      return NextResponse.json({ 
        error: 'Invalid permission. Must be: read, write, or admin' 
      }, { status: 400 })
    }

    const folderService = createFolderService()

    // Check folder access (admin permission required to manage permissions)
    const hasAccess = await folderService.checkFolderPermission(
      folderId,
      userId,
      organizationId,
      'admin'
    )

    if (!hasAccess && userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Set folder permission
    await folderService.setFolderPermission(
      folderId,
      employeeId,
      permission,
      organizationId
    )

    return NextResponse.json({
      success: true,
      message: 'Folder permission set successfully'
    })

  } catch (error) {
    console.error('Error setting folder permission:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set permission'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId: folderIdParam } = await params
    const folderId = parseInt(folderIdParam)
    if (isNaN(folderId)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 })
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

    const folderService = createFolderService()

    // Check folder access (admin permission required to manage permissions)
    const hasAccess = await folderService.checkFolderPermission(
      folderId,
      userId,
      organizationId,
      'admin'
    )

    if (!hasAccess && userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Remove folder permission
    await folderService.removeFolderPermission(
      folderId,
      parseInt(employeeId),
      organizationId
    )

    return NextResponse.json({
      success: true,
      message: 'Folder permission removed successfully'
    })

  } catch (error) {
    console.error('Error removing folder permission:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove permission'
    }, { status: 500 })
  }
}