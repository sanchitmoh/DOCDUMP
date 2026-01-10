import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId, type: userType } = auth.user
    const { fileId } = await params

    console.log('Document details API - fileId:', fileId, 'userId:', userId, 'organizationId:', organizationId)

    if (!fileId || fileId === 'undefined') {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Get file details with creator information
    const fileQuery = `
      SELECT 
        f.id,
        f.name as title,
        f.description,
        f.tags,
        f.department,
        f.created_by,
        f.mime_type,
        f.file_type as type,
        f.size_bytes,
        f.size_hr,
        f.view_count as views,
        f.download_count as downloads,
        f.visibility,
        f.is_active,
        f.created_at,
        f.updated_at,
        f.ai_description,
        oe.full_name as author_name,
        oe.email as author_email,
        d.name as author_department,
        o.name as organization_name
      FROM files f
      LEFT JOIN organization_employees oe ON f.created_by = oe.id
      LEFT JOIN departments d ON oe.department_id = d.id
      LEFT JOIN organizations o ON f.organization_id = o.id
      WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
    `

    const files = await executeQuery(fileQuery, [fileId, organizationId])

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = files[0]

    // Check if user has access to this file
    if (file.visibility === 'private' && userType !== 'organization' && file.created_by !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Increment view count (only if not the owner)
    if (file.created_by !== userId) {
      await executeSingle(`
        UPDATE files 
        SET view_count = view_count + 1, last_viewed_at = NOW()
        WHERE id = ?
      `, [fileId])
      
      file.views = (file.views || 0) + 1
    }

    // Parse tags
    let tags = []
    if (file.tags) {
      try {
        if (Array.isArray(file.tags)) {
          tags = file.tags
        } else if (typeof file.tags === 'string') {
          tags = JSON.parse(file.tags)
        }
      } catch (error) {
        tags = []
      }
    }

    // Format the response
    const documentDetails = {
      id: file.id,
      title: file.title,
      description: file.description || '',
      author: file.author_name || 'Unknown',
      date: file.created_at,
      views: file.views || 0,
      downloads: file.downloads || 0,
      type: file.type?.toUpperCase() || 'FILE',
      size: file.size_hr || `${Math.round((file.size_bytes || 0) / 1024)} KB`,
      category: file.department || 'General',
      tags: tags,
      visibility: file.visibility,
      isActive: file.is_active,
      aiDescription: file.ai_description,
      uploader: {
        name: file.author_name || 'Unknown',
        department: file.author_department || 'Unknown',
        email: file.author_email || '',
        avatar: file.author_name ? file.author_name.charAt(0).toUpperCase() : '?',
        timePosted: file.created_at,
        organization: file.organization_name || ''
      },
      mimeType: file.mime_type,
      createdAt: file.created_at,
      updatedAt: file.updated_at
    }

    // Get related documents (same department or similar tags)
    const relatedQuery = `
      SELECT 
        f.id,
        f.name as title,
        f.created_at,
        f.department,
        oe.full_name as author_name
      FROM files f
      LEFT JOIN organization_employees oe ON f.created_by = oe.id
      WHERE f.organization_id = ? 
        AND f.id != ? 
        AND f.is_deleted = 0 
        AND f.is_active = 1
        AND (f.visibility = 'org' OR f.visibility = 'public' OR (f.visibility = 'private' AND f.created_by = ?))
        AND (f.department = ? OR JSON_OVERLAPS(f.tags, ?))
      ORDER BY f.created_at DESC
      LIMIT 6
    `

    const relatedDocs = await executeQuery(relatedQuery, [
      organizationId,
      fileId,
      userId,
      file.department || '',
      JSON.stringify(tags)
    ])

    return NextResponse.json({
      success: true,
      document: documentDetails,
      relatedDocuments: relatedDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        author: doc.author_name || 'Unknown',
        date: doc.created_at,
        department: doc.department || 'General'
      }))
    })

  } catch (error) {
    console.error('Document details error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch document details'
    }, { status: 500 })
  }
}