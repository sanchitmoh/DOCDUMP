import { NextRequest, NextResponse } from 'next/server'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { verifyToken } from '@/lib/auth'
import { executeQuery } from '@/lib/database'

export async function GET(request: NextRequest) {
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

    const { organizationId, userType } = decoded

    // Only organization admins can view sync jobs
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let whereClause = 'WHERE ssj.organization_id = ?'
    const queryParams = [organizationId]

    if (status) {
      whereClause += ' AND ssj.status = ?'
      queryParams.push(status)
    }

    // Get sync jobs
    const jobs = await executeQuery(`
      SELECT 
        ssj.*,
        f.name as file_name,
        u.full_name as triggered_by_name,
        TIMESTAMPDIFF(SECOND, ssj.started_at, ssj.completed_at) as duration_seconds
      FROM storage_sync_jobs ssj
      LEFT JOIN files f ON ssj.file_id = f.id
      LEFT JOIN organization_employees u ON ssj.triggered_by = u.id
      ${whereClause}
      ORDER BY ssj.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset])

    // Get total count
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total
      FROM storage_sync_jobs ssj
      ${whereClause}
    `, queryParams)

    const total = countResult[0].total

    return NextResponse.json({
      success: true,
      jobs,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Error fetching sync jobs:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sync jobs'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const { organizationId, userType, userId } = decoded

    // Only organization admins can create sync jobs
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { syncType = 'incremental', fileId } = body

    if (!['full', 'incremental', 'file'].includes(syncType)) {
      return NextResponse.json({ 
        error: 'Invalid sync type. Must be: full, incremental, or file' 
      }, { status: 400 })
    }

    if (syncType === 'file' && !fileId) {
      return NextResponse.json({ 
        error: 'fileId is required for file sync type' 
      }, { status: 400 })
    }

    // If fileId is provided, verify it exists and belongs to organization
    if (fileId) {
      const files = await executeQuery(`
        SELECT * FROM files 
        WHERE id = ? AND organization_id = ? AND is_deleted = 0
      `, [fileId, organizationId])

      if (files.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
    }

    // Create sync job
    const storageService = createHybridStorageService()
    const jobId = await storageService.syncStorage(
      organizationId,
      syncType,
      fileId,
      userId
    )

    // Get created job details
    const jobs = await executeQuery(`
      SELECT 
        ssj.*,
        f.name as file_name,
        u.full_name as triggered_by_name
      FROM storage_sync_jobs ssj
      LEFT JOIN files f ON ssj.file_id = f.id
      LEFT JOIN organization_employees u ON ssj.triggered_by = u.id
      WHERE ssj.id = ?
    `, [jobId])

    return NextResponse.json({
      success: true,
      message: 'Storage sync job created successfully',
      job: jobs[0]
    })

  } catch (error) {
    console.error('Error creating sync job:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sync job'
    }, { status: 500 })
  }
}