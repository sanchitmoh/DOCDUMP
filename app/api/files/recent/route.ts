import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeComplexQuery } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get recently added files for the organization (simplified query)
    const recentFiles = await executeComplexQuery(`
      SELECT 
        f.id,
        f.name,
        f.file_type,
        f.mime_type,
        f.size_bytes,
        f.size_hr,
        f.folder_id,
        f.description,
        f.tags,
        f.visibility,
        f.department,
        f.created_at,
        f.updated_at,
        f.created_at as last_viewed_at
      FROM files f
      WHERE f.organization_id = ? 
        AND f.is_deleted = 0 
        AND f.is_active = 1
      ORDER BY f.created_at DESC
      LIMIT ?
    `, [organizationId, limit])

    // Format the response
    const formattedFiles = recentFiles.map(file => {
      let tags = []
      try {
        if (file.tags) {
          if (typeof file.tags === 'string') {
            tags = JSON.parse(file.tags)
          } else if (Array.isArray(file.tags)) {
            tags = file.tags
          }
        }
      } catch (error) {
        console.error('Error parsing tags for file', file.id, error)
        tags = []
      }

      return {
        ...file,
        tags,
        uploaded_by_name: 'Unknown',
        folder_name: 'Unknown'
      }
    })

    return NextResponse.json({
      success: true,
      files: formattedFiles
    })

  } catch (error) {
    console.error('Error fetching recent files:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recent files'
    }, { status: 500 })
  }
}