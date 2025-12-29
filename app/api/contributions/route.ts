import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId, type: userType } = auth.user

    let contributions
    
    if (userType === 'organization') {
      // For organization users, get all files in the organization
      contributions = await executeQuery(`
        SELECT 
          f.id,
          f.name as title,
          f.created_at as date,
          f.status,
          f.view_count as views,
          f.download_count as downloads,
          f.department,
          f.file_type as type,
          f.tags,
          COALESCE(oe.full_name, 'Organization') as author
        FROM files f
        LEFT JOIN organization_employees oe ON f.created_by = oe.id
        WHERE f.organization_id = ? AND f.is_deleted = 0
        ORDER BY f.created_at DESC
      `, [organizationId])
    } else {
      // For employee users, get only their contributions
      contributions = await executeQuery(`
        SELECT 
          f.id,
          f.name as title,
          f.created_at as date,
          f.status,
          f.view_count as views,
          f.download_count as downloads,
          f.department,
          f.file_type as type,
          f.tags,
          oe.full_name as author
        FROM files f
        LEFT JOIN organization_employees oe ON f.created_by = oe.id
        WHERE f.created_by = ? AND f.organization_id = ? AND f.is_deleted = 0
        ORDER BY f.created_at DESC
      `, [userId, organizationId])
    }

    // Format the data
    const formattedContributions = contributions.map(doc => ({
      ...doc,
      type: doc.type?.toUpperCase() || 'FILE',
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      status: doc.status || 'published',
      views: doc.views || 0,
      downloads: doc.downloads || 0
    }))

    return NextResponse.json({
      success: true,
      contributions: formattedContributions
    })

  } catch (error) {
    console.error('Contributions error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contributions'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
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
    const { fileId, title, description, tags, department, status } = await request.json()

    if (!fileId || !title) {
      return NextResponse.json({ error: 'File ID and title are required' }, { status: 400 })
    }

    // Verify file ownership or organization admin access
    const files = await executeQuery(`
      SELECT created_by FROM files 
      WHERE id = ? AND organization_id = ?
    `, [fileId, organizationId])

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = files[0]
    if (userType !== 'organization' && file.created_by !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update file
    await executeSingle(`
      UPDATE files 
      SET name = ?, description = ?, tags = ?, department = ?, status = ?
      WHERE id = ?
    `, [
      title,
      description || null,
      tags ? JSON.stringify(tags.split(',').map((t: string) => t.trim())) : null,
      department || null,
      status || 'published',
      fileId
    ])

    // Update tags table
    if (tags) {
      await executeSingle(`DELETE FROM file_tags WHERE file_id = ?`, [fileId])
      
      const tagList = tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      if (tagList.length > 0) {
        const tagValues = tagList.map((tag: string) => [fileId, tag])
        const placeholders = tagValues.map(() => '(?, ?)').join(', ')
        const flatValues = tagValues.flat()

        await executeSingle(`
          INSERT INTO file_tags (file_id, tag) VALUES ${placeholders}
        `, flatValues)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'File updated successfully'
    })

  } catch (error) {
    console.error('Update contribution error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update contribution'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
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
    const { fileId } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Verify file ownership or organization admin access
    const files = await executeQuery(`
      SELECT created_by FROM files 
      WHERE id = ? AND organization_id = ?
    `, [fileId, organizationId])

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = files[0]
    if (userType !== 'organization' && file.created_by !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Soft delete the file
    await executeSingle(`
      UPDATE files 
      SET is_deleted = 1, deleted_at = NOW()
      WHERE id = ?
    `, [fileId])

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('Delete contribution error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete contribution'
    }, { status: 500 })
  }
}