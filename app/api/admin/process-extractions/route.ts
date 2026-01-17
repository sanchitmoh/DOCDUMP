
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeSingle } from '@/lib/database'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Processing pending extractions...')

    // Get pending extraction jobs
    const pendingJobs = await executeQuery(`
      SELECT tej.id, tej.file_id, tej.extraction_method, f.name, f.mime_type, fsl.location_path
      FROM text_extraction_jobs tej
      JOIN files f ON tej.file_id = f.id
      LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
      WHERE tej.status = 'pending'
      ORDER BY tej.priority DESC, tej.created_at ASC
      LIMIT 5
    `)

    if (pendingJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending extraction jobs found',
        processed: 0
      })
    }

    const results = []

    for (const job of pendingJobs) {
      try {
        console.log(`Processing job ${job.id} for file ${job.file_id} (${job.name})`)

        // Update job status to processing
        await executeSingle(`
          UPDATE text_extraction_jobs 
          SET status = 'processing', started_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [job.id])

        let extractedText = ''
        let wordCount = 0
        let metadata = {}

        // Download file from S3
        if (job.location_path) {
          const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: job.location_path
          })

          const response = await s3Client.send(getObjectCommand)
          const chunks = []
          
          for await (const chunk of response.Body) {
            chunks.push(chunk)
          }
          
          const buffer = Buffer.concat(chunks)

          // Extract text based on file type
          if (job.extraction_method === 'xlsx' || job.mime_type.includes('spreadsheet') || job.mime_type.includes('excel')) {
            // Excel extraction
            const workbook = XLSX.read(buffer, { type: 'buffer' })
            let allText = ''

            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName]
              const sheetText = XLSX.utils.sheet_to_txt(worksheet)
              allText += `Sheet: ${sheetName}\n${sheetText}\n\n`
            })

            extractedText = allText
            wordCount = allText.split(/\s+/).filter(word => word.length > 0).length
            metadata = {
              method: 'xlsx',
              sheets: workbook.SheetNames.length,
              processing_time_ms: 0
            }

          } else if (job.extraction_method === 'docx' || job.mime_type.includes('word')) {
            // Word document extraction
            const result = await mammoth.extractRawText({ buffer })
            extractedText = result.value
            wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length
            metadata = {
              method: 'docx',
              messages: result.messages,
              processing_time_ms: 0
            }

          } else {
            // For other types, try to extract as text
            extractedText = buffer.toString('utf-8')
            wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length
            metadata = {
              method: 'text',
              processing_time_ms: 0
            }
          }

          // Store extracted text
          await executeSingle(`
            INSERT INTO extracted_text_content (
              file_id, extraction_job_id, content_type, extracted_text, 
              word_count, character_count, extraction_metadata
            ) VALUES (?, ?, 'full_text', ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              extracted_text = VALUES(extracted_text),
              word_count = VALUES(word_count),
              character_count = VALUES(character_count),
              extraction_metadata = VALUES(extraction_metadata),
              updated_at = CURRENT_TIMESTAMP
          `, [
            job.file_id,
            job.id,
            extractedText,
            wordCount,
            extractedText.length,
            JSON.stringify(metadata)
          ])

          // Update job status to completed
          await executeSingle(`
            UPDATE text_extraction_jobs 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [job.id])

          results.push({
            jobId: job.id,
            fileId: job.file_id,
            fileName: job.name,
            method: job.extraction_method,
            textLength: extractedText.length,
            wordCount,
            status: 'completed'
          })

          console.log(`✅ Completed job ${job.id}: ${extractedText.length} chars, ${wordCount} words`)

        } else {
          throw new Error('No file location found')
        }

      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error)

        // Update job status to failed
        await executeSingle(`
          UPDATE text_extraction_jobs 
          SET status = 'failed', completed_at = CURRENT_TIMESTAMP, 
              error_message = ?, error_code = 'PROCESSING_ERROR'
          WHERE id = ?
        `, [error instanceof Error ? error.message : 'Unknown error', job.id])

        results.push({
          jobId: job.id,
          fileId: job.file_id,
          fileName: job.name,
          method: job.extraction_method,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const completedCount = results.filter(r => r.status === 'completed').length
    const failedCount = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} jobs: ${completedCount} completed, ${failedCount} failed`,
      processed: results.length,
      completed: completedCount,
      failed: failedCount,
      results
    })

  } catch (error) {
    console.error('❌ Extraction processing failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get extraction status
    const [statusCounts] = await executeQuery(`
      SELECT status, COUNT(*) as count
      FROM text_extraction_jobs 
      GROUP BY status
      ORDER BY count DESC
    `)

    const [recentExtractions] = await executeQuery(`
      SELECT f.id, f.name, etc.word_count, etc.character_count, etc.created_at
      FROM extracted_text_content etc
      JOIN files f ON etc.file_id = f.id
      ORDER BY etc.created_at DESC
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      jobStatus: statusCounts,
      recentExtractions,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Status check failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}