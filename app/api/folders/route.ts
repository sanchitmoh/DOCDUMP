import { NextRequest, NextResponse } from 'next/server'
import { createFolderService } from '@/lib/services/folder-service'
import { authenticateRequest, getOrCreateSystemEmployee } from '@/lib/auth'
import { executeSingle, executeQuery } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user
    const { searchParams } = new URL(request.url)
    
    const parentId = searchParams.get('parentId')
    const tree = searchParams.get('tree') === 'true'
    const search = searchParams.get('search')
    const department = searchParams.get('department')
    const createdBy = searchParams.get('createdBy')

    const folderService = createFolderService()

    if (search) {
      // Search folders
      const folders = await folderService.searchFolders(
        organizationId,
        search,
        userId,
        {
          department: department || undefined,
          createdBy: createdBy ? parseInt(createdBy) : undefined,
          parentId: parentId ? parseInt(parentId) : undefined
        }
      )

      return NextResponse.json({
        success: true,
        folders
      })
    } else if (tree) {
      // Get folder tree
      const folderTree = await folderService.getFolderTree(
        organizationId,
        parentId ? parseInt(parentId) : undefined,
        userId
      )

      return NextResponse.json({
        success: true,
        tree: folderTree
      })
    } else {
      // Get folders at specific level
      const folderTree = await folderService.getFolderTree(
        organizationId,
        parentId ? parseInt(parentId) : undefined,
        userId,
        1 // Only one level deep
      )

      return NextResponse.json({
        success: true,
        folders: folderTree
      })
    }

  } catch (error) {
    console.error('Error fetching folders:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch folders'
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

    const { userId, organizationId, type: userType } = auth.user
    const body = await request.json()
    const { name, parentId, description, department } = body

    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

    // Check permissions for parent folder if specified
    const folderService = createFolderService()
    
    if (parentId) {
      const hasPermission = await folderService.checkFolderPermission(
        parentId,
        userId,
        organizationId,
        'write'
      )

      if (!hasPermission && userType !== 'organization') {
        return NextResponse.json({ 
          error: 'Insufficient permissions to create folder in this location' 
        }, { status: 403 })
      }
    }

    // Create folder
    // We need to handle both organization admins and employees
    // Since the foreign key constraint only allows employee IDs, we'll temporarily
    // disable the constraint check for organization admins by setting created_by to null
    // but we'll track the creator in the contributions table with additional metadata
    
    let createdBy: number | null = null
    if (auth.user.type === 'employee') {
      createdBy = userId // Use employee ID directly for employees
    }
    // For organization admins, createdBy stays null to avoid foreign key constraint
    
    const folderId = await folderService.createFolder(
      organizationId,
      name,
      parentId,
      description,
      department,
      createdBy
    )

    // Enhanced contribution logging for both organization admins and employees
    // We'll implement a comprehensive tracking system that works for both user types
    
    try {
      if (auth.user.type === 'employee') {
        // Standard contribution logging for employees
        await executeSingle(`
          INSERT INTO contributions (
            user_id, organization_id, folder_id, action, details
          ) VALUES (?, ?, ?, 'create', ?)
        `, [
          userId,
          organizationId,
          folderId,
          JSON.stringify({
            folder_name: name,
            parent_id: parentId,
            department,
            user_type: 'employee',
            user_email: auth.user.email,
            created_at: new Date().toISOString()
          })
        ])
      } else if (auth.user.type === 'organization') {
        // For organization admins, create/use system employee record
        const systemEmployeeId = await getOrCreateSystemEmployee(organizationId, auth.user.email)
        
        // Log the contribution using the system employee ID
        await executeSingle(`
          INSERT INTO contributions (
            user_id, organization_id, folder_id, action, details
          ) VALUES (?, ?, ?, 'create', ?)
        `, [
          systemEmployeeId,
          organizationId,
          folderId,
          JSON.stringify({
            folder_name: name,
            parent_id: parentId,
            department,
            user_type: 'organization_admin',
            actual_admin_id: userId,
            admin_email: auth.user.email,
            created_at: new Date().toISOString(),
            note: 'Created by organization administrator'
          })
        ])
        
        // Also update the folder's created_by to reference the system employee
        await executeSingle(`
          UPDATE folders SET created_by = ? WHERE id = ?
        `, [systemEmployeeId, folderId])
      }
    } catch (error) {
      console.error('Error logging contribution:', error)
      // Don't fail the folder creation if contribution logging fails
    }

    // Get created folder details
    const folder = await folderService.getFolderById(folderId, organizationId, userId)

    return NextResponse.json({
      success: true,
      message: 'Folder created successfully',
      folder
    })

  } catch (error) {
    console.error('Error creating folder:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create folder'
    }, { status: 500 })
  }
}