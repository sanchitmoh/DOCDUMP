import { NextRequest, NextResponse } from 'next/server'
import { testConnection } from '@/lib/database'
import { createS3Service } from '@/lib/storage/s3'
import { createLocalStorageService } from '@/lib/storage/local'
import { createElasticsearchService } from '@/lib/search/elasticsearch'
import { getRedisInstance } from '@/lib/cache/redis'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { getBackgroundProcessor } from '@/lib/workers/background-processor'

export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {}
    }

    // Test Database connection
    try {
      const dbHealthy = await testConnection()
      results.checks.database = {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        message: dbHealthy ? 'Database connection successful' : 'Database connection failed'
      }
    } catch (error) {
      results.checks.database = {
        status: 'unhealthy',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Test S3 connection (if configured)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const s3Service = createS3Service()
        const s3Health = await s3Service.healthCheck()
        results.checks.s3 = s3Health
      } catch (error) {
        results.checks.s3 = {
          status: 'unhealthy',
          message: `S3 error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    } else {
      results.checks.s3 = {
        status: 'not_configured',
        message: 'S3 credentials not configured'
      }
    }

    // Test Local Storage
    try {
      const localService = createLocalStorageService()
      const localHealth = await localService.healthCheck()
      results.checks.local_storage = localHealth
    } catch (error) {
      results.checks.local_storage = {
        status: 'unhealthy',
        message: `Local storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Test Elasticsearch connection (if configured)
    if (process.env.ELASTICSEARCH_URL) {
      try {
        const esService = createElasticsearchService()
        const esHealth = await esService.healthCheck()
        results.checks.elasticsearch = esHealth
      } catch (error) {
        results.checks.elasticsearch = {
          status: 'unhealthy',
          message: `Elasticsearch error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    } else {
      results.checks.elasticsearch = {
        status: 'not_configured',
        message: 'Elasticsearch URL not configured'
      }
    }

    // Test Redis connection (if configured)
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      try {
        const redisService = getRedisInstance()
        const redisHealth = await redisService.healthCheck()
        results.checks.redis = redisHealth
      } catch (error) {
        results.checks.redis = {
          status: 'unhealthy',
          message: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    } else {
      results.checks.redis = {
        status: 'not_configured',
        message: 'Redis URL not configured'
      }
    }

    // Test hybrid storage system (if configured)
    try {
      const hybridStorageService = createHybridStorageService()
      const hybridHealth = await hybridStorageService.healthCheck(1) // Use org ID 1 for system check
      results.checks.hybrid_storage = hybridHealth
    } catch (error) {
      results.checks.hybrid_storage = {
        status: 'unhealthy',
        message: `Hybrid storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Test background processor
    try {
      const backgroundProcessor = getBackgroundProcessor()
      const processorHealth = await backgroundProcessor.healthCheck()
      results.checks.background_processor = processorHealth
    } catch (error) {
      results.checks.background_processor = {
        status: 'unhealthy',
        message: `Background processor error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Check environment variables
    const requiredEnvVars = [
      'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
      'JWT_SECRET'
    ]
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    
    results.checks.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
      message: missingEnvVars.length === 0 
        ? 'All required environment variables are set'
        : `Missing environment variables: ${missingEnvVars.join(', ')}`
    }

    // Overall status
    const healthyStatuses = ['healthy', 'not_configured']
    const allHealthy = Object.values(results.checks).every((check: any) => 
      healthyStatuses.includes(check.status)
    )
    
    results.overall_status = allHealthy ? 'healthy' : 'unhealthy'

    // Add system information
    results.system = {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage()
    }

    return NextResponse.json(results, { 
      status: allHealthy ? 200 : 503 
    })

  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json({
      overall_status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}