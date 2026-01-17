import { getRedisInstance } from '@/lib/cache/redis'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { createUnifiedExtractionService } from '@/lib/services/unified-extraction-service'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { createSearchService } from '@/lib/search'
import { executeQuery, executeSingle } from '@/lib/database'

export interface ProcessorConfig {
  processingInterval: number // milliseconds
  batchSize: number // jobs per batch
  maxConcurrentJobs: number // max parallel jobs
  jobTimeout: number // milliseconds
  retryDelay: number // milliseconds
  maxRetries: number
  enablePriorityQueue: boolean
  enableMetrics: boolean
}

export interface ProcessorMetrics {
  totalJobsProcessed: number
  successfulJobs: number
  failedJobs: number
  averageProcessingTime: number
  queueLengths: Record<string, number>
  lastProcessedAt: Date
  processorUptime: number
  throughputPerMinute: number
}

export class OptimizedBackgroundProcessor {
  private redis = getRedisInstance()
  private textExtractionService = createTextExtractionService()
  private unifiedExtractionService = createUnifiedExtractionService()
  private storageService = createHybridStorageService()
  private searchService = createSearchService()
  
  private isRunning = false
  private processingInterval: NodeJS.Timeout | null = null
  private startTime = Date.now()
  private metrics: ProcessorMetrics = {
    totalJobsProcessed: 0,
    successfulJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    queueLengths: {},
    lastProcessedAt: new Date(),
    processorUptime: 0,
    throughputPerMinute: 0
  }

  private config: ProcessorConfig = {
    processingInterval: 1000, // 1 second (reduced from 5 seconds)
    batchSize: 5, // process 5 jobs per batch
    maxConcurrentJobs: 10, // max 10 parallel jobs
    jobTimeout: 300000, // 5 minutes timeout
    retryDelay: 2000, // 2 seconds retry delay
    maxRetries: 3,
    enablePriorityQueue: true,
    enableMetrics: true
  }

  constructor(config?: Partial<ProcessorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
    console.log('🚀 OptimizedBackgroundProcessor initialized with config:', this.config)
  }

  /**
   * Start the optimized background processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Background processor is already running')
      return
    }

    this.isRunning = true
    this.startTime = Date.now()
    console.log('🚀 Starting optimized background processor...')

    // Sync pending database jobs to Redis on startup
    await this.syncPendingJobsToRedis()

    // Process jobs at configured interval
    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobsBatch()
        if (this.config.enableMetrics) {
          await this.updateMetrics()
        }
      } catch (error) {
        console.error('❌ Error in background processor:', error)
      }
    }, this.config.processingInterval)

    console.log(`✅ Optimized background processor started (interval: ${this.config.processingInterval}ms, batch: ${this.config.batchSize})`)
  }

  /**
   * Stop the background processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Background processor is not running')
      return
    }

    this.isRunning = false
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    console.log('🛑 Optimized background processor stopped')
  }

  /**
   * Process jobs in batches with concurrency control
   */
  private async processJobsBatch(): Promise<void> {
    if (!this.isRunning) return

    const startTime = Date.now()
    const jobPromises: Promise<void>[] = []

    try {
      // Process each queue type in parallel with batch processing
      const queueTypes = [
        'unified-extraction',
        'text-extraction', 
        'storage-sync',
        'search-indexing'
      ]

      for (const queueType of queueTypes) {
        // Get batch of jobs for this queue
        const jobs = await this.getJobsBatch(queueType, this.config.batchSize)
        
        if (jobs.length > 0) {
          console.log(`📋 Processing ${jobs.length} ${queueType} jobs`)
          
          // Process jobs with concurrency limit
          const batchPromises = jobs.map(job => 
            this.processJobWithTimeout(job, queueType)
          )
          
          jobPromises.push(...batchPromises)
        }
      }

      // Wait for all jobs to complete with concurrency limit
      if (jobPromises.length > 0) {
        await this.processConcurrently(jobPromises, this.config.maxConcurrentJobs)
        
        const processingTime = Date.now() - startTime
        console.log(`⚡ Batch processing completed: ${jobPromises.length} jobs in ${processingTime}ms`)
      }

    } catch (error) {
      console.error('❌ Error processing job batch:', error)
    }
  }

  /**
   * Get batch of jobs from Redis queue with priority support
   */
  private async getJobsBatch(queueType: string, batchSize: number): Promise<any[]> {
    const jobs: any[] = []
    
    try {
      for (let i = 0; i < batchSize; i++) {
        const job = this.config.enablePriorityQueue 
          ? await this.redis.getNextJobByPriority(queueType)
          : await this.redis.getNextJob(queueType)
        
        if (job) {
          jobs.push({ ...job, queueType })
        } else {
          break // No more jobs in queue
        }
      }
    } catch (error) {
      console.error(`❌ Error getting jobs from ${queueType} queue:`, error)
    }

    return jobs
  }

  /**
   * Process job with timeout protection
   */
  private async processJobWithTimeout(job: any, queueType: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`⏰ Job ${job.id} timed out after ${this.config.jobTimeout}ms`)
        this.metrics.failedJobs++
        reject(new Error(`Job timeout: ${this.config.jobTimeout}ms`))
      }, this.config.jobTimeout)

      try {
        const startTime = Date.now()
        
        switch (queueType) {
          case 'unified-extraction':
            await this.processUnifiedExtractionJob(job)
            break
          case 'text-extraction':
            await this.processTextExtractionJob(job)
            break
          case 'storage-sync':
            await this.processStorageSyncJob(job)
            break
          case 'search-indexing':
            await this.processSearchIndexingJob(job)
            break
          default:
            throw new Error(`Unknown queue type: ${queueType}`)
        }

        const processingTime = Date.now() - startTime
        this.metrics.successfulJobs++
        this.metrics.totalJobsProcessed++
        
        // Update average processing time
        this.metrics.averageProcessingTime = 
          (this.metrics.averageProcessingTime * (this.metrics.totalJobsProcessed - 1) + processingTime) / 
          this.metrics.totalJobsProcessed

        console.log(`✅ Job ${job.id} completed in ${processingTime}ms`)
        
        clearTimeout(timeout)
        resolve()
        
      } catch (error) {
        clearTimeout(timeout)
        console.error(`❌ Job ${job.id} failed:`, error)
        
        this.metrics.failedJobs++
        this.metrics.totalJobsProcessed++
        
        // Handle job retry
        await this.handleJobRetry(job, queueType, error)
        
        resolve() // Don't reject to allow other jobs to continue
      }
    })
  }

  /**
   * Process jobs with concurrency limit
   */
  private async processConcurrently<T>(
    promises: Promise<T>[], 
    concurrencyLimit: number
  ): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < promises.length; i += concurrencyLimit) {
      const batch = promises.slice(i, i + concurrencyLimit)
      const batchResults = await Promise.allSettled(batch)
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results[i + index] = result.value
        } else {
          console.error(`❌ Concurrent job ${i + index} failed:`, result.reason)
        }
      })
    }
    
    return results
  }

  /**
   * Handle job retry with exponential backoff
   */
  private async handleJobRetry(job: any, queueType: string, error: any): Promise<void> {
    const retryCount = (job.retryCount || 0) + 1
    
    if (retryCount <= this.config.maxRetries) {
      const delay = this.config.retryDelay * Math.pow(2, retryCount - 1) // Exponential backoff
      
      console.log(`🔄 Retrying job ${job.id} (attempt ${retryCount}/${this.config.maxRetries}) in ${delay}ms`)
      
      setTimeout(async () => {
        try {
          await this.redis.addJob(queueType, {
            ...job.data,
            retryCount,
            originalError: error instanceof Error ? error.message : 'Unknown error'
          }, job.priority || 5)
        } catch (retryError) {
          console.error(`❌ Failed to retry job ${job.id}:`, retryError)
        }
      }, delay)
    } else {
      console.error(`💀 Job ${job.id} failed permanently after ${this.config.maxRetries} retries`)
      
      // Mark job as permanently failed in database
      try {
        if (job.data.jobId) {
          await this.markJobAsFailed(job.data.jobId, queueType, error)
        }
      } catch (dbError) {
        console.error('❌ Failed to mark job as failed in database:', dbError)
      }
    }
  }

  /**
   * Mark job as permanently failed in database
   */
  private async markJobAsFailed(jobId: number, queueType: string, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    try {
      if (queueType === 'unified-extraction' || queueType === 'text-extraction') {
        await executeSingle(`
          UPDATE text_extraction_jobs 
          SET status = 'failed', 
              error_message = ?, 
              completed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [errorMessage, jobId])
      }
      // Add other job types as needed
    } catch (error) {
      console.error('❌ Failed to update job status in database:', error)
    }
  }

  /**
   * Process unified extraction job
   */
  private async processUnifiedExtractionJob(job: any): Promise<void> {
    console.log(`🔍 Processing unified extraction job: ${job.id}`)
    
    try {
      await this.unifiedExtractionService.processBackgroundJob(job.data.jobId)
      console.log(`✅ Unified extraction job ${job.id} completed`)

      // Update search index after successful extraction
      await this.scheduleSearchIndexUpdate(job.data.fileId, job.data.organizationId)
    } catch (error) {
      console.error(`❌ Unified extraction job ${job.id} failed:`, error)
      throw error
    }
  }

  /**
   * Process text extraction job (legacy)
   */
  private async processTextExtractionJob(job: any): Promise<void> {
    console.log(`📄 Processing text extraction job: ${job.id}`)
    
    try {
      await this.textExtractionService.processExtractionJob(job.data.jobId)
      console.log(`✅ Text extraction job ${job.id} completed`)

      // Update search index after successful extraction
      await this.scheduleSearchIndexUpdate(job.data.fileId, job.data.organizationId)
    } catch (error) {
      console.error(`❌ Text extraction job ${job.id} failed:`, error)
      throw error
    }
  }

  /**
   * Process storage sync job
   */
  private async processStorageSyncJob(job: any): Promise<void> {
    console.log(`💾 Processing storage sync job: ${job.id}`)
    
    try {
      await this.storageService.processSyncJob(job.data.jobId)
      console.log(`✅ Storage sync job ${job.id} completed`)
    } catch (error) {
      console.error(`❌ Storage sync job ${job.id} failed:`, error)
      throw error
    }
  }

  /**
   * Process search indexing job
   */
  private async processSearchIndexingJob(job: any): Promise<void> {
    console.log(`🔍 Processing search indexing job: ${job.id}`)
    
    try {
      await this.processSearchIndexingJobData(job.data)
      console.log(`✅ Search indexing job ${job.id} completed`)
    } catch (error) {
      console.error(`❌ Search indexing job ${job.id} failed:`, error)
      throw error
    }
  }

  /**
   * Process search indexing job data
   */
  private async processSearchIndexingJobData(data: any): Promise<void> {
    const { fileId, organizationId, action = 'index' } = data
    
    if (action === 'index') {
      // Get file data for indexing
      const fileData = await executeQuery(`
        SELECT 
          f.*,
          etc.extracted_text,
          fo.name as folder_name,
          u.full_name as creator_name
        FROM files f
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN organization_employees u ON f.created_by = u.id
        WHERE f.id = ? AND f.organization_id = ?
      `, [fileId, organizationId])

      if (fileData.length === 0) {
        throw new Error(`File ${fileId} not found for indexing`)
      }

      const file = fileData[0]
      
      // Parse tags
      let tags: string[] = []
      if (file.tags) {
        try {
          tags = JSON.parse(file.tags)
        } catch {
          tags = []
        }
      }

      // Index document
      await this.searchService.indexDocument({
        file_id: fileId.toString(),
        organization_id: organizationId.toString(),
        title: file.name,
        content: file.extracted_text || '',
        author: file.creator_name || '',
        department: file.department || '',
        tags,
        file_type: file.file_type || '',
        mime_type: file.mime_type || '',
        size_bytes: file.size_bytes || 0,
        created_at: file.created_at,
        updated_at: file.updated_at,
        visibility: file.visibility,
        folder_path: file.folder_name || ''
      })
    } else if (action === 'delete') {
      await this.searchService.deleteDocument(fileId.toString(), organizationId.toString())
    }
  }

  /**
   * Schedule search index update
   */
  private async scheduleSearchIndexUpdate(fileId: number, organizationId: number): Promise<void> {
    try {
      await this.redis.addJob('search-indexing', {
        fileId,
        organizationId,
        action: 'index'
      }, 3) // Lower priority for indexing
    } catch (error) {
      console.error('❌ Failed to schedule search index update:', error)
    }
  }

  /**
   * Sync pending database jobs to Redis queue
   */
  private async syncPendingJobsToRedis(): Promise<void> {
    try {
      console.log('🔄 Syncing pending database jobs to Redis...')
      
      // Get pending extraction jobs
      const pendingJobs = await executeQuery(`
        SELECT id, file_id, organization_id, extraction_method, priority, created_at
        FROM text_extraction_jobs 
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 100
      `)

      let syncedCount = 0
      
      for (const job of pendingJobs) {
        try {
          await this.redis.addJob('unified-extraction', {
            jobId: job.id,
            fileId: job.file_id,
            organizationId: job.organization_id,
            extractionMethod: job.extraction_method
          }, job.priority || 5)
          
          syncedCount++
        } catch (error) {
          console.error(`❌ Failed to sync job ${job.id} to Redis:`, error)
        }
      }

      console.log(`✅ Synced ${syncedCount} pending jobs to Redis`)
    } catch (error) {
      console.error('❌ Failed to sync pending jobs:', error)
    }
  }

  /**
   * Update processor metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      this.metrics.lastProcessedAt = new Date()
      this.metrics.processorUptime = Date.now() - this.startTime
      
      // Calculate throughput per minute
      const uptimeMinutes = this.metrics.processorUptime / (1000 * 60)
      this.metrics.throughputPerMinute = uptimeMinutes > 0 
        ? this.metrics.totalJobsProcessed / uptimeMinutes 
        : 0

      // Get queue lengths
      const queueTypes = ['unified-extraction', 'text-extraction', 'storage-sync', 'search-indexing']
      for (const queueType of queueTypes) {
        try {
          this.metrics.queueLengths[queueType] = await this.redis.getQueueLength(queueType)
        } catch (error) {
          this.metrics.queueLengths[queueType] = 0
        }
      }
    } catch (error) {
      console.error('❌ Failed to update metrics:', error)
    }
  }

  /**
   * Get processor health status
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    isRunning: boolean
    metrics: ProcessorMetrics
    config: ProcessorConfig
    issues: string[]
  }> {
    const issues: string[] = []
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Check if processor is running
    if (!this.isRunning) {
      issues.push('Processor is not running')
      status = 'unhealthy'
    }

    // Check Redis connection
    try {
      await this.redis.ping()
    } catch (error) {
      issues.push('Redis connection failed')
      status = 'unhealthy'
    }

    // Check queue lengths
    const totalQueueLength = Object.values(this.metrics.queueLengths).reduce((sum, length) => sum + length, 0)
    if (totalQueueLength > 100) {
      issues.push(`High queue backlog: ${totalQueueLength} jobs`)
      status = status === 'healthy' ? 'degraded' : status
    }

    // Check failure rate
    const failureRate = this.metrics.totalJobsProcessed > 0 
      ? this.metrics.failedJobs / this.metrics.totalJobsProcessed 
      : 0
    
    if (failureRate > 0.1) { // More than 10% failure rate
      issues.push(`High failure rate: ${Math.round(failureRate * 100)}%`)
      status = status === 'healthy' ? 'degraded' : status
    }

    return {
      status,
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
      config: { ...this.config },
      issues
    }
  }

  /**
   * Get processor metrics
   */
  getMetrics(): ProcessorMetrics {
    return { ...this.metrics }
  }

  /**
   * Update processor configuration
   */
  updateConfig(newConfig: Partial<ProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('🔧 Processor configuration updated:', newConfig)
    
    // Restart with new config if running
    if (this.isRunning) {
      console.log('🔄 Restarting processor with new configuration...')
      this.stop().then(() => this.start())
    }
  }
}

// Factory function
export function createOptimizedBackgroundProcessor(config?: Partial<ProcessorConfig>): OptimizedBackgroundProcessor {
  return new OptimizedBackgroundProcessor(config)
}