import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery } from '@/lib/database'
import { createSearchService } from '@/lib/search'
import { getRedisInstance } from '@/lib/cache/redis'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication (admin only)
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user || auth.user.type !== 'organization') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const healthCheck = {
      timestamp: new Date().toISOString(),
      overall_status: 'healthy',
      services: {} as any,
      statistics: {} as any
    }

    // Database Health Check
    try {
      const dbStart = Date.now()
      const dbResult = await executeQuery('SELECT 1 as test')
      const dbTime = Date.now() - dbStart

      healthCheck.services.database = {
        status: 'healthy',
        response_time_ms: dbTime,
        connection: 'active'
      }
    } catch (dbError) {
      healthCheck.services.database = {
        status: 'error',
        error: dbError instanceof Error ? dbError.message : 'Database connection failed'
      }
      healthCheck.overall_status = 'degraded'
    }

    // Search Health Check
    try {
      const searchService = createSearchService()
      const searchStart = Date.now()
      const searchHealth = await searchService.healthCheck()
      const esTime = Date.now() - esStart

      healthCheck.services.elasticsearch = {
        status: esHealth.status,
        response_time_ms: esTime,
        cluster_status: esHealth.cluster_status,
        message: esHealth.message
      }

      if (esHealth.status !== 'healthy') {
        healthCheck.overall_status = 'degraded'
      }
    } catch (esError) {
      healthCheck.services.elasticsearch = {
        status: 'error',
        error: esError instanceof Error ? esError.message : 'Elasticsearch connection failed'
      }
      healthCheck.overall_status = 'degraded'
    }

    // Redis Health Check
    try {
      const redis = getRedisInstance()
      const redisStart = Date.now()
      await redis.ping()
      const redisTime = Date.now() - redisStart

      healthCheck.services.redis = {
        status: 'healthy',
        response_time_ms: redisTime,
        connection: 'active'
      }
    } catch (redisError) {
      healthCheck.services.redis = {
        status: 'error',
        error: redisError instanceof Error ? redisError.message : 'Redis connection failed'
      }
      healthCheck.overall_status = 'degraded'
    }

    // OpenAI API Health Check
    if (process.env.OPENAI_API_KEY) {
      try {
        const { createAIService } = await import('@/lib/services/ai-service')
        const aiService = createAIService()
        
        healthCheck.services.openai = {
          status: 'configured',
          api_key_present: true,
          service: 'available'
        }
      } catch (aiError) {
        healthCheck.services.openai = {
          status: 'error',
          api_key_present: true,
          error: aiError instanceof Error ? aiError.message : 'AI service initialization failed'
        }
      }
    } else {
      healthCheck.services.openai = {
        status: 'not_configured',
        api_key_present: false
      }
    }

    // Storage Health Check
    try {
      const storageConfig = {
        aws_configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        local_storage_path: process.env.LOCAL_STORAGE_PATH || './storage/files',
        storage_mode: process.env.STORAGE_MODE || 'hybrid'
      }

      healthCheck.services.storage = {
        status: 'configured',
        ...storageConfig
      }
    } catch (storageError) {
      healthCheck.services.storage = {
        status: 'error',
        error: 'Storage configuration check failed'
      }
    }

    // Get System Statistics
    try {
      const stats = await executeQuery(`
        SELECT 
          COUNT(*) as total_files,
          SUM(size_bytes) as total_size_bytes,
          COUNT(DISTINCT organization_id) as total_organizations,
          COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as files_last_24h,
          COUNT(CASE WHEN view_count > 0 THEN 1 END) as files_with_views,
          COUNT(CASE WHEN download_count > 0 THEN 1 END) as files_with_downloads
        FROM files 
        WHERE is_deleted = 0
      `)

      const extractionStats = await executeQuery(`
        SELECT 
          status,
          COUNT(*) as count
        FROM text_extraction_jobs 
        GROUP BY status
      `)

      const aiStats = await executeQuery(`
        SELECT 
          content_type,
          COUNT(*) as count
        FROM ai_generated_content 
        GROUP BY content_type
      `)

      healthCheck.statistics = {
        files: stats[0],
        text_extraction: extractionStats.reduce((acc: any, row: any) => {
          acc[row.status] = row.count
          return acc
        }, {}),
        ai_content: aiStats.reduce((acc: any, row: any) => {
          acc[row.content_type] = row.count
          return acc
        }, {}),
        system: {
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          node_version: process.version,
          environment: process.env.NODE_ENV
        }
      }
    } catch (statsError) {
      healthCheck.statistics = {
        error: 'Failed to retrieve statistics'
      }
    }

    return NextResponse.json(healthCheck)

  } catch (error) {
    console.error('System health check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}