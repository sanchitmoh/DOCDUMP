import { 
  TextractClient, 
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  FeatureType,
  Block
} from '@aws-sdk/client-textract'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs/promises'

export interface TextractConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  s3Bucket: string
}

export interface TextractResult {
  text: string
  confidence: number
  blocks: Block[]
  metadata: {
    pages: number
    words: number
    lines: number
    processing_time_ms: number
    method: 'textract_sync' | 'textract_async'
    features?: string[]
  }
}

export interface TextractTableData {
  tables: Array<{
    rows: string[][]
    confidence: number
    page: number
  }>
  forms: Array<{
    key: string
    value: string
    confidence: number
    page: number
  }>
}

export class AWSTextractService {
  private textractClient: TextractClient
  private s3Client: S3Client
  private config: TextractConfig

  constructor(config?: Partial<TextractConfig>) {
    this.config = {
      region: config?.region || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
      s3Bucket: config?.s3Bucket || process.env.AWS_S3_BUCKET || ''
    }

    const awsConfig = {
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      }
    }

    this.textractClient = new TextractClient(awsConfig)
    this.s3Client = new S3Client(awsConfig)
  }

  /**
   * Extract text from document using synchronous Textract (for single page documents)
   * Supports: PDF (single page), PNG, JPEG, TIFF
   */
  async extractTextSync(filePath: string): Promise<TextractResult> {
    try {
      console.log(`🔍 Starting AWS Textract sync extraction for: ${filePath}`)
      const startTime = Date.now()

      // Read file as buffer
      const fileBuffer = await fs.readFile(filePath)
      
      // Check file size (max 10MB for sync operations)
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error('File too large for synchronous processing. Use async method for files > 10MB.')
      }

      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: fileBuffer
        }
      })

      const response = await this.textractClient.send(command)
      const processingTime = Date.now() - startTime

      // Extract text and metadata from blocks
      const result = this.processTextractBlocks(response.Blocks || [], processingTime, 'textract_sync')
      
      console.log(`✅ Textract sync completed: ${result.text.length} characters, confidence: ${Math.round(result.confidence)}%`)
      
      return result

    } catch (error) {
      console.error('❌ AWS Textract sync extraction failed:', error)
      throw new Error(`Textract sync extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text and analyze document structure (forms, tables) synchronously
   */
  async analyzeDocumentSync(filePath: string, features: FeatureType[] = ['TABLES', 'FORMS']): Promise<TextractResult & TextractTableData> {
    try {
      console.log(`🔍 Starting AWS Textract document analysis for: ${filePath}`)
      const startTime = Date.now()

      const fileBuffer = await fs.readFile(filePath)
      
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error('File too large for synchronous processing. Use async method for files > 10MB.')
      }

      const command = new AnalyzeDocumentCommand({
        Document: {
          Bytes: fileBuffer
        },
        FeatureTypes: features
      })

      const response = await this.textractClient.send(command)
      const processingTime = Date.now() - startTime

      // Process basic text extraction
      const textResult = this.processTextractBlocks(response.Blocks || [], processingTime, 'textract_sync', features)
      
      // Process tables and forms
      const structuredData = this.extractTablesAndForms(response.Blocks || [])

      console.log(`✅ Textract analysis completed: ${textResult.text.length} characters, ${structuredData.tables.length} tables, ${structuredData.forms.length} forms`)

      return {
        ...textResult,
        ...structuredData
      }

    } catch (error) {
      console.error('❌ AWS Textract document analysis failed:', error)
      throw new Error(`Textract document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from multi-page documents using asynchronous Textract
   * Requires S3 storage
   */
  async extractTextAsync(filePath: string, s3Key?: string): Promise<TextractResult> {
    try {
      console.log(`🔍 Starting AWS Textract async extraction for: ${filePath}`)
      const startTime = Date.now()

      // Upload file to S3 if not already there
      const s3ObjectKey = s3Key || `textract-temp/${Date.now()}-${filePath.split('/').pop()}`
      
      if (!s3Key) {
        await this.uploadToS3(filePath, s3ObjectKey)
      }

      // Start async text detection
      const startCommand = new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: this.config.s3Bucket,
            Name: s3ObjectKey
          }
        }
      })

      const startResponse = await this.textractClient.send(startCommand)
      const jobId = startResponse.JobId

      if (!jobId) {
        throw new Error('Failed to start Textract job')
      }

      console.log(`📋 Textract job started: ${jobId}`)

      // Poll for completion
      const result = await this.pollForCompletion(jobId, 'text')
      const processingTime = Date.now() - startTime

      // Process results
      const textractResult = this.processTextractBlocks(result.blocks, processingTime, 'textract_async')

      // Clean up temp S3 file if we uploaded it
      if (!s3Key) {
        await this.cleanupS3Object(s3ObjectKey)
      }

      console.log(`✅ Textract async completed: ${textractResult.text.length} characters`)
      
      return textractResult

    } catch (error) {
      console.error('❌ AWS Textract async extraction failed:', error)
      throw new Error(`Textract async extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze multi-page documents asynchronously (with tables and forms)
   */
  async analyzeDocumentAsync(filePath: string, features: FeatureType[] = ['TABLES', 'FORMS'], s3Key?: string): Promise<TextractResult & TextractTableData> {
    try {
      console.log(`🔍 Starting AWS Textract async document analysis for: ${filePath}`)
      const startTime = Date.now()

      const s3ObjectKey = s3Key || `textract-temp/${Date.now()}-${filePath.split('/').pop()}`
      
      if (!s3Key) {
        await this.uploadToS3(filePath, s3ObjectKey)
      }

      const startCommand = new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: this.config.s3Bucket,
            Name: s3ObjectKey
          }
        },
        FeatureTypes: features
      })

      const startResponse = await this.textractClient.send(startCommand)
      const jobId = startResponse.JobId

      if (!jobId) {
        throw new Error('Failed to start Textract analysis job')
      }

      console.log(`📋 Textract analysis job started: ${jobId}`)

      const result = await this.pollForCompletion(jobId, 'analysis')
      const processingTime = Date.now() - startTime

      const textResult = this.processTextractBlocks(result.blocks, processingTime, 'textract_async', features)
      const structuredData = this.extractTablesAndForms(result.blocks)

      if (!s3Key) {
        await this.cleanupS3Object(s3ObjectKey)
      }

      console.log(`✅ Textract async analysis completed: ${textResult.text.length} characters, ${structuredData.tables.length} tables`)

      return {
        ...textResult,
        ...structuredData
      }

    } catch (error) {
      console.error('❌ AWS Textract async analysis failed:', error)
      throw new Error(`Textract async analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Upload file to S3 for async processing
   */
  private async uploadToS3(filePath: string, s3Key: string): Promise<void> {
    try {
      const fileBuffer = await fs.readFile(filePath)
      
      const command = new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: this.getContentType(filePath),
        ServerSideEncryption: 'AES256' // Required by your S3 bucket policy
      })

      await this.s3Client.send(command)
      console.log(`📤 File uploaded to S3: s3://${this.config.s3Bucket}/${s3Key}`)
    } catch (error) {
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Poll for job completion
   */
  private async pollForCompletion(jobId: string, jobType: 'text' | 'analysis', maxWaitTime: number = 300000): Promise<{ blocks: Block[] }> {
    const startTime = Date.now()
    const pollInterval = 5000 // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        let response: any

        if (jobType === 'text') {
          const command = new GetDocumentTextDetectionCommand({ JobId: jobId })
          response = await this.textractClient.send(command)
        } else {
          const command = new GetDocumentAnalysisCommand({ JobId: jobId })
          response = await this.textractClient.send(command)
        }

        const status = response.JobStatus

        if (status === 'SUCCEEDED') {
          console.log(`✅ Textract job completed: ${jobId}`)
          
          // Collect all blocks from all pages
          let allBlocks: Block[] = response.Blocks || []
          let nextToken = response.NextToken

          // Handle pagination
          while (nextToken) {
            let paginatedResponse: any

            if (jobType === 'text') {
              const command = new GetDocumentTextDetectionCommand({ 
                JobId: jobId, 
                NextToken: nextToken 
              })
              paginatedResponse = await this.textractClient.send(command)
            } else {
              const command = new GetDocumentAnalysisCommand({ 
                JobId: jobId, 
                NextToken: nextToken 
              })
              paginatedResponse = await this.textractClient.send(command)
            }

            allBlocks = allBlocks.concat(paginatedResponse.Blocks || [])
            nextToken = paginatedResponse.NextToken
          }

          return { blocks: allBlocks }
        } else if (status === 'FAILED') {
          throw new Error(`Textract job failed: ${response.StatusMessage || 'Unknown error'}`)
        } else if (status === 'IN_PROGRESS') {
          console.log(`⏳ Textract job in progress: ${jobId}`)
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        } else {
          console.log(`📋 Textract job status: ${status}`)
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }
      } catch (error) {
        console.error('Error polling Textract job:', error)
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    throw new Error(`Textract job timed out after ${maxWaitTime}ms`)
  }

  /**
   * Process Textract blocks into readable text and metadata
   */
  private processTextractBlocks(blocks: Block[], processingTime: number, method: 'textract_sync' | 'textract_async', features?: FeatureType[]): TextractResult {
    const lines: string[] = []
    const words: Block[] = []
    let totalConfidence = 0
    let confidenceCount = 0
    let pageCount = 0

    for (const block of blocks) {
      if (block.BlockType === 'PAGE') {
        pageCount++
      } else if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text)
        if (block.Confidence) {
          totalConfidence += block.Confidence
          confidenceCount++
        }
      } else if (block.BlockType === 'WORD') {
        words.push(block)
      }
    }

    const text = lines.join('\n')
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

    return {
      text,
      confidence: averageConfidence,
      blocks,
      metadata: {
        pages: Math.max(1, pageCount),
        words: words.length,
        lines: lines.length,
        processing_time_ms: processingTime,
        method,
        features: features?.map(f => f.toString())
      }
    }
  }

  /**
   * Extract tables and forms from Textract blocks
   */
  private extractTablesAndForms(blocks: Block[]): TextractTableData {
    const tables: Array<{ rows: string[][]; confidence: number; page: number }> = []
    const forms: Array<{ key: string; value: string; confidence: number; page: number }> = []

    // Create lookup maps
    const blockMap = new Map<string, Block>()
    for (const block of blocks) {
      if (block.Id) {
        blockMap.set(block.Id, block)
      }
    }

    // Process tables
    for (const block of blocks) {
      if (block.BlockType === 'TABLE') {
        const table = this.extractTable(block, blockMap)
        if (table) {
          tables.push(table)
        }
      } else if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')) {
        const form = this.extractKeyValue(block, blockMap)
        if (form) {
          forms.push(form)
        }
      }
    }

    return { tables, forms }
  }

  /**
   * Extract table data from table block
   */
  private extractTable(tableBlock: Block, blockMap: Map<string, Block>): { rows: string[][]; confidence: number; page: number } | null {
    if (!tableBlock.Relationships) return null

    const rows: string[][] = []
    let totalConfidence = 0
    let confidenceCount = 0

    // Find all cells
    const cellRelationship = tableBlock.Relationships.find((r: any) => r.Type === 'CHILD')
    if (!cellRelationship?.Ids) return null

    const cells: Array<{ row: number; col: number; text: string; confidence: number }> = []

    for (const cellId of cellRelationship.Ids) {
      const cellBlock = blockMap.get(cellId)
      if (cellBlock?.BlockType === 'CELL') {
        const rowIndex = (cellBlock.RowIndex || 1) - 1
        const colIndex = (cellBlock.ColumnIndex || 1) - 1
        const text = this.getCellText(cellBlock, blockMap)
        const confidence = cellBlock.Confidence || 0

        cells.push({ row: rowIndex, col: colIndex, text, confidence })
        
        if (confidence > 0) {
          totalConfidence += confidence
          confidenceCount++
        }
      }
    }

    // Build table structure
    const maxRow = Math.max(...cells.map(c => c.row), -1) + 1
    const maxCol = Math.max(...cells.map(c => c.col), -1) + 1

    for (let r = 0; r < maxRow; r++) {
      rows[r] = new Array(maxCol).fill('')
    }

    for (const cell of cells) {
      if (rows[cell.row]) {
        rows[cell.row][cell.col] = cell.text
      }
    }

    return {
      rows,
      confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      page: tableBlock.Page || 1
    }
  }

  /**
   * Extract key-value pair from form block
   */
  private extractKeyValue(keyBlock: Block, blockMap: Map<string, Block>): { key: string; value: string; confidence: number; page: number } | null {
    if (!keyBlock.Relationships) return null

    let key = ''
    let value = ''
    let confidence = keyBlock.Confidence || 0

    // Get key text
    const childRelationship = keyBlock.Relationships.find((r: any) => r.Type === 'CHILD')
    if (childRelationship?.Ids) {
      key = this.getTextFromIds(childRelationship.Ids, blockMap)
    }

    // Get value text
    const valueRelationship = keyBlock.Relationships.find((r: any) => r.Type === 'VALUE')
    if (valueRelationship?.Ids) {
      const valueBlock = blockMap.get(valueRelationship.Ids[0])
      if (valueBlock?.Relationships) {
        const valueChildRelationship = valueBlock.Relationships.find((r: any) => r.Type === 'CHILD')
        if (valueChildRelationship?.Ids) {
          value = this.getTextFromIds(valueChildRelationship.Ids, blockMap)
        }
      }
    }

    return key ? { key, value, confidence, page: keyBlock.Page || 1 } : null
  }

  /**
   * Get text content from cell block
   */
  private getCellText(cellBlock: Block, blockMap: Map<string, Block>): string {
    if (!cellBlock.Relationships) return ''

    const childRelationship = cellBlock.Relationships.find((r: any) => r.Type === 'CHILD')
    if (!childRelationship?.Ids) return ''

    return this.getTextFromIds(childRelationship.Ids, blockMap)
  }

  /**
   * Get text from block IDs
   */
  private getTextFromIds(ids: string[], blockMap: Map<string, Block>): string {
    const texts: string[] = []

    for (const id of ids) {
      const block = blockMap.get(id)
      if (block?.Text) {
        texts.push(block.Text)
      }
    }

    return texts.join(' ')
  }

  /**
   * Clean up temporary S3 object
   */
  private async cleanupS3Object(s3Key: string): Promise<void> {
    try {
      // Note: You might want to implement S3 deletion here
      // For now, we'll just log it
      console.log(`🧹 Should clean up S3 object: s3://${this.config.s3Bucket}/${s3Key}`)
    } catch (error) {
      console.warn('Failed to cleanup S3 object:', error)
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop()
    switch (ext) {
      case 'pdf': return 'application/pdf'
      case 'png': return 'image/png'
      case 'jpg':
      case 'jpeg': return 'image/jpeg'
      case 'tiff':
      case 'tif': return 'image/tiff'
      default: return 'application/octet-stream'
    }
  }

  /**
   * Check if file is suitable for sync processing
   */
  async isSuitableForSync(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      return stats.size <= 10 * 1024 * 1024 // 10MB limit for sync
    } catch {
      return false
    }
  }

  /**
   * Auto-select best extraction method based on file
   */
  async extractTextAuto(filePath: string, s3Key?: string): Promise<TextractResult> {
    const isSyncSuitable = await this.isSuitableForSync(filePath)
    
    if (isSyncSuitable) {
      console.log('📄 Using synchronous Textract extraction')
      return this.extractTextSync(filePath)
    } else {
      console.log('📚 Using asynchronous Textract extraction')
      return this.extractTextAsync(filePath, s3Key)
    }
  }

  /**
   * Auto-select best analysis method based on file
   */
  async analyzeDocumentAuto(filePath: string, features: FeatureType[] = ['TABLES', 'FORMS'], s3Key?: string): Promise<TextractResult & TextractTableData> {
    const isSyncSuitable = await this.isSuitableForSync(filePath)
    
    if (isSyncSuitable) {
      console.log('📄 Using synchronous Textract analysis')
      return this.analyzeDocumentSync(filePath, features)
    } else {
      console.log('📚 Using asynchronous Textract analysis')
      return this.analyzeDocumentAsync(filePath, features, s3Key)
    }
  }
}

// Factory function
export function createAWSTextractService(config?: Partial<TextractConfig>): AWSTextractService {
  return new AWSTextractService(config)
}