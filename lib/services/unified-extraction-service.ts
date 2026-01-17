/**
 * Unified Text Extraction Service
 * 
 * Integrates all extraction methods with AI processing and background jobs
 * Supports: PDF, DOCX, XLSX, PPTX, Images, Text files, and more
 * Features: OCR, AI analysis, background processing, comprehensive storage
 */

import { executeQuery, executeSingle } from '@/lib/database'
import { createAWSTextractService } from './aws-textract'
import { createEnhancedTextExtractionService } from './enhanced-text-extraction'
import { getRedisInstance } from '@/lib/cache/redis'
import OpenAI from 'openai'
import * as fs from 'fs/promises'
import * as path from 'path'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import sharp from 'sharp'

export interface UnifiedExtractionJob {
  id: number
  file_id: number
  organization_id: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  extraction_methods: string[] // Multiple methods can be tried
  ai_processing: boolean
  priority: number
  retry_count: number
  max_retries: number
  error_message?: string
  error_code?: string
  started_at?: Date
  completed_at?: Date
  created_at: Date
  updated_at: Date
}

export interface ExtractionResult {
  text: string
  metadata: {
    method: string
    confidence?: number
    pages?: number
    words: number
    characters: number
    language?: string
    processing_time_ms: number
    file_size: number
    extraction_attempts: string[]
    structured_data?: {
      tables: any[]
      forms: any[]
      images: any[]
      charts: any[]
    }
    ai_analysis?: {
      summary: string
      key_topics: string[]
      sentiment: string
      language_detected: string
      document_type: string
      quality_score: number
    }
  }
  success: boolean
  error?: string
}

export interface AIAnalysisResult {
  summary: string
  key_topics: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  language_detected: string
  document_type: string
  quality_score: number
  entities: Array<{
    text: string
    type: string
    confidence: number
  }>
  keywords: string[]
  readability_score: number
}

export class UnifiedExtractionService {
  private redis = getRedisInstance()
  private textractService = createAWSTextractService()
  private enhancedService = createEnhancedTextExtractionService()
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  /**
   * Main extraction method - handles all file types with AI processing
   */
  async extractWithAI(
    filePath: string,
    fileId: number,
    organizationId: number,
    options: {
      enableAI?: boolean
      enableOCR?: boolean
      preferredMethods?: string[]
      priority?: number
    } = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now()
    const attempts: string[] = []

    try {
      console.log(`🚀 Starting unified extraction for: ${path.basename(filePath)}`)

      // Get file information
      const stats = await fs.stat(filePath)
      const fileSize = stats.size
      const fileExt = path.extname(filePath).toLowerCase()
      const mimeType = this.getMimeType(fileExt)

      // Step 1: Extract text using multiple methods
      const extractionResult = await this.extractTextComprehensive(
        filePath, 
        mimeType, 
        fileSize, 
        attempts,
        options
      )

      // Step 2: AI Analysis (if enabled and text extracted)
      let aiAnalysis: AIAnalysisResult | undefined
      if (options.enableAI && extractionResult.text.length > 50) {
        try {
          console.log('🤖 Starting AI analysis...')
          aiAnalysis = await this.analyzeWithAI(extractionResult.text, mimeType)
          attempts.push('ai-analysis: success')
        } catch (error) {
          console.warn('AI analysis failed:', (error as Error).message)
          attempts.push(`ai-analysis: ${(error as Error).message}`)
        }
      }

      // Step 3: Store results in database
      await this.storeExtractionResults(
        fileId,
        organizationId,
        extractionResult,
        aiAnalysis
      )

      // Step 4: Update search index
      await this.updateSearchIndex(fileId, organizationId, extractionResult.text)

      const finalResult: ExtractionResult = {
        ...extractionResult,
        metadata: {
          ...extractionResult.metadata,
          processing_time_ms: Date.now() - startTime,
          file_size: fileSize,
          extraction_attempts: attempts,
          ai_analysis: aiAnalysis
        }
      }

      console.log(`✅ Unified extraction completed: ${finalResult.text.length} chars in ${finalResult.metadata.processing_time_ms}ms`)

      return finalResult

    } catch (error) {
      console.error('❌ Unified extraction failed:', error)
      
      const errorResult: ExtractionResult = {
        text: '',
        metadata: {
          method: 'failed',
          words: 0,
          characters: 0,
          processing_time_ms: Date.now() - startTime,
          file_size: 0,
          extraction_attempts: attempts
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      // Store error in database
      await this.storeExtractionError(fileId, organizationId, errorResult)

      return errorResult
    }
  }

  /**
   * Comprehensive text extraction using all available methods
   */
  private async extractTextComprehensive(
    filePath: string,
    mimeType: string,
    fileSize: number,
    attempts: string[],
    options: any
  ): Promise<ExtractionResult> {
    const fileExt = path.extname(filePath).toLowerCase()
    const results: Array<{ method: string; result: ExtractionResult }> = []

    // Define extraction methods based on file type
    const methods = this.getExtractionMethods(fileExt, options)

    // Try each method
    for (const method of methods) {
      try {
        console.log(`🔄 Trying ${method} extraction...`)
        attempts.push(method)

        let result: ExtractionResult

        switch (method) {
          case 'textract':
            result = await this.extractWithTextract(filePath, false)
            break
          case 'textract-analysis':
            result = await this.extractWithTextract(filePath, true)
            break
          case 'enhanced-pdf':
            result = await this.extractPDFEnhanced(filePath, fileSize)
            break
          case 'docx':
            result = await this.extractDOCX(filePath)
            break
          case 'xlsx':
            result = await this.extractXLSX(filePath)
            break
          case 'pptx':
            result = await this.extractPPTX(filePath)
            break
          case 'image-ocr':
            result = await this.extractImageOCR(filePath)
            break
          case 'text':
            result = await this.extractText(filePath)
            break
          case 'csv':
            result = await this.extractCSV(filePath)
            break
          default:
            continue
        }

        if (result.success && result.text.length > 10) {
          results.push({ method, result })
          attempts.push(`${method}: success (${result.text.length} chars)`)
          console.log(`✅ ${method}: ${result.text.length} characters extracted`)
        } else {
          attempts.push(`${method}: insufficient text`)
        }

      } catch (error) {
        attempts.push(`${method}: ${(error as Error).message}`)
        console.log(`❌ ${method} failed:`, (error as Error).message)
      }
    }

    // Select best result
    if (results.length === 0) {
      return {
        text: '',
        metadata: {
          method: 'all-failed',
          words: 0,
          characters: 0,
          processing_time_ms: 0,
          file_size: fileSize,
          extraction_attempts: attempts
        },
        success: false,
        error: 'All extraction methods failed'
      }
    }

    // Sort by text length and confidence
    const bestResult = results.sort((a, b) => {
      const lengthDiff = b.result.text.length - a.result.text.length
      if (lengthDiff !== 0) return lengthDiff
      
      const aConf = a.result.metadata.confidence || 0
      const bConf = b.result.metadata.confidence || 0
      return bConf - aConf
    })[0]

    console.log(`🏆 Best result: ${bestResult.method} with ${bestResult.result.text.length} characters`)

    return {
      ...bestResult.result,
      metadata: {
        ...bestResult.result.metadata,
        method: `unified-${bestResult.method}`,
        all_attempts: results.map(r => ({
          method: r.method,
          success: r.result.success,
          length: r.result.text.length,
          confidence: r.result.metadata.confidence
        }))
      }
    }
  }

  /**
   * Get appropriate extraction methods for file type
   */
  private getExtractionMethods(fileExt: string, options: any): string[] {
    const methods: string[] = []

    switch (fileExt) {
      case '.pdf':
        if (options.enableOCR) {
          methods.push('textract-analysis', 'textract', 'enhanced-pdf')
        } else {
          methods.push('enhanced-pdf', 'textract')
        }
        break
      
      case '.docx':
      case '.doc':
        methods.push('docx')
        if (options.enableOCR) methods.push('textract')
        break
      
      case '.xlsx':
      case '.xls':
        methods.push('xlsx')
        break
      
      case '.pptx':
      case '.ppt':
        methods.push('pptx')
        if (options.enableOCR) methods.push('textract')
        break
      
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.tiff':
      case '.tif':
      case '.bmp':
      case '.gif':
        methods.push('textract', 'image-ocr')
        break
      
      case '.txt':
      case '.md':
      case '.rtf':
        methods.push('text')
        break
      
      case '.csv':
        methods.push('csv', 'text')
        break
      
      default:
        // Try OCR for unknown types
        if (options.enableOCR) {
          methods.push('textract', 'image-ocr')
        }
        methods.push('text')
    }

    // Add preferred methods first
    if (options.preferredMethods) {
      return [...options.preferredMethods, ...methods.filter(m => !options.preferredMethods.includes(m))]
    }

    return methods
  }

  /**
   * Extract with AWS Textract
   */
  private async extractWithTextract(filePath: string, useAnalysis: boolean): Promise<ExtractionResult> {
    const result = useAnalysis 
      ? await this.textractService.analyzeDocumentAuto(filePath, ['TABLES', 'FORMS'])
      : await this.textractService.extractTextAuto(filePath)

    const structuredData = useAnalysis && 'tables' in result ? {
      tables: result.tables || [],
      forms: result.forms || [],
      images: [],
      charts: []
    } : undefined

    return {
      text: result.text,
      metadata: {
        method: useAnalysis ? 'textract-analysis' : 'textract',
        confidence: result.confidence,
        pages: result.metadata.pages,
        words: result.metadata.words,
        characters: result.text.length,
        processing_time_ms: result.metadata.processing_time_ms,
        file_size: 0,
        extraction_attempts: [],
        structured_data: structuredData
      },
      success: true
    }
  }

  /**
   * Enhanced PDF extraction
   */
  private async extractPDFEnhanced(filePath: string, fileSize: number): Promise<ExtractionResult> {
    const result = await this.enhancedService.extractText(filePath, 'application/pdf', fileSize)
    
    return {
      text: result.text,
      metadata: {
        method: 'enhanced-pdf',
        confidence: result.metadata.confidence,
        pages: result.metadata.pageCount,
        words: result.metadata.wordCount,
        characters: result.metadata.characterCount,
        processing_time_ms: result.metadata.processingTimeMs,
        file_size: fileSize,
        extraction_attempts: result.metadata.extractionAttempts
      },
      success: result.success,
      error: result.error
    }
  }

  /**
   * DOCX extraction
   */
  private async extractDOCX(filePath: string): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ path: filePath })
    const wordCount = result.value.split(/\s+/).filter(w => w.length > 0).length

    return {
      text: result.value,
      metadata: {
        method: 'docx',
        words: wordCount,
        characters: result.value.length,
        processing_time_ms: 0,
        file_size: 0,
        extraction_attempts: ['mammoth: success']
      },
      success: true
    }
  }

  /**
   * XLSX extraction with enhanced table processing
   */
  private async extractXLSX(filePath: string): Promise<ExtractionResult> {
    const buffer = await fs.readFile(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    let allText = ''
    const tables: any[] = []

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName]
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      const sheetText = XLSX.utils.sheet_to_txt(worksheet)
      
      allText += `Sheet: ${sheetName}\n${sheetText}\n\n`
      
      // Extract table structure
      if (sheetData.length > 0) {
        tables.push({
          name: sheetName,
          rows: sheetData,
          confidence: 100,
          page: 1
        })
      }
    })

    const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length

    return {
      text: allText,
      metadata: {
        method: 'xlsx',
        words: wordCount,
        characters: allText.length,
        pages: workbook.SheetNames.length,
        processing_time_ms: 0,
        file_size: 0,
        extraction_attempts: ['xlsx: success'],
        structured_data: {
          tables,
          forms: [],
          images: [],
          charts: []
        }
      },
      success: true
    }
  }

  /**
   * PPTX extraction
   */
  private async extractPPTX(filePath: string): Promise<ExtractionResult> {
    // For now, return placeholder - would need pptx parsing library
    return {
      text: '',
      metadata: {
        method: 'pptx-placeholder',
        words: 0,
        characters: 0,
        processing_time_ms: 0,
        file_size: 0,
        extraction_attempts: ['pptx: not implemented']
      },
      success: false,
      error: 'PPTX extraction not yet implemented'
    }
  }

  /**
   * Image OCR extraction
   */
  private async extractImageOCR(filePath: string): Promise<ExtractionResult> {
    try {
      // Preprocess image
      const processedPath = await this.preprocessImage(filePath)
      
      // Use Tesseract (fallback if Textract fails)
      const { createWorker } = require('tesseract.js')
      const worker = await createWorker('eng')
      
      const { data: { text, confidence } } = await worker.recognize(processedPath)
      await worker.terminate()

      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length

      return {
        text: text.trim(),
        metadata: {
          method: 'tesseract-ocr',
          confidence: Math.round(confidence),
          words: wordCount,
          characters: text.length,
          processing_time_ms: 0,
          file_size: 0,
          extraction_attempts: ['tesseract: success']
        },
        success: true
      }
    } catch (error) {
      return {
        text: '',
        metadata: {
          method: 'ocr-failed',
          words: 0,
          characters: 0,
          processing_time_ms: 0,
          file_size: 0,
          extraction_attempts: [`ocr: ${(error as Error).message}`]
        },
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * Text file extraction
   */
  private async extractText(filePath: string): Promise<ExtractionResult> {
    const text = await fs.readFile(filePath, 'utf-8')
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length

    return {
      text,
      metadata: {
        method: 'text-file',
        words: wordCount,
        characters: text.length,
        processing_time_ms: 0,
        file_size: 0,
        extraction_attempts: ['text-file: success']
      },
      success: true
    }
  }

  /**
   * CSV extraction
   */
  private async extractCSV(filePath: string): Promise<ExtractionResult> {
    const csvText = await fs.readFile(filePath, 'utf-8')
    const lines = csvText.split('\n')
    const wordCount = csvText.split(/\s+/).filter(w => w.length > 0).length

    // Parse CSV structure
    const rows = lines.map(line => line.split(','))
    const tables = [{
      name: 'CSV Data',
      rows,
      confidence: 100,
      page: 1
    }]

    return {
      text: csvText,
      metadata: {
        method: 'csv',
        words: wordCount,
        characters: csvText.length,
        processing_time_ms: 0,
        file_size: 0,
        extraction_attempts: ['csv: success'],
        structured_data: {
          tables,
          forms: [],
          images: [],
          charts: []
        }
      },
      success: true
    }
  }

  /**
   * AI Analysis of extracted text
   */
  private async analyzeWithAI(text: string, mimeType: string): Promise<AIAnalysisResult> {
    const prompt = `Analyze the following document text and provide a comprehensive analysis:

Document Type: ${mimeType}
Text: ${text.substring(0, 4000)}...

Please provide:
1. A concise summary (2-3 sentences)
2. Key topics (5-10 topics)
3. Sentiment analysis (positive/negative/neutral)
4. Detected language
5. Document type classification
6. Quality score (1-10)
7. Named entities
8. Keywords
9. Readability score (1-10)

Respond in JSON format.`

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_CHAT || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No AI response received')

    try {
      const analysis = JSON.parse(content)
      return {
        summary: analysis.summary || 'No summary available',
        key_topics: analysis.key_topics || [],
        sentiment: analysis.sentiment || 'neutral',
        language_detected: analysis.language_detected || 'unknown',
        document_type: analysis.document_type || 'unknown',
        quality_score: analysis.quality_score || 5,
        entities: analysis.entities || [],
        keywords: analysis.keywords || [],
        readability_score: analysis.readability_score || 5
      }
    } catch (error) {
      console.warn('Failed to parse AI response, using fallback')
      return {
        summary: 'AI analysis completed but response format was invalid',
        key_topics: [],
        sentiment: 'neutral',
        language_detected: 'unknown',
        document_type: 'unknown',
        quality_score: 5,
        entities: [],
        keywords: [],
        readability_score: 5
      }
    }
  }

  /**
   * Preprocess image for better OCR
   */
  private async preprocessImage(filePath: string): Promise<string> {
    const outputPath = filePath.replace(/\.(jpg|jpeg|png|gif)$/i, '_processed.png')
    
    await sharp(filePath)
      .greyscale()
      .normalize()
      .sharpen()
      .threshold(128)
      .toFile(outputPath)

    return outputPath
  }

  /**
   * Store extraction results in database
   */
  private async storeExtractionResults(
    fileId: number,
    organizationId: number,
    result: ExtractionResult,
    aiAnalysis?: AIAnalysisResult
  ): Promise<void> {
    try {
      // Store extracted text
      await executeSingle(`
        INSERT INTO extracted_text_content (
          file_id, content_type, extracted_text, word_count, character_count, 
          extraction_metadata, confidence_score, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          extracted_text = VALUES(extracted_text),
          word_count = VALUES(word_count),
          character_count = VALUES(character_count),
          extraction_metadata = VALUES(extraction_metadata),
          confidence_score = VALUES(confidence_score),
          updated_at = CURRENT_TIMESTAMP
      `, [
        fileId,
        'full_text',
        result.text,
        result.metadata.words,
        result.metadata.characters,
        JSON.stringify(result.metadata),
        result.metadata.confidence || null,
        result.metadata.language || null
      ])

      // Store OCR results if applicable
      if (result.metadata.method.includes('textract') || result.metadata.method.includes('ocr')) {
        const ocrEngine = result.metadata.method.includes('textract') ? 'aws_textract' : 'tesseract'
        
        await executeSingle(`
          INSERT INTO ocr_results (
            file_id, ocr_engine, language, confidence_score, word_count,
            detected_text_regions, processing_time_ms, ocr_text, ocr_data_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            confidence_score = VALUES(confidence_score),
            word_count = VALUES(word_count),
            processing_time_ms = VALUES(processing_time_ms),
            ocr_text = VALUES(ocr_text),
            ocr_data_json = VALUES(ocr_data_json),
            updated_at = CURRENT_TIMESTAMP
        `, [
          fileId,
          ocrEngine,
          result.metadata.language || 'eng',
          result.metadata.confidence || null,
          result.metadata.words,
          result.metadata.structured_data?.tables?.length || null,
          result.metadata.processing_time_ms,
          result.text,
          JSON.stringify(result.metadata)
        ])
      }

      // Store AI analysis if available
      if (aiAnalysis) {
        await executeSingle(`
          INSERT INTO ai_analysis_results (
            file_id, organization_id, summary, key_topics, sentiment,
            language_detected, document_type, quality_score, entities,
            keywords, readability_score, analysis_metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            summary = VALUES(summary),
            key_topics = VALUES(key_topics),
            sentiment = VALUES(sentiment),
            language_detected = VALUES(language_detected),
            document_type = VALUES(document_type),
            quality_score = VALUES(quality_score),
            entities = VALUES(entities),
            keywords = VALUES(keywords),
            readability_score = VALUES(readability_score),
            analysis_metadata = VALUES(analysis_metadata),
            updated_at = CURRENT_TIMESTAMP
        `, [
          fileId,
          organizationId,
          aiAnalysis.summary,
          JSON.stringify(aiAnalysis.key_topics),
          aiAnalysis.sentiment,
          aiAnalysis.language_detected,
          aiAnalysis.document_type,
          aiAnalysis.quality_score,
          JSON.stringify(aiAnalysis.entities),
          JSON.stringify(aiAnalysis.keywords),
          aiAnalysis.readability_score,
          JSON.stringify(aiAnalysis)
        ])
      }

      console.log(`✅ Extraction results stored for file ${fileId}`)

    } catch (error) {
      console.error('Error storing extraction results:', error)
      throw error
    }
  }

  /**
   * Store extraction error
   */
  private async storeExtractionError(
    fileId: number,
    organizationId: number,
    result: ExtractionResult
  ): Promise<void> {
    try {
      await executeSingle(`
        INSERT INTO extraction_errors (
          file_id, organization_id, error_message, extraction_attempts, metadata
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        fileId,
        organizationId,
        result.error || 'Unknown error',
        JSON.stringify(result.metadata.extraction_attempts),
        JSON.stringify(result.metadata)
      ])
    } catch (error) {
      console.error('Error storing extraction error:', error)
    }
  }

  /**
   * Update search index
   */
  private async updateSearchIndex(
    fileId: number,
    organizationId: number,
    text: string
  ): Promise<void> {
    try {
      await executeSingle(`
        INSERT INTO search_index_status (
          file_id, organization_id, index_status, indexed_at
        ) VALUES (?, ?, 'needs_reindex', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          index_status = 'needs_reindex',
          updated_at = CURRENT_TIMESTAMP
      `, [fileId, organizationId])

      console.log(`✅ Search index updated for file ${fileId}`)
    } catch (error) {
      console.error('Error updating search index:', error)
    }
  }

  /**
   * Create background extraction job
   */
  async createBackgroundJob(
    fileId: number,
    organizationId: number,
    filePath: string,
    options: {
      enableAI?: boolean
      enableOCR?: boolean
      preferredMethods?: string[]
      priority?: number
    } = {}
  ): Promise<{ success: boolean; jobId?: number; error?: string }> {
    try {
      const result = await executeSingle(`
        INSERT INTO unified_extraction_jobs (
          file_id, organization_id, extraction_methods, ai_processing, priority, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `, [
        fileId,
        organizationId,
        JSON.stringify(options.preferredMethods || []),
        options.enableAI || false,
        options.priority || 5
      ])

      const jobId = result.insertId

      // Add to Redis queue
      await this.redis.addJob('unified-extraction', {
        jobId,
        fileId,
        organizationId,
        filePath,
        options
      }, options.priority || 5)

      return { success: true, jobId }
    } catch (error) {
      console.error('Error creating background job:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Process background job
   */
  async processBackgroundJob(jobId: number): Promise<void> {
    try {
      // Get job details
      const jobs = await executeQuery(`
        SELECT * FROM unified_extraction_jobs WHERE id = ?
      `, [jobId])

      if (jobs.length === 0) {
        throw new Error('Job not found')
      }

      const job = jobs[0]

      // Update status
      await executeSingle(`
        UPDATE unified_extraction_jobs 
        SET status = 'processing', started_at = NOW()
        WHERE id = ?
      `, [jobId])

      // Get file path
      const files = await executeQuery(`
        SELECT f.*, fsl.location_path 
        FROM files f
        LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
        WHERE f.id = ?
      `, [job.file_id])

      if (files.length === 0) {
        throw new Error('File not found')
      }

      const file = files[0]
      const filePath = file.location_path

      // Process extraction
      const options = {
        enableAI: job.ai_processing,
        enableOCR: true,
        preferredMethods: JSON.parse(job.extraction_methods || '[]'),
        priority: job.priority
      }

      const result = await this.extractWithAI(
        filePath,
        job.file_id,
        job.organization_id,
        options
      )

      // Update job status
      if (result.success) {
        await executeSingle(`
          UPDATE unified_extraction_jobs 
          SET status = 'completed', completed_at = NOW()
          WHERE id = ?
        `, [jobId])
      } else {
        await executeSingle(`
          UPDATE unified_extraction_jobs 
          SET status = 'failed', completed_at = NOW(), error_message = ?
          WHERE id = ?
        `, [result.error, jobId])
      }

    } catch (error) {
      console.error('Error processing background job:', error)
      
      await executeSingle(`
        UPDATE unified_extraction_jobs 
        SET status = 'failed', completed_at = NOW(), error_message = ?
        WHERE id = ?
      `, [error instanceof Error ? error.message : 'Unknown error', jobId])
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileExt: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.bmp': 'image/bmp'
    }

    return mimeTypes[fileExt] || 'application/octet-stream'
  }octet-stream'
  }
}

// Factory function
export function createUnifiedExtractionService(): UnifiedExtractionService {
  return new UnifiedExtractionService()
}