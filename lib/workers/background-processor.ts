import { getRedisInstance } from '@/lib/cache/redis'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { createSearchService } from '@/lib/search'
import { executeQuery } from '@/lib/database'

export class BackgroundProcessor {
  private redis = getRedisInstance()
  private textExtractionService = createTextExtractionService()
  private storageService = createHybridStorageService()
  private searchService = createSearchService()
  private isRunning = false
  private processingInterval: NodeJS.Timeout | null = null

  /**
   * Start the background processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Background processor is already running')
      return
    }

    this.isRunning = true
    console.log('Starting background processor...')

    // Process jobs every 5 seconds
    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobs()
      } catch (error) {
        console.error('Error in background processor:', error)
      }
    }, 5000)

    console.log('Background processor started successfully')
  }

  /**
   * Stop the background processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Background processor is not running')
      return
    }

    this.isRunning = false
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    console.log('Background processor stopped')
  }

  /**
   * Process all types of background jobs
   */
  private async processJobs(): Promise<void> {
    if (!this.isRunning) return

    try {
      // Process text extraction jobs
      await this.processTextExtractionJobs()

      // Process storage sync jobs
      await this.processStorageSyncJobs()

      // Process search indexing jobs
      await this.processSearchIndexingJobs()

    } catch (error) {
      console.error('Error processing background jobs:', error)
    }
  }

  /**
   * Process text extraction jobs from Redis queue
   */
  private async processTextExtractionJobs(): Promise<void> {
    try {
      const job = await this.redis.getNextJob('text-extraction')
      if (!job) return

      console.log(`Processing text extraction job: ${job.id}`)

      try {
        await this.textExtractionService.processExtractionJob(job.data.jobId)
        console.log(`Text extraction job ${job.id} completed successfully`)

        // Update search index after successful extraction
        await this.scheduleSearchIndexUpdate(job.data.fileId, job.data.organizationId)

      } catch (error) {
        console.error(`Text extraction job ${job.id} failed:`, error)
        
        // Job retry logic is handled within the text extraction service
        // No need to re-queue here
      }

    } catch (error) {
      console.error('Error processing text extraction jobs:', error)
    }
  }

  /**
   * Process storage sync jobs from Redis queue
   */
  private async processStorageSyncJobs(): Promise<void> {
    try {
      const job = await this.redis.getNextJob('storage-sync')
      if (!job) return

      console.log(`Processing storage sync job: ${job.id}`)

      try {
        await this.storageService.processSyncJob(job.data.jobId)
        console.log(`Storage sync job ${job.id} completed successfully`)

      } catch (error) {
        console.error(`Storage sync job ${job.id} failed:`, error)
      }

    } catch (error) {
      console.error('Error processing storage sync jobs:', error)
    }
  }

  /**
   * Process search indexing jobs
   */
  private async processSearchIndexingJobs(): Promise<void> {
    try {
      const job = await this.redis.getNextJob('search-indexing')
      if (!job) return

      console.log(`Processing search indexing job: ${job.id}`)

      try {
        await this.processSearchIndexingJob(job.data)
        console.log(`Search indexing job ${job.id} completed successfully`)

      } catch (error) {
        console.error(`Search indexing job ${job.id} failed:`, error)
      }

    } catch (error) {
      console.error('Error processing search indexing jobs:', error)
    }
  }

  /**
   * Parse tags from various formats (JSON array, comma-separated string, or null)
   */
  private parseTags(tags: any): string[] {
    if (!tags) return []
    
    // If it's already an array, return it
    if (Array.isArray(tags)) return tags
    
    // If it's a string, try to parse as JSON first
    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags)
        if (Array.isArray(parsed)) return parsed
      } catch (error) {
        // If JSON parsing fails, treat as comma-separated string
        return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      }
    }
    
    return []
  }

  /**
   * Process individual search indexing job
   */
  private async processSearchIndexingJob(jobData: any): Promise<void> {
    const { fileId, organizationId, action = 'index' } = jobData

    try {
      // Get file information with extracted text
      const fileInfo = await executeQuery(`
        SELECT 
          f.*,
          fo.name as folder_name,
          u.full_name as author_name,
          etc.extracted_text,
          dm.title as doc_title,
          dm.author as doc_author,
          dm.subject as doc_subject,
          dm.keywords as doc_keywords
        FROM files f
        JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        WHERE f.id = ? AND f.organization_id = ?
      `, [fileId, organizationId])

      if (fileInfo.length === 0) {
        throw new Error(`File ${fileId} not found`)
      }

      const file = fileInfo[0]

      if (action === 'delete') {
        // Delete from search index
        const deleteResult = await this.searchService.deleteDocument(fileId.toString())
        if (!deleteResult) {
          throw new Error('Failed to delete document from search index')
        }
      } else {
        // Index or update document
        const document = {
          file_id: fileId.toString(),
          organization_id: organizationId.toString(),
          title: file.doc_title || file.name,
          content: file.extracted_text || '',
          author: file.doc_author || file.author_name || '',
          department: file.department || '',
          tags: this.parseTags(file.tags),
          file_type: file.file_type || 'other',
          mime_type: file.mime_type || 'application/octet-stream',
          size_bytes: file.size_bytes || 0,
          created_at: new Date(file.created_at),
          updated_at: new Date(file.updated_at),
          visibility: (file.visibility as 'private' | 'org' | 'public') || 'private',
          folder_path: file.folder_name || '',
          extracted_text: file.extracted_text || ''
        }

        console.log(`🔍 Processing search indexing for file ${fileId}:`, {
          title: document.title,
          content_length: document.content.length,
          extracted_text_length: document.extracted_text.length,
          has_extracted_text: !!file.extracted_text
        })

        const indexResult = await this.searchService.indexDocument(document)
        if (!indexResult) {
          throw new Error('Failed to index document in search service')
        }
      }

      // STEP 5: Update search index status to success
      await this.textExtractionService.updateSearchIndexStatus(
        fileId,
        organizationId,
        action === 'delete' ? 'deleted' : 'indexed'
      )

      console.log(`✅ Search indexing completed successfully for file ${fileId}`)

    } catch (error) {
      console.error(`❌ Error processing search indexing for file ${fileId}:`, error)
      
      // STEP 5: Fail-safe behavior - Update status but don't block the system
      try {
        await this.textExtractionService.updateSearchIndexStatus(
          fileId,
          organizationId,
          'failed',
          error instanceof Error ? error.message : 'Unknown indexing error'
        )
      } catch (statusError) {
        console.error(`Failed to update search index status for file ${fileId}:`, statusError)
      }
      
      // STEP 5: Schedule retry for later (fail-safe)
      try {
        await this.scheduleSearchIndexRetry(fileId, organizationId, action)
      } catch (retryError) {
        console.error(`Failed to schedule retry for file ${fileId}:`, retryError)
      }
      
      throw error
    }
  }

  /**
   * Schedule search index update after text extraction
   */
  private async scheduleSearchIndexUpdate(fileId: number, organizationId: number): Promise<void> {
    try {
      await this.redis.addJob('search-indexing', {
        fileId,
        organizationId,
        action: 'index'
      }, 3) // Lower priority than extraction jobs

    } catch (error) {
      console.error('Error scheduling search index update:', error)
    }
  }

  /**
   * STEP 5: Schedule search index retry with exponential backoff
   */
  private async scheduleSearchIndexRetry(fileId: number, organizationId: number, action: string = 'index'): Promise<void> {
    try {
      // Get current retry count
      const retryCount = await this.getSearchIndexRetryCount(fileId, organizationId)
      const maxRetries = 3
      
      if (retryCount >= maxRetries) {
        console.warn(`Max retries (${maxRetries}) reached for search indexing file ${fileId}`)
        return
      }
      
      console.log(`📅 Scheduling search index retry ${retryCount + 1}/${maxRetries} for file ${fileId} (immediate retry - delay not supported yet)`)
      
      // Schedule retry job (without delay for now - Redis service doesn't support delayed jobs)
      await this.redis.addJob('search-indexing', {
        fileId,
        organizationId,
        action,
        retryCount: retryCount + 1
      }, 1) // Low priority

    } catch (error) {
      console.error('Error scheduling search index retry:', error)
    }
  }

  /**
   * Get current retry count for search indexing
   */
  private async getSearchIndexRetryCount(fileId: number, organizationId: number): Promise<number> {
    try {
      const result = await executeQuery(`
        SELECT retry_count FROM search_index_status 
        WHERE file_id = ? AND organization_id = ?
      `, [fileId, organizationId])
      
      return result.length > 0 ? (result[0].retry_count || 0) : 0
    } catch (error) {
      console.error('Error getting search index retry count:', error)
      return 0
    }
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isRunning: boolean
    queueLengths: Promise<{ [key: string]: number }>
  } {
    return {
      isRunning: this.isRunning,
      queueLengths: this.getQueueLengths()
    }
  }

  /**
   * Get queue lengths for monitoring
   */
  private async getQueueLengths(): Promise<{ [key: string]: number }> {
    try {
      const [textExtraction, storageSync, searchIndexing] = await Promise.all([
        this.redis.getQueueLength('text-extraction'),
        this.redis.getQueueLength('storage-sync'),
        this.redis.getQueueLength('search-indexing')
      ])

      return {
        'text-extraction': textExtraction,
        'storage-sync': storageSync,
        'search-indexing': searchIndexing
      }
    } catch (error) {
      console.error('Error getting queue lengths:', error)
      return {}
    }
  }

  /**
   * Process pending database jobs (fallback for jobs not in Redis)
   */
  async processPendingDatabaseJobs(): Promise<void> {
    try {
      // Get pending text extraction jobs from database
      const pendingJobs = await this.textExtractionService.getPendingJobs(10)
      
      for (const job of pendingJobs) {
        // Add to Redis queue if not already there
        await this.redis.addJob('text-extraction', {
          jobId: job.id,
          fileId: job.file_id,
          organizationId: job.organization_id,
          extractionMethod: job.extraction_method,
          priority: job.priority
        }, job.priority)
      }

      if (pendingJobs.length > 0) {
        console.log(`Added ${pendingJobs.length} pending text extraction jobs to queue`)
      }

    } catch (error) {
      console.error('Error processing pending database jobs:', error)
    }
  }

  /**
   * Health check for background processor
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    message: string
    details: any
  }> {
    try {
      const queueLengths = await this.getQueueLengths()
      const redisHealth = await this.redis.healthCheck()

      const isHealthy = this.isRunning && redisHealth.status === 'healthy'

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Background processor is running normally' : 'Background processor has issues',
        details: {
          is_running: this.isRunning,
          queue_lengths: queueLengths,
          redis_health: redisHealth
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        details: {
          is_running: this.isRunning
        }
      }
    }
  }
}

// Global instance
let backgroundProcessor: BackgroundProcessor | null = null

export function getBackgroundProcessor(): BackgroundProcessor {
  if (!backgroundProcessor) {
    backgroundProcessor = new BackgroundProcessor()
  }
  return backgroundProcessor
}

// Auto-start in production
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BACKGROUND_JOBS === 'true') {
  const processor = getBackgroundProcessor()
  processor.start().catch(console.error)
  
  // Process pending jobs on startup
  processor.processPendingDatabaseJobs().catch(console.error)
}