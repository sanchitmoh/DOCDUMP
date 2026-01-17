import Redis from 'ioredis'
import { createHash } from 'crypto'

export interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
  keyPrefix?: string
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
  tls?: boolean
}

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  compress?: boolean
  serialize?: boolean
}

export interface SessionData {
  userId: string
  userType: 'organization' | 'employee'
  organizationId: string
  email: string
  fullName: string
  permissions?: string[]
  lastActivity: Date
  ipAddress?: string
  userAgent?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  totalRequests: number
}

export class RedisService {
  private client: Redis
  private keyPrefix: string

  constructor(config: RedisConfig) {
    this.keyPrefix = config.keyPrefix || 'corporate:'
    
    const redisOptions: any = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnClusterDown: 300,
    }

    // Add TLS if required (for Upstash)
    if (config.tls) {
      redisOptions.tls = {
        rejectUnauthorized: false
      }
    }

    this.client = new Redis(redisOptions)

    // Event handlers
    this.client.on('connect', () => {
      console.log('Redis connected successfully')
    })

    this.client.on('error', (error) => {
      console.error('Redis connection error:', error)
    })

    this.client.on('close', () => {
      console.log('Redis connection closed')
    })

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...')
    })
  }

  /**
   * Get the underlying Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.client
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  /**
   * Serialize data for storage
   */
  private serialize(data: any): string {
    return JSON.stringify(data)
  }

  /**
   * Deserialize data from storage
   */
  private deserialize<T>(data: string): T {
    return JSON.parse(data)
  }

  /**
   * Generate hash for cache key
   */
  private generateHash(data: any): string {
    return createHash('md5').update(JSON.stringify(data)).digest('hex')
  }

  // ==========================================
  // Basic Cache Operations
  // ==========================================

  /**
   * Set cache value
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.generateKey(`cache:${key}`)
      const serializedValue = this.serialize(value)
      
      if (options.ttl) {
        await this.client.setex(cacheKey, options.ttl, serializedValue)
      } else {
        await this.client.set(cacheKey, serializedValue)
      }
    } catch (error) {
      console.error('Redis set error:', error)
      throw new Error(`Failed to set cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      
      return this.deserialize<T>(value)
    } catch (error) {
      console.error('Redis get error:', error)
      return null
    }
  }

  /**
   * Delete cache value
   */
  async del(key: string): Promise<void> {
    try {
      const cacheKey = this.generateKey(`cache:${key}`)
      await this.client.del(cacheKey)
    } catch (error) {
      console.error('Redis delete error:', error)
      throw new Error(`Failed to delete cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(`cache:${key}`)
      const result = await this.client.exists(cacheKey)
      return result === 1
    } catch (error) {
      console.error('Redis exists error:', error)
      return false
    }
  }

  /**
   * Set expiration for key
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      const cacheKey = this.generateKey(`cache:${key}`)
      await this.client.expire(cacheKey, seconds)
    } catch (error) {
      console.error('Redis expire error:', error)
      throw new Error(`Failed to set expiration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ==========================================
  // Session Management
  // ==========================================

  /**
   * Create user session
   */
  async createSession(sessionId: string, sessionData: SessionData, ttl: number = 3600): Promise<void> {
    try {
      const sessionKey = this.generateKey(`session:${sessionId}`)
      const serializedData = this.serialize({
        ...sessionData,
        createdAt: new Date(),
        lastActivity: new Date()
      })
      
      await this.client.setex(sessionKey, ttl, serializedData)
    } catch (error) {
      console.error('Redis create session error:', error)
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user session
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionKey = this.generateKey(`session:${sessionId}`)
      const sessionData = await this.client.get(sessionKey)
      
      if (!sessionData) {
        return null
      }
      
      return this.deserialize<SessionData>(sessionData)
    } catch (error) {
      console.error('Redis get session error:', error)
      return null
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string, ttl: number = 3600): Promise<void> {
    try {
      const sessionKey = this.generateKey(`session:${sessionId}`)
      const sessionData = await this.getSession(sessionId)
      
      if (sessionData) {
        sessionData.lastActivity = new Date()
        await this.client.setex(sessionKey, ttl, this.serialize(sessionData))
      }
    } catch (error) {
      console.error('Redis update session error:', error)
      throw new Error(`Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete user session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = this.generateKey(`session:${sessionId}`)
      await this.client.del(sessionKey)
    } catch (error) {
      console.error('Redis delete session error:', error)
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<{ sessionId: string; data: SessionData }[]> {
    try {
      const pattern = this.generateKey('session:*')
      const keys = await this.client.keys(pattern)
      const sessions: { sessionId: string; data: SessionData }[] = []
      
      for (const key of keys) {
        const sessionData = await this.client.get(key)
        if (sessionData) {
          const data = this.deserialize<SessionData>(sessionData)
          if (data.userId === userId) {
            const sessionId = key.replace(this.generateKey('session:'), '')
            sessions.push({ sessionId, data })
          }
        }
      }
      
      return sessions
    } catch (error) {
      console.error('Redis get user sessions error:', error)
      return []
    }
  }

  // ==========================================
  // Rate Limiting
  // ==========================================

  /**
   * Check rate limit using sliding window
   */
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      const key = this.generateKey(`rate_limit:${identifier}`)
      const now = Date.now()
      const windowStart = now - (windowSeconds * 1000)
      
      // Use Redis pipeline for atomic operations
      const pipeline = this.client.pipeline()
      
      // Remove old entries
      pipeline.zremrangebyscore(key, 0, windowStart)
      
      // Add current request
      pipeline.zadd(key, now, now)
      
      // Count current requests
      pipeline.zcard(key)
      
      // Set expiration
      pipeline.expire(key, windowSeconds)
      
      const results = await pipeline.exec()
      
      if (!results) {
        throw new Error('Pipeline execution failed')
      }
      
      const currentRequests = results[2][1] as number
      const allowed = currentRequests <= maxRequests
      const remaining = Math.max(0, maxRequests - currentRequests)
      const resetTime = now + (windowSeconds * 1000)
      
      return {
        allowed,
        remaining,
        resetTime,
        totalRequests: currentRequests
      }
    } catch (error) {
      console.error('Redis rate limit error:', error)
      // Allow request on error to prevent blocking
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + (windowSeconds * 1000),
        totalRequests: 1
      }
    }
  }

  // ==========================================
  // Search Cache
  // ==========================================

  /**
   * Cache search results
   */
  async cacheSearchResults(query: string, filters: any, results: any, ttl: number = 300): Promise<void> {
    try {
      const queryHash = this.generateHash({ query, filters })
      const cacheKey = this.generateKey(`search:${queryHash}`)
      
      await this.client.setex(cacheKey, ttl, this.serialize({
        query,
        filters,
        results,
        cachedAt: new Date()
      }))
    } catch (error) {
      console.error('Redis cache search error:', error)
      // Don't throw error for cache failures
    }
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(query: string, filters: any): Promise<any | null> {
    try {
      const queryHash = this.generateHash({ query, filters })
      const cacheKey = this.generateKey(`search:${queryHash}`)
      const cached = await this.client.get(cacheKey)
      
      if (cached) {
        return this.deserialize(cached)
      }
      
      return null
    } catch (error) {
      console.error('Redis get cached search error:', error)
      return null
    }
  }

  // ==========================================
  // Job Queue Management
  // ==========================================

  /**
   * Add job to queue
   */
  async addJob(queueName: string, jobData: any, priority: number = 0): Promise<void> {
    try {
      const queueKey = this.generateKey(`queue:${queueName}`)
      const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const job = {
        id: jobId,
        data: jobData,
        priority,
        createdAt: new Date(),
        status: 'pending'
      }
      
      await this.client.zadd(queueKey, priority, this.serialize(job))
    } catch (error) {
      console.error('Redis add job error:', error)
      throw new Error(`Failed to add job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get next job from queue
   */
  async getNextJob(queueName: string): Promise<any | null> {
    try {
      const queueKey = this.generateKey(`queue:${queueName}`)
      const jobs = await this.client.zrevrange(queueKey, 0, 0)
      
      if (jobs.length === 0) {
        return null
      }
      
      const job = this.deserialize(jobs[0])
      await this.client.zrem(queueKey, jobs[0])
      
      return job
    } catch (error) {
      console.error('Redis get job error:', error)
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
      console.error('Redis queue length error:', error)
      return 0
    }
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Clear all cache with pattern
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(this.generateKey(pattern))
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } catch (error) {
      console.error('Redis clear pattern error:', error)
      throw new Error(`Failed to clear pattern: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<any> {
    try {
      const info = await this.client.info()
      return info
    } catch (error) {
      console.error('Redis info error:', error)
      return null
    }
  }

  /**
   * Ping Redis server
   */
  async ping(): Promise<string> {
    try {
      return await this.client.ping()
    } catch (error) {
      throw new Error(`Redis ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
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
          message: 'Redis is responding to ping'
        }
      } else {
        return {
          status: 'unhealthy',
          message: 'Redis ping returned unexpected response'
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit()
    } catch (error) {
      console.error('Redis disconnect error:', error)
    }
  }
}

// Factory function to create Redis service instance
export function createRedisService(): RedisService {
  // Check if using Upstash (TLS required)
  const isUpstash = process.env.REDIS_HOST?.includes('upstash.io') || process.env.REDIS_TLS === 'true'
  
  const config: RedisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'corporate:',
    tls: isUpstash,
  }

  if (isUpstash) {
    console.log('🔒 Upstash/TLS Redis detected - enabling secure connection')
  }

  return new RedisService(config)
}

// Global Redis instance
let redisInstance: RedisService | null = null

export function getRedisInstance(): RedisService {
  if (!redisInstance) {
    redisInstance = createRedisService()
  }
  return redisInstance
}