import { Redis } from 'ioredis'

export interface JobData {
  id: string
  data: any
  priority: number
  createdAt: Date
  retryCount?: number
  maxRetries?: number
}

export interface QueueStats {
  length: number
  processing: number
  completed: number
  failed: number
}

export class EnhancedRedisQueue {
  private redis: Redis
  private processingSet = new Set<string>()

  constructor(redis: Redis) {
    this.redis = redis
  }

  /**
   * Add job to priority queue
   */
  async addJob(
    queueName: string, 
    data: any, 
    priority: number = 5,
    options?: {
      delay?: number
      maxRetries?: number
      jobId?: string
    }
  ): Promise<string> {
    const jobId = options?.jobId || `${queueName}:${Date.now()}:${Math.random().toString(36).substring(7)}`
    
    const job: JobData = {
      id: jobId,
      data,
      priority,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options?.maxRetries || 3
    }

    const queueKey = `queue:${queueName}`
    const priorityScore = priority * 1000000 + Date.now() // Higher priority first, then FIFO

    if (options?.delay) {
      // Delayed job - add to delayed queue
      const delayedKey = `delayed:${queueName}`
      const executeAt = Date.now() + options.delay
      
      await this.redis.zadd(delayedKey, executeAt, JSON.stringify(job))
    } else {
      // Immediate job - add to priority queue
      await this.redis.zadd(queueKey, priorityScore, JSON.stringify(job))
    }

    // Update queue stats
    await this.redis.hincrby(`stats:${queueName}`, 'total', 1)

    return jobId
  }

  /**
   * Get next job from priority queue
   */
  async getNextJob(queueName: string): Promise<JobData | null> {
    const queueKey = `queue:${queueName}`
    
    // First, move any ready delayed jobs to main queue
    await this.processDelayedJobs(queueName)
    
    // Get highest priority job (lowest score due to negative priority)
    const result = await this.redis.zpopmin(queueKey)
    
    if (!result || result.length === 0) {
      return null
    }

    try {
      const job: JobData = JSON.parse(result[1])
      
      // Mark as processing
      this.processingSet.add(job.id)
      await this.redis.hset(`processing:${queueName}`, job.id, JSON.stringify({
        ...job,
        startedAt: new Date()
      }))
      
      // Update stats
      await this.redis.hincrby(`stats:${queueName}`, 'processing', 1)
      
      return job
    } catch (error) {
      console.error('Failed to parse job data:', error)
      return null
    }
  }

  /**
   * Get next job by priority (highest priority first)
   */
  async getNextJobByPriority(queueName: string): Promise<JobData | null> {
    const queueKey = `queue:${queueName}`
    
    // Move delayed jobs first
    await this.processDelayedJobs(queueName)
    
    // Get job with highest priority (highest score)
    const result = await this.redis.zpopmax(queueKey)
    
    if (!result || result.length === 0) {
      return null
    }

    try {
      const job: JobData = JSON.parse(result[1])
      
      // Mark as processing
      this.processingSet.add(job.id)
      await this.redis.hset(`processing:${queueName}`, job.id, JSON.stringify({
        ...job,
        startedAt: new Date()
      }))
      
      await this.redis.hincrby(`stats:${queueName}`, 'processing', 1)
      
      return job
    } catch (error) {
      console.error('Failed to parse job data:', error)
      return null
    }
  }

  /**
   * Mark job as completed
   */
  async completeJob(queueName: string, jobId: string): Promise<void> {
    // Remove from processing
    this.processingSet.delete(jobId)
    await this.redis.hdel(`processing:${queueName}`, jobId)
    
    // Update stats
    await this.redis.hincrby(`stats:${queueName}`, 'processing', -1)
    await this.redis.hincrby(`stats:${queueName}`, 'completed', 1)
    
    // Add to completed set with TTL
    await this.redis.setex(`completed:${queueName}:${jobId}`, 3600, Date.now().toString())
  }

  /**
   * Mark job as failed
   */
  async failJob(queueName: string, jobId: string, error: string): Promise<void> {
    // Remove from processing
    this.processingSet.delete(jobId)
    await this.redis.hdel(`processing:${queueName}`, jobId)
    
    // Update stats
    await this.redis.hincrby(`stats:${queueName}`, 'processing', -1)
    await this.redis.hincrby(`stats:${queueName}`, 'failed', 1)
    
    // Add to failed set with error info
    await this.redis.hset(`failed:${queueName}`, jobId, JSON.stringify({
      jobId,
      error,
      failedAt: new Date()
    }))
  }

  /**
   * Retry failed job
   */
  async retryJob(queueName: string, jobId: string, delay: number = 0): Promise<void> {
    const failedJobData = await this.redis.hget(`failed:${queueName}`, jobId)
    
    if (!failedJobData) {
      throw new Error(`Failed job ${jobId} not found`)
    }

    const failedJob = JSON.parse(failedJobData)
    
    // Remove from failed set
    await this.redis.hdel(`failed:${queueName}`, jobId)
    
    // Re-add to queue with incremented retry count
    await this.addJob(queueName, failedJob.data, failedJob.priority, {
      delay,
      jobId: `${jobId}:retry:${Date.now()}`
    })
    
    // Update stats
    await this.redis.hincrby(`stats:${queueName}`, 'failed', -1)
  }

  /**
   * Process delayed jobs (move ready jobs to main queue)
   */
  private async processDelayedJobs(queueName: string): Promise<void> {
    const delayedKey = `delayed:${queueName}`
    const queueKey = `queue:${queueName}`
    const now = Date.now()
    
    // Get all jobs ready to be processed
    const readyJobs = await this.redis.zrangebyscore(delayedKey, 0, now)
    
    if (readyJobs.length > 0) {
      // Move jobs to main queue
      const pipeline = this.redis.pipeline()
      
      for (const jobData of readyJobs) {
        try {
          const job: JobData = JSON.parse(jobData)
          const priorityScore = job.priority * 1000000 + Date.now()
          
          pipeline.zadd(queueKey, priorityScore, jobData)
          pipeline.zrem(delayedKey, jobData)
        } catch (error) {
          console.error('Failed to process delayed job:', error)
        }
      }
      
      await pipeline.exec()
    }
  }

  /**
   * Get queue length
   */
  async getQueueLength(queueName: string): Promise<number> {
    const queueKey = `queue:${queueName}`
    return await this.redis.zcard(queueKey)
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const stats = await this.redis.hgetall(`stats:${queueName}`)
    
    return {
      length: await this.getQueueLength(queueName),
      processing: parseInt(stats.processing || '0'),
      completed: parseInt(stats.completed || '0'),
      failed: parseInt(stats.failed || '0')
    }
  }

  /**
   * Get all queue names
   */
  async getAllQueues(): Promise<string[]> {
    const keys = await this.redis.keys('queue:*')
    return keys.map(key => key.replace('queue:', ''))
  }

  /**
   * Clear queue
   */
  async clearQueue(queueName: string): Promise<void> {
    const keys = [
      `queue:${queueName}`,
      `delayed:${queueName}`,
      `processing:${queueName}`,
      `stats:${queueName}`,
      `failed:${queueName}`
    ]
    
    await this.redis.del(...keys)
  }

  /**
   * Get processing jobs
   */
  async getProcessingJobs(queueName: string): Promise<JobData[]> {
    const processingData = await this.redis.hgetall(`processing:${queueName}`)
    
    return Object.values(processingData).map(data => {
      try {
        return JSON.parse(data)
      } catch (error) {
        console.error('Failed to parse processing job data:', error)
        return null
      }
    }).filter(Boolean) as JobData[]
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(queueName: string): Promise<any[]> {
    const failedData = await this.redis.hgetall(`failed:${queueName}`)
    
    return Object.values(failedData).map(data => {
      try {
        return JSON.parse(data)
      } catch (error) {
        console.error('Failed to parse failed job data:', error)
        return null
      }
    }).filter(Boolean)
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(queueName: string, maxAge: number = 86400000): Promise<void> {
    const cutoff = Date.now() - maxAge
    
    // Clean up old completed jobs
    const completedKeys = await this.redis.keys(`completed:${queueName}:*`)
    for (const key of completedKeys) {
      const timestamp = await this.redis.get(key)
      if (timestamp && parseInt(timestamp) < cutoff) {
        await this.redis.del(key)
      }
    }
    
    // Clean up old failed jobs
    const failedJobs = await this.getFailedJobs(queueName)
    for (const job of failedJobs) {
      if (new Date(job.failedAt).getTime() < cutoff) {
        await this.redis.hdel(`failed:${queueName}`, job.jobId)
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    latency: number
    memory: any
    queues: Record<string, QueueStats>
  }> {
    const startTime = Date.now()
    
    try {
      await this.redis.ping()
      const latency = Date.now() - startTime
      
      const memory = await this.redis.memory('usage')
      const queues: Record<string, QueueStats> = {}
      
      const queueNames = await this.getAllQueues()
      for (const queueName of queueNames) {
        queues[queueName] = await this.getQueueStats(queueName)
      }
      
      return {
        status: 'healthy',
        latency,
        memory,
        queues
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        memory: null,
        queues: {}
      }
    }
  }
}

// Extend the existing Redis instance with queue functionality
export function enhanceRedisWithQueue(redis: Redis): Redis & {
  addJob: EnhancedRedisQueue['addJob']
  getNextJob: EnhancedRedisQueue['getNextJob']
  getNextJobByPriority: EnhancedRedisQueue['getNextJobByPriority']
  completeJob: EnhancedRedisQueue['completeJob']
  failJob: EnhancedRedisQueue['failJob']
  retryJob: EnhancedRedisQueue['retryJob']
  getQueueLength: EnhancedRedisQueue['getQueueLength']
  getQueueStats: EnhancedRedisQueue['getQueueStats']
  getAllQueues: EnhancedRedisQueue['getAllQueues']
  clearQueue: EnhancedRedisQueue['clearQueue']
  getProcessingJobs: EnhancedRedisQueue['getProcessingJobs']
  getFailedJobs: EnhancedRedisQueue['getFailedJobs']
  cleanup: EnhancedRedisQueue['cleanup']
  healthCheck: EnhancedRedisQueue['healthCheck']
} {
  const queue = new EnhancedRedisQueue(redis)
  
  return Object.assign(redis, {
    addJob: queue.addJob.bind(queue),
    getNextJob: queue.getNextJob.bind(queue),
    getNextJobByPriority: queue.getNextJobByPriority.bind(queue),
    completeJob: queue.completeJob.bind(queue),
    failJob: queue.failJob.bind(queue),
    retryJob: queue.retryJob.bind(queue),
    getQueueLength: queue.getQueueLength.bind(queue),
    getQueueStats: queue.getQueueStats.bind(queue),
    getAllQueues: queue.getAllQueues.bind(queue),
    clearQueue: queue.clearQueue.bind(queue),
    getProcessingJobs: queue.getProcessingJobs.bind(queue),
    getFailedJobs: queue.getFailedJobs.bind(queue),
    cleanup: queue.cleanup.bind(queue),
    healthCheck: queue.healthCheck.bind(queue)
  })
}