import { NextRequest, NextResponse } from 'next/server'
import { createFolderService } from '@/lib/services/folder-service'
import { createFileService } from '@/lib/services/file-service'
import { authenticateRequest, getOrCreateSystemEmployee } from '@/lib/auth'
import { executeSingle } from '@/lib/database'

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
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, type: userType, organizationId } = auth.user
    const { searchParams } = new URL(request.url)
    const includeFiles = searchParams.get('includeFiles') === 'true'
    const includePath = searchParams.get('includePath') === 'true'

    const folderService = createFolderService()

    // Check folder access
    const hasAccess = await folderService.checkFolderPermission(
      folderId,
      userId,
      organizationId,
      'read'
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get folder details
    const folder = await folderService.getFolderById(folderId, organizationId, userId)
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const response: any = {
      success: true,
      folder
    }

    // Include folder path if requested
    if (includePath) {
      response.path = await folderService.getFolderPath(folderId, organizationId)
    }

    // Include files if requested
    if (includeFiles) {
      const fileService = createFileService()
      const filesResult = await fileService.getFilesInFolder(
        folderId,
        organizationId,
        userId,
        {
          limit: parseInt(searchParams.get('limit') || '50'),
          offset: parseInt(searchParams.get('offset') || '0'),
          sortBy: searchParams.get('sortBy') as any || 'name',
          sortOrder: searchParams.get('sortOrder') as any || 'ASC'
        }
      )
      response.files = filesResult.files
      response.totalFiles = filesResult.total
    }

    // Get subfolders
    const subfolders = await folderService.getFolderTree(
      organizationId,
      folderId,
      userId,
      1 // Only immediate children
    )
    response.subfolders = subfolders

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching folder:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch folder'
    }, { status: 500 })
  }
}

export async function PUT(
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
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, type: userType, organizationId } = auth.user
    const body = await request.json()
    const { name, description, department, is_active, parentId } = body

    const folderService = createFolderService()

    // Check folder access
    const hasAccess = await folderService.checkFolderPermission(
      folderId,
      userId,
      organizationId,
      'write'
    )

    if (!hasAccess && userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Handle move operation
    if (parentId !== undefined) {
      await folderService.moveFolder(folderId, organizationId, parentId)
    }

    // Handle other updates
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (department !== undefined) updates.department = department
    if (is_active !== undefined) updates.is_active = is_active

    if (Object.keys(updates).length > 0) {
      await folderService.updateFolder(folderId, organizationId, updates)
    }

    // Log contribution with proper user tracking for both admin and employee
    let contributionUserId: number | null = null
    
    if (userType === 'employee') {
      contributionUserId = userId // Use employee ID directly
    } else if (userType === 'organization') {
      // For organization admins, create/use system employee record
      try {
        contributionUserId = await getOrCreateSystemEmployee(organizationId, auth.user.email)
      } catch (error) {
        console.error('Error creating system employee for admin:', error)
        contributionUserId = null // Fallback to null if system employee creation fails
      }
    }

    // Log contribution (only if we have a valid user ID)
    if (contributionUserId) {
      await executeSingle(`
        INSERT INTO contributions (
          user_id, organization_id, folder_id, action, details
        ) VALUES (?, ?, ?, 'update', ?)
      `, [
        contributionUserId,
        organizationId,
        folderId,
        JSON.stringify({
          updates,
          moved_to_parent: parentId
        })
      ])
    }

    // Get updated folder
    const folder = await folderService.getFolderById(folderId, organizationId, userId)

    return NextResponse.json({
      success: true,
      message: 'Folder updated successfully',
      folder
    })

  } catch (error) {
    console.error('Error updating folder:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update folder'
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
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, type: userType, organizationId } = auth.user

    const folderService = createFolderService()

    // Check folder access
    const hasAccess = await folderService.checkFolderPermission(
      folderId,
      userId,
      organizationId,
      'admin'
    )

    if (!hasAccess && userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get folder details before deletion
    const folder = await folderService.getFolderById(folderId, organizationId, userId)
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Delete folder
    await folderService.deleteFolder(folderId, organizationId)

    // Log contribution with proper user tracking for both admin and employee
    let contributionUserId: number | null = null
    
    if (userType === 'employee') {
      contributionUserId = userId // Use employee ID directly
    } else if (userType === 'organization') {
      // For organization admins, create/use system employee record
      try {
        contributionUserId = await getOrCreateSystemEmployee(organizationId, auth.user.email)
      } catch (error) {
        console.error('Error creating system employee for admin:', error)
        contributionUserId = null // Fallback to null if system employee creation fails
      }
    }

    // Log contribution (only if we have a valid user ID)
    if (contributionUserId) {
      await executeSingle(`
        INSERT INTO contributions (
          user_id, organization_id, folder_id, action, details
        ) VALUES (?, ?, ?, 'delete', ?)
      `, [
        contributionUserId,
        organizationId,
        folderId,
        JSON.stringify({
          folder_name: folder.name,
          parent_id: folder.parent_id
        })
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting folder:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete folder'
    }, { status: 500 })
  }
}