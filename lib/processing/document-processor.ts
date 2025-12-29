import { createWorker } from 'tesseract.js'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import sharp from 'sharp'
import { executeQuery, executeSingle } from '../database'

export interface DocumentMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creator?: string
  producer?: string
  createdDate?: Date
  modifiedDate?: Date
  pageCount?: number
  wordCount?: number
  characterCount?: number
  hasImages?: boolean
  hasTables?: boolean
  isEncrypted?: boolean
  language?: string
}

export interface TextExtractionResult {
  text: string
  metadata: DocumentMetadata
  confidence?: number
  language?: string
  wordCount: number
  characterCount: number
  extractionMethod: string
  processingTimeMs: number
}

export interface ProcessingJob {
  id: string
  fileId: string
  organizationId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  extractionMethod: string
  priority: number
  retryCount: number
  maxRetries: number
  errorMessage?: string
  startedAt?: Date
  completedAt?: Date
}

export class DocumentProcessor {
  private tesseractWorker: any = null

  constructor() {
    this.initializeTesseract()
  }

  /**
   * Initialize Tesseract worker for OCR
   */
  private async initializeTesseract(): Promise<void> {
    try {
      if (process.env.ENABLE_OCR === 'true') {
        this.tesseractWorker = await createWorker('eng')
        console.log('Tesseract OCR initialized successfully')
      }
    } catch (error) {
      console.error('Failed to initialize Tesseract:', error)
    }
  }

  /**
   * Extract text from various file types
   */
  async extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<TextExtractionResult> {
    const startTime = Date.now()
    
    try {
      let result: TextExtractionResult

      switch (mimeType) {
        case 'application/pdf':
          result = await this.extractFromPDF(buffer)
          break
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          result = await this.extractFromWord(buffer)
          break
        
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          result = await this.extractFromExcel(buffer)
          break
        
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          result = await this.extractFromPowerPoint(buffer)
          break
        
        case 'text/plain':
          result = await this.extractFromText(buffer)
          break
        
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
        case 'image/bmp':
          result = await this.extractFromImage(buffer, mimeType)
          break
        
        default:
          throw new Error(`Unsupported file type: ${mimeType}`)
      }

      result.processingTimeMs = Date.now() - startTime
      return result

    } catch (error) {
      console.error('Text extraction error:', error)
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from PDF files
   */
  private async extractFromPDF(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      // Import pdf-parse - it's a CommonJS module
      const pdfParseModule = await import('pdf-parse')
      // Handle both CommonJS and ESM module formats
      const pdfParse = (pdfParseModule as any).default || pdfParseModule
      const data = await pdfParse(buffer)
      
      const metadata: DocumentMetadata = {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        keywords: data.info?.Keywords,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        createdDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
        modifiedDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined,
        pageCount: data.numpages,
        isEncrypted: data.info?.IsEncrypted || false,
      }

      const text = data.text || ''
      
      return {
        text,
        metadata,
        wordCount: this.countWords(text),
        characterCount: text.length,
        extractionMethod: 'pdfparse',
        processingTimeMs: 0, // Will be set by caller
      }
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from Word documents
   */
  private async extractFromWord(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value || ''
      
      const metadata: DocumentMetadata = {
        wordCount: this.countWords(text),
        characterCount: text.length,
      }

      return {
        text,
        metadata,
        wordCount: this.countWords(text),
        characterCount: text.length,
        extractionMethod: 'mammoth',
        processingTimeMs: 0,
      }
    } catch (error) {
      throw new Error(`Word document extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from Excel files
   */
  private async extractFromExcel(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const textParts: string[] = []
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName]
        const sheetText = XLSX.utils.sheet_to_txt(worksheet)
        if (sheetText.trim()) {
          textParts.push(`Sheet: ${sheetName}\n${sheetText}`)
        }
      })
      
      const text = textParts.join('\n\n')
      
      const metadata: DocumentMetadata = {
        hasTables: true,
        wordCount: this.countWords(text),
        characterCount: text.length,
      }

      return {
        text,
        metadata,
        wordCount: this.countWords(text),
        characterCount: text.length,
        extractionMethod: 'xlsx',
        processingTimeMs: 0,
      }
    } catch (error) {
      throw new Error(`Excel extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from PowerPoint files
   */
  private async extractFromPowerPoint(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      // For PowerPoint, we'll use a simple approach
      // In production, you might want to use a more sophisticated library
      const text = buffer.toString('utf8')
      const cleanText = text.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim()
      
      const metadata: DocumentMetadata = {
        wordCount: this.countWords(cleanText),
        characterCount: cleanText.length,
      }

      return {
        text: cleanText,
        metadata,
        wordCount: this.countWords(cleanText),
        characterCount: cleanText.length,
        extractionMethod: 'basic',
        processingTimeMs: 0,
      }
    } catch (error) {
      throw new Error(`PowerPoint extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from plain text files
   */
  private async extractFromText(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      const text = buffer.toString('utf8')
      
      const metadata: DocumentMetadata = {
        wordCount: this.countWords(text),
        characterCount: text.length,
      }

      return {
        text,
        metadata,
        wordCount: this.countWords(text),
        characterCount: text.length,
        extractionMethod: 'text',
        processingTimeMs: 0,
      }
    } catch (error) {
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from images using OCR
   */
  private async extractFromImage(buffer: Buffer, mimeType: string): Promise<TextExtractionResult> {
    if (!this.tesseractWorker) {
      throw new Error('OCR is not enabled or Tesseract failed to initialize')
    }

    try {
      // Preprocess image for better OCR results
      const processedBuffer = await this.preprocessImage(buffer)
      
      const { data } = await this.tesseractWorker.recognize(processedBuffer)
      const text = data.text || ''
      const confidence = data.confidence || 0
      
      const metadata: DocumentMetadata = {
        hasImages: true,
        wordCount: this.countWords(text),
        characterCount: text.length,
      }

      return {
        text,
        metadata,
        confidence,
        language: process.env.OCR_LANGUAGE || 'eng',
        wordCount: this.countWords(text),
        characterCount: text.length,
        extractionMethod: 'tesseract',
        processingTimeMs: 0,
      }
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Preprocess image for better OCR results
   */
  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer()
    } catch (error) {
      console.warn('Image preprocessing failed, using original:', error)
      return buffer
    }
  }

  /**
   * Generate thumbnail for documents
   */
  async generateThumbnail(buffer: Buffer, mimeType: string, size: number = 200): Promise<Buffer> {
    try {
      if (mimeType.startsWith('image/')) {
        return await sharp(buffer)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer()
      }
      
      // For other file types, return a default thumbnail
      // In production, you might want to generate actual thumbnails for PDFs, etc.
      throw new Error('Thumbnail generation not supported for this file type')
      
    } catch (error) {
      throw new Error(`Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create text extraction job
   */
  async createExtractionJob(
    fileId: string,
    organizationId: string,
    extractionMethod: string,
    priority: number = 5
  ): Promise<string> {
    try {
      const result = await executeSingle(
        `INSERT INTO text_extraction_jobs 
         (file_id, organization_id, extraction_method, priority, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [fileId, organizationId, extractionMethod, priority]
      )

      return result.insertId.toString()
    } catch (error) {
      throw new Error(`Failed to create extraction job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process extraction job
   */
  async processExtractionJob(jobId: string): Promise<void> {
    try {
      // Get job details
      const jobs = await executeQuery<{
        id: string
        file_id: string
        organization_id: string
        extraction_method: string
        status: string
      }>('SELECT * FROM text_extraction_jobs WHERE id = ? AND status = ?', [jobId, 'pending'])

      if (jobs.length === 0) {
        throw new Error('Extraction job not found or not pending')
      }

      const job = jobs[0]

      // Update job status to processing
      await executeSingle(
        'UPDATE text_extraction_jobs SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['processing', jobId]
      )

      // Get file information
      const files = await executeQuery<{
        id: string
        name: string
        mime_type: string
        storage_key: string
        organization_id: string
      }>('SELECT * FROM files WHERE id = ?', [job.file_id])

      if (files.length === 0) {
        throw new Error('File not found')
      }

      const file = files[0]

      // TODO: Download file from storage and extract text
      // This would integrate with the storage services
      
      // For now, mark as completed
      await executeSingle(
        'UPDATE text_extraction_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', jobId]
      )

    } catch (error) {
      console.error('Process extraction job error:', error)
      
      // Update job status to failed
      await executeSingle(
        'UPDATE text_extraction_jobs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['failed', error instanceof Error ? error.message : 'Unknown error', jobId]
      )

      throw error
    }
  }

  /**
   * Store extracted text content
   */
  async storeExtractedText(
    fileId: string,
    extractionJobId: string,
    result: TextExtractionResult
  ): Promise<void> {
    try {
      await executeSingle(
        `INSERT INTO extracted_text_content 
         (file_id, extraction_job_id, content_type, extracted_text, language, confidence_score, 
          word_count, character_count, extraction_metadata, created_at)
         VALUES (?, ?, 'full_text', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          fileId,
          extractionJobId,
          result.text,
          result.language || null,
          result.confidence || null,
          result.wordCount,
          result.characterCount,
          JSON.stringify({
            extractionMethod: result.extractionMethod,
            processingTimeMs: result.processingTimeMs,
            metadata: result.metadata
          })
        ]
      )
    } catch (error) {
      throw new Error(`Failed to store extracted text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get pending extraction jobs
   */
  async getPendingJobs(limit: number = 10): Promise<ProcessingJob[]> {
    try {
      // Ensure limit is a valid integer and use string interpolation to avoid parameter binding issues
      const limitValue = Math.max(1, Math.min(100, Math.floor(Number(limit))))
      
      const jobs = await executeQuery<{
        id: string
        file_id: string
        organization_id: string
        status: string
        extraction_method: string
        priority: number
        retry_count: number
        max_retries: number
        error_message?: string
        started_at?: Date
        completed_at?: Date
        created_at: Date
      }>(
        `SELECT * FROM text_extraction_jobs 
         WHERE status = 'pending' 
         ORDER BY priority DESC, created_at ASC 
         LIMIT ${limitValue}`
      )
      

      return jobs.map(job => ({
        id: job.id,
        fileId: job.file_id,
        organizationId: job.organization_id,
        status: job.status as any,
        extractionMethod: job.extraction_method,
        priority: job.priority,
        retryCount: job.retry_count,
        maxRetries: job.max_retries,
        errorMessage: job.error_message,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      }))
    } catch (error) {
      throw new Error(`Failed to get pending jobs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text || !text.trim()) return 0
    return text.trim().split(/\s+/).length
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate()
      this.tesseractWorker = null
    }
  }
}

// Factory function to create document processor instance
export function createDocumentProcessor(): DocumentProcessor {
  return new DocumentProcessor()
}