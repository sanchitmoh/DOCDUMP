import { NextRequest, NextResponse } from 'next/server'
import { createTextExtractionService } from '@/lib/services/text-extraction'
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

    // Only organization admins can view all extraction jobs
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const fileId = searchParams.get('fileId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let whereClause = 'WHERE tej.organization_id = ?'
    const queryParams = [organizationId]

    if (status) {
      whereClause += ' AND tej.status = ?'
      queryParams.push(status)
    }

    if (fileId) {
      whereClause += ' AND tej.file_id = ?'
      queryParams.push(parseInt(fileId))
    }

    // Get extraction jobs with file information
    const jobs = await executeQuery(`
      SELECT 
        tej.*,
        f.name as file_name,
        f.mime_type,
        f.size_bytes,
        u.full_name as created_by_name,
        TIMESTAMPDIFF(SECOND, tej.started_at, tej.completed_at) as processing_duration_seconds
      FROM text_extraction_jobs tej
      JOIN files f ON tej.file_id = f.id
      LEFT JOIN organization_employees u ON f.created_by = u.id
      ${whereClause}
      ORDER BY tej.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset])

    // Get total count
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total
      FROM text_extraction_jobs tej
      JOIN files f ON tej.file_id = f.id
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
    console.error('Error fetching extraction jobs:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch jobs'
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

    const { organizationId, userType } = decoded

    // Only organization admins can create extraction jobs
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { fileId, extractionMethod, priority = 5 } = body

    if (!fileId || !extractionMethod) {
      return NextResponse.json({ 
        error: 'fileId and extractionMethod are required' 
      }, { status: 400 })
    }

    // Verify file exists and belongs to organization
    const files = await executeQuery(`
      SELECT * FROM files 
      WHERE id = ? AND organization_id = ? AND is_deleted = 0
    `, [fileId, organizationId])

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = files[0]

    // Validate extraction method for file type
    const validMethods = getValidExtractionMethods(file.mime_type)
    if (!validMethods.includes(extractionMethod)) {
      return NextResponse.json({ 
        error: `Invalid extraction method for file type ${file.mime_type}. Valid methods: ${validMethods.join(', ')}` 
      }, { status: 400 })
    }

    // Create extraction job
    const textExtractionService = createTextExtractionService()
    const jobResult = await textExtractionService.createExtractionJob(
      fileId,
      organizationId,
      extractionMethod,
      priority
    )

    if (!jobResult.success) {
      return NextResponse.json({
        success: false,
        error: jobResult.error || 'Failed to create extraction job'
      }, { status: 500 })
    }

    // Get created job details
    const job = await textExtractionService.getExtractionJob(jobResult.jobId!)

    return NextResponse.json({
      success: true,
      message: 'Text extraction job created successfully',
      job
    })

  } catch (error) {
    console.error('Error creating extraction job:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job'
    }, { status: 500 })
  }
}

// Helper function to get valid extraction methods for MIME type
function getValidExtractionMethods(mimeType: string): string[] {
  const methodMap: { [key: string]: string[] } = {
    'application/pdf': ['pdfplumber', 'pdfminer'],
    'application/msword': ['docx'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.ms-excel': ['xlsx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.ms-powerpoint': ['pptx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
    'text/plain': ['custom'],
    'image/jpeg': ['tesseract'],
      'image/png': ['tesseract'],
      'image/gif': ['tesseract'],
      'image/bmp': ['tesseract'],
      'image/tiff': ['tesseract']
    }

    return methodMap[mimeType] || []
}