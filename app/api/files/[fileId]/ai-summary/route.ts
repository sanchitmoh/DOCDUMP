import { NextRequest, NextResponse } from 'next/server'
import { createFileService } from '@/lib/services/file-service'
import { authenticateRequest } from '@/lib/auth'

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
    const summaryResult = await fileService.generateAISummary(fileId, organizationId, userId)

    if (!summaryResult.success) {
      return NextResponse.json({ 
        error: summaryResult.error || 'Failed to generate summary' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      summary: summaryResult.summary,
      file: {
        id: file.id,
        name: file.name,
        file_type: file.file_type,
        mime_type: file.mime_type
      }
    })

  } catch (error) {
    console.error('Error generating AI summary:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate AI summary'
    }, { status: 500 })
  }
}

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

    // Force regenerate AI summary
    const summaryResult = await fileService.generateAISummary(fileId, organizationId, userId)

    if (!summaryResult.success) {
      return NextResponse.json({ 
        error: summaryResult.error || 'Failed to generate summary' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'AI summary generated successfully',
      summary: summaryResult.summary,
      file: {
        id: file.id,
        name: file.name,
        file_type: file.file_type,
        mime_type: file.mime_type
      }
    })

  } catch (error) {
    console.error('Error generating AI summary:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate AI summary'
    }, { status: 500 })
  }
}