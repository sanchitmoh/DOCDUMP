import { NextRequest, NextResponse } from 'next/server'
import { createFileService } from '@/lib/services/file-service'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery } from '@/lib/database'

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
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId } = auth.user
    
    // Ensure userId and organizationId are defined
    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'User ID or Organization ID not found' }, { status: 401 })
    }

    const fileService = createFileService()

    // Check if user has access to the file
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check read permission
    if (!file.permission && file.visibility === 'private') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Generate AI summary
    const result = await fileService.generateAISummary(fileId, organizationId, userId)

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      summary: result.summary
    })

  } catch (error) {
    console.error('Error generating AI summary:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate summary'
    }, { status: 500 })
  }
}

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

    const fileService = createFileService()

    // Check if user has access to the file
    const file = await fileService.getFileById(fileId, organizationId, userId)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check read permission
    if (!file.permission && file.visibility === 'private') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get existing AI summary
    const summaryData = await executeQuery(`
      SELECT content, model_used, created_at
      FROM ai_generated_content
      WHERE file_id = ? AND organization_id = ? AND content_type = 'summary'
      ORDER BY created_at DESC
      LIMIT 1
    `, [fileId, organizationId])

    if (summaryData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No AI summary found for this file'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      summary: summaryData[0].content,
      model_used: summaryData[0].model_used,
      generated_at: summaryData[0].created_at
    })

  } catch (error) {
    console.error('Error fetching AI summary:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch summary'
    }, { status: 500 })
  }
}