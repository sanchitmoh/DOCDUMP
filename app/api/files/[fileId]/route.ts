import { NextRequest, NextResponse } from 'next/server'
import { createFileService } from '@/lib/services/file-service'
import { createFolderService } from '@/lib/services/folder-service'
import { authenticateRequest, getOrCreateSystemEmployee } from '@/lib/auth'
import { executeSingle } from '@/lib/database'

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
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user
    
    // Ensure userId and organizationId are defined
    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'User ID or Organization ID not found' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const includeVersions = searchParams.get('includeVersions') === 'true'
    const includePermissions = searchParams.get('includePermissions') === 'true'

    const fileService = createFileService()

    // Get file details
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check read permission
    if (!file.permission && file.visibility === 'private') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const response: any = {
      success: true,
      file
    }

    // Include versions if requested
    if (includeVersions) {
      response.versions = await fileService.getFileVersions(fileId, organizationId)
    }

    // Include permissions if requested and user has admin access
    if (includePermissions) {
      const hasAdminAccess = file.permission === 'owner' || 
                            file.created_by === userId ||
                            auth.user.type === 'organization'
      
      if (hasAdminAccess) {
        response.permissions = await fileService.getFilePermissions(fileId, organizationId)
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching file:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch file'
    }, { status: 500 })
  }
}

export async function PUT(
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

    const { userId, type: userType, organizationId } = auth.user
    
    // Ensure userId and organizationId are defined
    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'User ID or Organization ID not found' }, { status: 401 })
    }
    
    const body = await request.json()
    const { 
      name, 
      description, 
      tags, 
      department, 
      visibility, 
      allow_download, 
      is_active,
      folderId 
    } = body

    const fileService = createFileService()

    // Get current file to check permissions
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check write permission
    const hasWriteAccess = file.permission === 'write' || 
                          file.permission === 'owner' ||
                          file.created_by === userId ||
                          userType === 'organization'

    if (!hasWriteAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Handle move operation
    if (folderId !== undefined && folderId !== file.folder_id) {
      // Check permission for destination folder
      const folderService = createFolderService()
      const hasDestinationAccess = await folderService.checkFolderPermission(
        folderId,
        userId,
        organizationId,
        'write'
      )

      if (!hasDestinationAccess && userType !== 'organization') {
        return NextResponse.json({ 
          error: 'Insufficient permissions for destination folder' 
        }, { status: 403 })
      }

      await fileService.moveFile(fileId, organizationId, folderId)
    }

    // Handle other updates
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (tags !== undefined) updates.tags = tags
    if (department !== undefined) updates.department = department
    if (visibility !== undefined) updates.visibility = visibility
    if (allow_download !== undefined) updates.allow_download = allow_download
    if (is_active !== undefined) updates.is_active = is_active

    if (Object.keys(updates).length > 0) {
      await fileService.updateFile(fileId, organizationId, updates)
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
          user_id, organization_id, file_id, action, details
        ) VALUES (?, ?, ?, 'update', ?)
      `, [
        contributionUserId,
        organizationId,
        fileId,
        JSON.stringify({
          updates,
          moved_to_folder: folderId !== file.folder_id ? folderId : undefined
        })
      ])
    }

    // Get updated file
    const updatedFile = await fileService.getFileById(fileId, organizationId, userId)

    return NextResponse.json({
      success: true,
      message: 'File updated successfully',
      file: updatedFile
    })

  } catch (error) {
    console.error('Error updating file:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update file'
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
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, type: userType, organizationId } = auth.user

    // Ensure userId and organizationId are defined
    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'User ID or Organization ID not found' }, { status: 401 })
    }

    const fileService = createFileService()

    // Get file to check permissions
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check delete permission (owner or admin)
    const hasDeleteAccess = file.permission === 'owner' ||
                           file.created_by === userId ||
                           userType === 'organization'

    if (!hasDeleteAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete file
    await fileService.deleteFile(fileId, organizationId, userId)

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
          user_id, organization_id, file_id, action, details
        ) VALUES (?, ?, ?, 'delete', ?)
      `, [
        contributionUserId,
        organizationId,
        fileId,
        JSON.stringify({
          file_name: file.name,
          folder_id: file.folder_id,
          size_bytes: file.size_bytes
        })
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting file:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file'
    }, { status: 500 })
  }
}