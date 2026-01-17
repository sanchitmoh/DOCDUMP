/**
 * Serverless-Compatible Extraction Service
 * 
 * This service handles immediate extraction processing in serverless environments
 * where background processors don't work. It processes extractions synchronously
 * during the upload flow or via API triggers.
 */

import { executeQuery, executeSingle } from '@/lib/database'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { createAWSTextractService } from './aws-textract'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

export interface ExtractionOptions {
  enableAI?: boolean
  enableOCR?: boolean
  enableTextract?: boolean
  priority?: number
  timeout?: number
}

export interface ExtractionResult {
  success: boolean
  fileId: number
  method: string
  textLength: number
  wordCount: number
  processingTimeMs: number
  error?: string
}

export class ServerlessExtractionService {
  private textractService = createAWSTextractService()

  /**
   * Process extraction immediately (serverless-compatible)
   */
  async processExtractionImmediate(
    fileId: number,
    organizationId: number,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now()
    
    try {
      console.log(`🚀 Starting immediate extraction for file ${fileId}`)

      // Get file information
      const files = await executeQuery(`
        SELECT f.id, f.name, f.mime_type, f.size_bytes, fsl.location_path, fsl.storage_type
        FROM files f
        LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
        WHERE f.id = ? AND f.organization_id = ?
      `, [fileId, organizationId])

      if (files.length === 0) {
        throw new Error(`File ${fileId} not found`)
      }

      const file = files[0]
      console.log(`📄 Processing: ${file.name} (${file.mime_type})`)

      // Create extraction job record
      const jobResult = await executeSingle(`
        INSERT INTO text_extraction_jobs (
          file_id, organization_id, extraction_method, priority, status, started_at
        ) VALUES (?, ?, ?, ?, 'processing', CURRENT_TIMESTAMP)
      `, [
        fileId,
        organizationId,
        this.determineExtractionMethod(file.mime_type),
        options.priority || 8
      ])

      const jobId = jobResult.insertId

      try {
        // Download and extract
        const extractionResult = await this.extractFromFile(file, options)

        // Store extracted text
        await this.storeExtractedText(fileId, jobId, extractionResult)

        // Update job status
        await executeSingle(`
          UPDATE text_extraction_jobs 
          SET status = 'completed', completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [jobId])

        // Trigger search indexing
        await this.triggerSearchIndexing(fileId, organizationId)

        const processingTime = Date.now() - startTime
        console.log(`✅ Extraction completed for file ${fileId} in ${processingTime}ms`)

        return {
          success: true,
          fileId,
          method: extractionResult.method,
          textLength: extractionResult.text.length,
          wordCount: extractionResult.wordCount,
          processingTimeMs: processingTime
        }

      } catch (error) {
        // Update job status to failed
        await executeSingle(`
          UPDATE text_extraction_jobs 
          SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_message = ?
          WHERE id = ?
        `, [error instanceof Error ? error.message : 'Unknown error', jobId])

        throw error
      }

    } catch (error) {
      const processingTime = Date.now() - startTime
      console.error(`❌ Extraction failed for file ${fileId}:`, error)

      return {
        success: false,
        fileId,
        method: 'failed',
        textLength: 0,
        wordCount: 0,
        processingTimeMs: processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Extract text from file based on type
   */
  private async extractFromFile(file: any, options: ExtractionOptions): Promise<{
    text: string
    wordCount: number
    method: string
    metadata: any
  }> {
    let buffer: Buffer

    // Download file from S3
    if (file.storage_type === 's3' && file.location_path) {
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: file.location_path
      })

      const response = await s3Client.send(getObjectCommand)
      const chunks = []
      
      for await (const chunk of response.Body) {
        chunks.push(chunk)
      }
      
      buffer = Buffer.concat(chunks)
      console.log(`📥 Downloaded ${buffer.length} bytes from S3`)
    } else {
      throw new Error('File not found in S3 storage')
    }

    // Extract based on file type
    const mimeType = file.mime_type.toLowerCase()

    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      return await this.extractFromExcel(buffer)
    } else if (mimeType.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      return await this.extractFromWord(buffer)
    } else if (mimeType.includes('pdf')) {
      return await this.extractFromPDF(buffer, file, options)
    } else if (mimeType.startsWith('image/')) {
      return await this.extractFromImage(buffer, file, options)
    } else if (mimeType.includes('text') || file.name.endsWith('.txt')) {
      return await this.extractFromText(buffer)
    } else {
      // Try as text fallback
      return await this.extractFromText(buffer)
    }
  }

  /**
   * Extract from Excel files
   */
  private async extractFromExcel(buffer: Buffer): Promise<{
    text: string
    wordCount: number
    method: string
    metadata: any
  }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    let allText = ''
    const sheets: any = {}

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName]
      const sheetText = XLSX.utils.sheet_to_txt(worksheet)
      allText += `Sheet: ${sheetName}\n${sheetText}\n\n`
      
      sheets[sheetName] = {
        text_length: sheetText.length,
        range: worksheet['!ref']
      }
    })

    const wordCount = allText.split(/\s+/).filter(word => word.length > 0).length

    return {
      text: allText,
      wordCount,
      method: 'xlsx',
      metadata: {
        sheets: workbook.SheetNames,
        sheet_count: workbook.SheetNames.length,
        sheet_details: sheets
      }
    }
  }

  /**
   * Extract from Word documents
   */
  private async extractFromWord(buffer: Buffer): Promise<{
    text: string
    wordCount: number
    method: string
    metadata: any
  }> {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length

    return {
      text,
      wordCount,
      method: 'docx',
      metadata: {
        messages: result.messages,
        text_length: text.length
      }
    }
  }

  /**
   * Extract from PDF files
   */
  private async extractFromPDF(buffer: Buffer, file: any, options: ExtractionOptions): Promise<{
    text: string
    wordCount: number
    method: string
    metadata: any
  }> {
    // Try AWS Textract first if enabled and file is suitable
    if (options.enableTextract && buffer.length <= 10 * 1024 * 1024) { // 10MB limit for sync
      try {
        console.log('🔍 Trying AWS Textract for PDF...')
        
        // Create temporary file for Textract
        const tempPath = `/tmp/temp_${Date.now()}.pdf`
        require('fs').writeFileSync(tempPath, buffer)
        
        const textractResult = await this.textractService.extractTextSync(tempPath)
        
        // Clean up temp file
        try {
          require('fs').unlinkSync(tempPath)
        } catch {}

        if (textractResult.text && textractResult.text.length > 50) {
          const wordCount = textractResult.text.split(/\s+/).filter(w => w.length > 0).length
          
          return {
            text: textractResult.text,
            wordCount,
            method: 'aws-textract',
            metadata: textractResult.metadata
          }
        }
      } catch (error) {
        console.log('⚠️ Textract failed, trying fallback:', error.message)
      }
    }

    // Fallback to basic PDF extraction
    try {
      // Add DOMMatrix polyfill for serverless
      if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
        (global as any).DOMMatrix = class DOMMatrix {
          constructor() {}
        }
      }

      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer, { max: 0 })
      
      if (data.text && data.text.length > 10) {
        const wordCount = data.text.split(/\s+/).filter(w => w.length > 0).length
        
        return {
          text: data.text,
          wordCount,
          method: 'pdf-parse',
          metadata: {
            pages: data.numpages,
            info: data.info
          }
        }
      }
    } catch (error) {
      console.log('⚠️ PDF-parse failed:', error.message)
    }

    // Final fallback - extract text from buffer
    const text = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r]/g, ' ').trim()
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length

    return {
      text,
      wordCount,
      method: 'buffer-fallback',
      metadata: {
        note: 'Extracted using buffer fallback method'
      }
    }
  }

  /**
   * Extract from images using OCR
   */
  private async extractFromImage(buffer: Buffer, file: any, options: ExtractionOptions): Promise<{
    text: string
    wordCount: number
    method: string
    metadata: any
  }> {
    if (options.enableTextract) {
      try {
        console.log('🔍 Using AWS Textract for image OCR...')
        
        // Create temporary file for Textract
        const tempPath = `/tmp/temp_${Date.now()}.${file.name.split('.').pop()}`
        require('fs').writeFileSync(tempPath, buffer)
        
        const textractResult = await this.textractService.extractTextSync(tempPath)
        
        // Clean up temp file
        try {
          require('fs').unlinkSync(tempPath)
        } catch {}

        const wordCount = textractResult.text.split(/\s+/).filter(w => w.length > 0).length
        
        return {
          text: textractResult.text,
          wordCount,
          method: 'aws-textract-ocr',
          metadata: textractResult.metadata
        }
      } catch (error) {
        console.log('⚠️ Textract OCR failed:', error.message)
      }
    }

    // Fallback - no text from image
    return {
      text: '',
      wordCount: 0,
      method: 'image-no-ocr',
      metadata: {
        note: 'Image file - OCR not available or failed'
      }
    }
  }

  /**
   * Extract from text files
   */
  private async extractFromText(buffer: Buffer): Promise<{
    text: string
    wordCount: number
    method: string
    metadata: any
  }> {
    const text = buffer.toString('utf8')
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length

    return {
      text,
      wordCount,
      method: 'text',
      metadata: {
        encoding: 'utf8',
        text_length: text.length
      }
    }
  }

  /**
   * Store extracted text in database
   */
  private async storeExtractedText(fileId: number, jobId: number, result: any): Promise<void> {
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
      fileId,
      jobId,
      result.text,
      result.wordCount,
      result.text.length,
      JSON.stringify({
        method: result.method,
        ...result.metadata,
        processed_at: new Date().toISOString()
      })
    ])
  }

  /**
   * Trigger search indexing (immediate)
   */
  private async triggerSearchIndexing(fileId: number, organizationId: number): Promise<void> {
    try {
      // In serverless, we can trigger indexing via API call
      // For now, just update the status to indicate indexing is needed
      await executeSingle(`
        INSERT INTO search_index_status (
          file_id, organization_id, index_status, updated_at
        ) VALUES (?, ?, 'needs_reindex', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          index_status = 'needs_reindex',
          updated_at = CURRENT_TIMESTAMP
      `, [fileId, organizationId])
    } catch (error) {
      console.error('⚠️ Failed to trigger search indexing:', error)
    }
  }

  /**
   * Determine extraction method based on MIME type
   */
  private determineExtractionMethod(mimeType: string): string {
    const mime = mimeType.toLowerCase()
    
    if (mime.includes('excel') || mime.includes('spreadsheet')) return 'xlsx'
    if (mime.includes('word')) return 'docx'
    if (mime.includes('pdf')) return 'pdfplumber'
    if (mime.startsWith('image/')) return 'textract'
    if (mime.includes('text')) return 'text'
    
    return 'auto'
  }

  /**
   * Process all pending extractions (batch processing)
   */
  async processPendingExtractions(limit: number = 5): Promise<{
    processed: number
    successful: number
    failed: number
    results: ExtractionResult[]
  }> {
    const results: ExtractionResult[] = []
    
    try {
      // Get pending jobs
      const pendingJobs = await executeQuery(`
        SELECT tej.id, tej.file_id, tej.organization_id, f.name
        FROM text_extraction_jobs tej
        JOIN files f ON tej.file_id = f.id
        WHERE tej.status = 'pending'
        ORDER BY tej.priority DESC, tej.created_at ASC
        LIMIT ?
      `, [limit])

      console.log(`🔄 Processing ${pendingJobs.length} pending extractions...`)

      for (const job of pendingJobs) {
        const result = await this.processExtractionImmediate(
          job.file_id,
          job.organization_id,
          { enableTextract: true, priority: 8 }
        )
        results.push(result)
      }

      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      return {
        processed: results.length,
        successful,
        failed,
        results
      }

    } catch (error) {
      console.error('❌ Batch processing failed:', error)
      return {
        processed: 0,
        successful: 0,
        failed: 1,
        results: []
      }
    }
  }
}

// Factory function
export function createServerlessExtractionService(): ServerlessExtractionService {
  return new ServerlessExtractionService()
}