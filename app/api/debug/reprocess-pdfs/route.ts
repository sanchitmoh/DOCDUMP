import { NextResponse } from 'next/server'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { executeQuery } from '@/lib/database'
import { getRedisInstance } from '@/lib/cache/redis'

export async function POST() {
  try {
    const textExtractionService = createTextExtractionService()
    const redis = getRedisInstance()
    
    // Get all PDF files that have minimal text extraction (likely failed)
    const pdfFiles = await executeQuery(`
      SELECT 
        f.id,
        f.name,
        f.organization_id,
        f.file_type,
        f.size_bytes,
        LENGTH(etc.extracted_text) as current_text_length
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      WHERE f.file_type = 'pdf' 
        AND f.is_deleted = 0
        AND (etc.extracted_text IS NULL OR LENGTH(etc.extracted_text) < 100)
      ORDER BY f.id DESC
    `)

    console.log(`Found ${pdfFiles.length} PDF files that need reprocessing`)

    let queued = 0
    const results = []

    for (const file of pdfFiles) {
      try {
        // Create a new text extraction job for this PDF
        const jobResult = await textExtractionService.createExtractionJob(
          file.id,
          file.organization_id,
          'pdfplumber', // Use the improved PDF extraction method
          2 // Medium priority
        )

        if (jobResult.success) {
          results.push({
            file_id: file.id,
            name: file.name,
            status: 'queued',
            job_id: jobResult.jobId,
            current_text_length: file.current_text_length || 0
          })
          queued++
        } else {
          results.push({
            file_id: file.id,
            name: file.name,
            status: 'failed_to_queue',
            error: jobResult.error
          })
        }
      } catch (error) {
        console.error(`Error queuing PDF ${file.id}:`, error)
        results.push({
          file_id: file.id,
          name: file.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${queued} PDF files for reprocessing`,
      results: {
        total_found: pdfFiles.length,
        queued: queued,
        details: results
      }
    })

  } catch (error) {
    console.error('Reprocess PDFs error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}