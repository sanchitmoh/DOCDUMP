import { NextRequest, NextResponse } from 'next/server'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { executeQuery } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { fileId, testType = 'pdf' } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({
        success: false,
        error: 'fileId is required'
      }, { status: 400 })
    }

    const textExtractionService = createTextExtractionService()
    
    if (testType === 'pdf') {
      // Test OCR extraction on a PDF file
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
      const filePath = file.local_path || `storage/files/${file.storage_key}`
      
      console.log(`Testing OCR extraction for PDF ${fileId}: ${file.name}`)
      
      // Read the file buffer
      const fs = require('fs/promises')
      const dataBuffer = await fs.readFile(filePath)
      
      // Test the OCR extraction method directly
      const ocrResult = await textExtractionService.extractPDFWithOCR(filePath, dataBuffer)
      
      return NextResponse.json({
        success: true,
        file_info: {
          id: file.id,
          name: file.name,
          size_bytes: file.size_bytes,
          file_path: filePath
        },
        ocr_result: {
          text_length: ocrResult.text.length,
          text_preview: ocrResult.text.substring(0, 1000) + (ocrResult.text.length > 1000 ? '...' : ''),
          metadata: ocrResult.metadata
        }
      })
      
    } else if (testType === 'image') {
      // Test OCR extraction on an image file
      const files = await executeQuery(`
        SELECT f.*, fo.name as folder_name
        FROM files f
        JOIN folders fo ON f.folder_id = fo.id
        WHERE f.id = ? AND f.mime_type LIKE 'image/%' AND f.is_deleted = 0
      `, [fileId])

      if (files.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Image file not found'
        }, { status: 404 })
      }

      const file = files[0]
      const filePath = file.local_path || `storage/files/${file.storage_key}`
      
      console.log(`Testing OCR extraction for image ${fileId}: ${file.name}`)
      
      // Test the image OCR extraction
      const ocrResult = await textExtractionService.extractFromImage(filePath)
      
      return NextResponse.json({
        success: true,
        file_info: {
          id: file.id,
          name: file.name,
          size_bytes: file.size_bytes,
          mime_type: file.mime_type,
          file_path: filePath
        },
        ocr_result: {
          text_length: ocrResult.text.length,
          text_preview: ocrResult.text.substring(0, 1000) + (ocrResult.text.length > 1000 ? '...' : ''),
          metadata: ocrResult.metadata
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid testType. Use "pdf" or "image"'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('OCR test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Get available files for OCR testing
    const pdfFiles = await executeQuery(`
      SELECT f.id, f.name, f.file_type, f.size_bytes, LENGTH(etc.extracted_text) as current_text_length
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      WHERE f.file_type = 'pdf' AND f.is_deleted = 0
      ORDER BY f.id DESC
      LIMIT 5
    `)
    
    const imageFiles = await executeQuery(`
      SELECT f.id, f.name, f.mime_type, f.size_bytes
      FROM files f
      WHERE f.mime_type LIKE 'image/%' AND f.is_deleted = 0
      ORDER BY f.id DESC
      LIMIT 5
    `)

    return NextResponse.json({
      success: true,
      available_files: {
        pdf_files: pdfFiles,
        image_files: imageFiles
      },
      usage: {
        test_pdf_ocr: 'POST /api/debug/test-ocr with {"fileId": <id>, "testType": "pdf"}',
        test_image_ocr: 'POST /api/debug/test-ocr with {"fileId": <id>, "testType": "image"}'
      }
    })

  } catch (error) {
    console.error('OCR test info error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}