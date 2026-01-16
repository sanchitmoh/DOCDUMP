/**
 * Redis REST API Fallback
 * Uses Upstash REST API when TCP connection fails
 */

import { Redis as UpstashRedis } from '@upstash/redis'

export interface RedisRestConfig {
  url: string
  token: string
  keyPrefix?: string
}

export class RedisRestService {
  private client: UpstashRedis
  private keyPrefix: string

  constructor(config: RedisRestConfig) {
    this.keyPrefix = config.keyPrefix || 'corporate:'
    
    this.client = new UpstashRedis({
      url: config.url,
      token: config.token,
    })
    
    console.log('✅ Redis REST client initialized')
  }

  private generateKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', message: string }> {
    try {
      const pong = await this.client.ping()
      if (pong === 'PONG') {
        return {
          status: 'healthy',
          message: 'Redis REST API is responding'
        }
      } else {
        return {
          status: 'unhealthy',
          message: 'Redis REST API returned unexpected response'
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis REST API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Check if Redis is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.healthCheck()
      return result.status === 'healthy'
    } catch (error) {
      return false
    }
  }

  /**
   * Set cache value
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const cacheKey = this.generateKey(`cache:${key}`)
      const serializedValue = JSON.stringify(value)
      
      if (ttl) {
        await this.client.setex(cacheKey, ttl, serializedValue)
      } else {
        await this.client.set(cacheKey, serializedValue)
      }
    } catch (error) {
      console.error('Redis REST set error:', error)
      throw error
    }
  }

  /**
   * Get cache value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(`cache:${key}`)
      const value = await this.client.get(cacheKey)
      
      if (value === null) {
        return null
      }
      
      return typeof value === 'string' ? JSON.parse(value) : value
    } catch (error) {
      console.error('Redis REST get error:', error)
      return null
    }
  }

  /**
   * Add job to queue
   */
  async addJob(queueName: string, jobData: any, priority: number = 0): Promise<void> {
    try {
      const available = await this.isAvailable()
      if (!available) {
        console.warn(`Redis REST unavailable, skipping job queue for ${queueName}`)
        return
      }

      const queueKey = this.generateKey(`queue:${queueName}`)
      const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const job = {
        id: jobId,
        data: jobData,
        priority,
        createdAt: new Date(),
        status: 'pending'
      }
      
      await this.client.zadd(queueKey, { score: priority, member: JSON.stringify(job) })
    } catch (error) {
      console.error('Redis REST add job error:', error)
      console.warn(`Continuing without Redis job queue for ${queueName}`)
    }
  }

  /**
   * Get next job from queue
   */
  async getNextJob(queueName: string): Promise<any | null> {
    try {
      const queueKey = this.generateKey(`queue:${queueName}`)
      const jobs = await this.client.zrange(queueKey, -1, -1)
      
      if (!jobs || jobs.length === 0) {
        return null
      }
      
      const job = typeof jobs[0] === 'string' ? JSON.parse(jobs[0]) : jobs[0]
      await this.client.zrem(queueKey, jobs[0])
      
      return job
    } catch (error) {
      console.error('Redis REST get job error:', error)
      return null
    }
  }

  /**
   * Get queue length
   */
  async getQueueLength(queueName: string): Promise<number> {
    try {
      const queueKey = this.generateKey(`queue:${queueName}`)
      return await this.client.zcard(queueKey)
    } catch (error) {
      console.error('Redis REST queue length error:', error)
      return 0
    }
  }
}

/**
 * Create Redis REST service instance
 */
export function createRedisRestService(): RedisRestService | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.warn('Redis REST API credentials not configured')
    return null
  }
  
  return new RedisRestService({
    url,
    token,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'corporate:',
  })
}
