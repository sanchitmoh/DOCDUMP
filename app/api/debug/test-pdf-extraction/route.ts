import { NextRequest, NextResponse } from 'next/server'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { executeQuery } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({
        success: false,
        error: 'fileId is required'
      }, { status: 400 })
    }

    // Get PDF file info
    const files = await executeQuery(`
      SELECT f.*, fo.name as folder_name
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
      WHERE f.id = ? AND f.file_type = 'pdf' AND f.is_deleted = 0
    `, [fileId])

    if (files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'PDF file not found'
      }, { status: 404 })
    }

    const file = files[0]
    const textExtractionService = createTextExtractionService()
    
    // Get the file path (assuming it's stored locally)
    const filePath = file.local_path || `storage/files/${file.storage_key}`
    
    console.log(`Testing PDF extraction for file ${fileId}: ${file.name}`)
    console.log(`File path: ${filePath}`)
    
    // Test the improved PDF extraction
    const extractionResult = await textExtractionService.extractFromPDF(filePath)
    
    return NextResponse.json({
      success: true,
      file_info: {
        id: file.id,
        name: file.name,
        size_bytes: file.size_bytes,
        file_path: filePath
      },
      extraction_result: {
        text_length: extractionResult.text.length,
        text_preview: extractionResult.text.substring(0, 500) + (extractionResult.text.length > 500 ? '...' : ''),
        metadata: extractionResult.metadata
      }
    })

  } catch (error) {
    console.error('PDF extraction test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}