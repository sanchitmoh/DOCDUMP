import { NextRequest, NextResponse } from 'next/server'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { verifyToken } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId: jobIdParam } = await params
    const jobId = parseInt(jobIdParam)
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
    }

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

    // Get job details with file information
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
      WHERE tej.id = ? AND tej.organization_id = ?
    `, [jobId, organizationId])

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Get extracted text content if job is completed
    let extractedContent = null
    let documentMetadata = null
    let ocrResults = null

    if (job.status === 'completed') {
      const textExtractionService = createTextExtractionService()
      
      extractedContent = await textExtractionService.getExtractedText(job.file_id)
      documentMetadata = await textExtractionService.getDocumentMetadata(job.file_id)
      ocrResults = await textExtractionService.getOCRResults(job.file_id)
    }

    return NextResponse.json({
      success: true,
      job,
      extracted_content: extractedContent,
      document_metadata: documentMetadata,
      ocr_results: ocrResults
    })

  } catch (error) {
    console.error('Error fetching extraction job:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId: jobIdParam } = await params
    const jobId = parseInt(jobIdParam)
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
    }

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

    // Only organization admins can update jobs
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { action, priority } = body

    // Verify job exists and belongs to organization
    const jobs = await executeQuery(`
      SELECT * FROM text_extraction_jobs 
      WHERE id = ? AND organization_id = ?
    `, [jobId, organizationId])

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    switch (action) {
      case 'cancel':
        if (job.status === 'pending' || job.status === 'processing') {
          await executeSingle(`
            UPDATE text_extraction_jobs 
            SET status = 'cancelled', completed_at = NOW()
            WHERE id = ?
          `, [jobId])
        } else {
          return NextResponse.json({ 
            error: `Cannot cancel job with status: ${job.status}` 
          }, { status: 400 })
        }
        break

      case 'retry':
        if (job.status === 'failed' || job.status === 'cancelled') {
          await executeSingle(`
            UPDATE text_extraction_jobs 
            SET status = 'pending', retry_count = retry_count + 1,
                error_message = NULL, error_code = NULL,
                started_at = NULL, completed_at = NULL
            WHERE id = ?
          `, [jobId])

          // Re-add to Redis queue
          const textExtractionService = createTextExtractionService()
          await textExtractionService.redis.addJob('text-extraction', {
            jobId,
            fileId: job.file_id,
            organizationId: job.organization_id,
            extractionMethod: job.extraction_method,
            priority: priority || job.priority,
            isRetry: true
          }, priority || job.priority)
        } else {
          return NextResponse.json({ 
            error: `Cannot retry job with status: ${job.status}` 
          }, { status: 400 })
        }
        break

      case 'update_priority':
        if (priority && priority >= 1 && priority <= 10) {
          await executeSingle(`
            UPDATE text_extraction_jobs 
            SET priority = ?
            WHERE id = ?
          `, [priority, jobId])
        } else {
          return NextResponse.json({ 
            error: 'Priority must be between 1 and 10' 
          }, { status: 400 })
        }
        break

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: cancel, retry, update_priority' 
        }, { status: 400 })
    }

    // Get updated job details
    const updatedJobs = await executeQuery(`
      SELECT 
        tej.*,
        f.name as file_name,
        f.mime_type,
        f.size_bytes
      FROM text_extraction_jobs tej
      JOIN files f ON tej.file_id = f.id
      WHERE tej.id = ?
    `, [jobId])

    return NextResponse.json({
      success: true,
      message: `Job ${action} completed successfully`,
      job: updatedJobs[0]
    })

  } catch (error) {
    console.error('Error updating extraction job:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update job'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId: jobIdParam } = await params
    const jobId = parseInt(jobIdParam)
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
    }

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

    // Only organization admins can delete jobs
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify job exists and belongs to organization
    const jobs = await executeQuery(`
      SELECT * FROM text_extraction_jobs 
      WHERE id = ? AND organization_id = ?
    `, [jobId, organizationId])

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Can only delete completed, failed, or cancelled jobs
    if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json({ 
        error: `Cannot delete job with status: ${job.status}. Cancel the job first.` 
      }, { status: 400 })
    }

    // Delete related extracted content first (due to foreign key constraints)
    await executeSingle(`
      DELETE FROM extracted_text_content WHERE extraction_job_id = ?
    `, [jobId])

    await executeSingle(`
      DELETE FROM ocr_results WHERE extraction_job_id = ?
    `, [jobId])

    // Delete the job
    await executeSingle(`
      DELETE FROM text_extraction_jobs WHERE id = ?
    `, [jobId])

    return NextResponse.json({
      success: true,
      message: 'Extraction job deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting extraction job:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete job'
    }, { status: 500 })
  }
}