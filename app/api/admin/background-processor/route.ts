import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery } from '@/lib/database'
import { getRedisInstance } from '@/lib/cache/redis'
import { enhanceRedisWithQueue } from '@/lib/cache/enhanced-redis'
import { createOptimizedBackgroundProcessor } from '@/lib/workers/optimized-background-processor'

// Global processor instance (singleton)
let globalProcessor: any = null

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Only allow organization admins
    if (auth.user.type !== 'organization') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'

    const redis = enhanceRedisWithQueue(getRedisInstance())

    switch (action) {
      case 'status':
        return await getProcessorStatus(redis)
      
      case 'metrics':
        return await getDetailedMetrics(redis, auth.user.organizationId)
      
      case 'queues':
        return await getQueueInformation(redis)
      
      case 'jobs':
        return await getJobInformation(redis, auth.user.organizationId)
      
      case 'health':
        return await getHealthCheck(redis)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in background processor API:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Only allow organization admins
    if (auth.user.type !== 'organization') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action, config } = body

    switch (action) {
      case 'start':
        return await startProcessor(config)
      
      case 'stop':
        return await stopProcessor()
      
      case 'restart':
        return await restartProcessor(config)
      
      case 'configure':
        return await configureProcessor(config)
      
      case 'clear-queue':
        return await clearQueue(body.queueName)
      
      case 'retry-failed':
        return await retryFailedJobs(body.queueName)
      
      case 'process-pending':
        return await processPendingJobs(auth.user.organizationId)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in background processor POST:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function getProcessorStatus(redis: any) {
  const isRunning = globalProcessor?.isRunning || false
  const metrics = globalProcessor?.getMetrics() || null
  const healthCheck = globalProcessor ? await globalProcessor.healthCheck() : null

  // Get Redis health
  const redisHealth = await redis.healthCheck()

  // Get queue lengths
  const queueLengths = {}
  const queues = ['unified-extraction', 'text-extraction', 'storage-sync', 'search-indexing']
  
  for (const queue of queues) {
    try {
      queueLengths[queue] = await redis.getQueueLength(queue)
    } catch (error) {
      queueLengths[queue] = 0
    }
  }

  return NextResponse.json({
    success: true,
    processor: {
      isRunning,
      status: healthCheck?.status || 'unknown',
      metrics,
      issues: healthCheck?.issues || []
    },
    redis: {
      status: redisHealth.status,
      latency: redisHealth.latency,
      queues: queueLengths
    },
    timestamp: new Date().toISOString()
  })
}

async function getDetailedMetrics(redis: any, organizationId: number) {
  // Get database metrics
  const dbMetrics = await executeQuery(`
    SELECT 
      COUNT(*) as total_jobs,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_jobs,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_jobs,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
      AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN TIMESTAMPDIFF(MICROSECOND, started_at, completed_at) / 1000 
          END) as avg_processing_time_ms,
      COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as jobs_last_hour,
      COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as jobs_last_24h
    FROM text_extraction_jobs 
    WHERE organization_id = ?
  `, [organizationId])

  // Get extraction method breakdown
  const methodBreakdown = await executeQuery(`
    SELECT 
      extraction_method,
      COUNT(*) as count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN TIMESTAMPDIFF(MICROSECOND, started_at, completed_at) / 1000 
          END) as avg_time_ms
    FROM text_extraction_jobs 
    WHERE organization_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY extraction_method
    ORDER BY count DESC
  `, [organizationId])

  // Get recent job activity
  const recentActivity = await executeQuery(`
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
      COUNT(*) as jobs_created,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as jobs_completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as jobs_failed
    FROM text_extraction_jobs 
    WHERE organization_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')
    ORDER BY hour DESC
    LIMIT 24
  `, [organizationId])

  // Get Redis queue stats
  const queueStats = {}
  const queues = ['unified-extraction', 'text-extraction', 'storage-sync', 'search-indexing']
  
  for (const queue of queues) {
    try {
      queueStats[queue] = await redis.getQueueStats(queue)
    } catch (error) {
      queueStats[queue] = { length: 0, processing: 0, completed: 0, failed: 0 }
    }
  }

  // Get processor metrics if available
  const processorMetrics = globalProcessor?.getMetrics() || {
    totalJobsProcessed: 0,
    successfulJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    throughputPerMinute: 0
  }

  return NextResponse.json({
    success: true,
    metrics: {
      database: dbMetrics[0],
      methodBreakdown,
      recentActivity,
      queueStats,
      processor: processorMetrics
    },
    timestamp: new Date().toISOString()
  })
}

async function getQueueInformation(redis: any) {
  const queues = await redis.getAllQueues()
  const queueInfo = {}

  for (const queue of queues) {
    const stats = await redis.getQueueStats(queue)
    const processingJobs = await redis.getProcessingJobs(queue)
    const failedJobs = await redis.getFailedJobs(queue)

    queueInfo[queue] = {
      stats,
      processingJobs: processingJobs.slice(0, 10), // Limit to 10 for performance
      failedJobs: failedJobs.slice(0, 10),
      health: stats.length < 100 ? 'healthy' : stats.length < 500 ? 'warning' : 'critical'
    }
  }

  return NextResponse.json({
    success: true,
    queues: queueInfo,
    summary: {
      totalQueues: queues.length,
      totalJobs: Object.values(queueInfo).reduce((sum: number, info: any) => sum + info.stats.length, 0),
      healthyQueues: Object.values(queueInfo).filter((info: any) => info.health === 'healthy').length
    },
    timestamp: new Date().toISOString()
  })
}

async function getJobInformation(redis: any, organizationId: number) {
  // Get recent jobs from database
  const recentJobs = await executeQuery(`
    SELECT 
      tej.*,
      f.name as file_name,
      f.mime_type,
      f.size_bytes,
      TIMESTAMPDIFF(SECOND, tej.created_at, COALESCE(tej.completed_at, NOW())) as duration_seconds
    FROM text_extraction_jobs tej
    LEFT JOIN files f ON tej.file_id = f.id
    WHERE tej.organization_id = ?
    ORDER BY tej.created_at DESC
    LIMIT 50
  `, [organizationId])

  // Get job status distribution
  const statusDistribution = await executeQuery(`
    SELECT 
      status,
      COUNT(*) as count,
      AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN TIMESTAMPDIFF(MICROSECOND, started_at, completed_at) / 1000 
          END) as avg_duration_ms
    FROM text_extraction_jobs 
    WHERE organization_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY status
  `, [organizationId])

  // Get priority distribution
  const priorityDistribution = await executeQuery(`
    SELECT 
      priority,
      COUNT(*) as count,
      AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN TIMESTAMPDIFF(MICROSECOND, started_at, completed_at) / 1000 
          END) as avg_duration_ms
    FROM text_extraction_jobs 
    WHERE organization_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY priority
    ORDER BY priority DESC
  `, [organizationId])

  return NextResponse.json({
    success: true,
    jobs: {
      recent: recentJobs,
      statusDistribution,
      priorityDistribution
    },
    timestamp: new Date().toISOString()
  })
}

async function getHealthCheck(redis: any) {
  const checks = {
    redis: { status: 'unknown', details: {} },
    processor: { status: 'unknown', details: {} },
    database: { status: 'unknown', details: {} },
    queues: { status: 'unknown', details: {} }
  }

  // Redis health check
  try {
    const redisHealth = await redis.healthCheck()
    checks.redis = {
      status: redisHealth.status,
      details: {
        latency: redisHealth.latency,
        memory: redisHealth.memory
      }
    }
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }

  // Processor health check
  try {
    if (globalProcessor) {
      const processorHealth = await globalProcessor.healthCheck()
      checks.processor = {
        status: processorHealth.status,
        details: {
          isRunning: processorHealth.isRunning,
          issues: processorHealth.issues,
          metrics: processorHealth.metrics
        }
      }
    } else {
      checks.processor = {
        status: 'stopped',
        details: { message: 'Processor not initialized' }
      }
    }
  } catch (error) {
    checks.processor = {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }

  // Database health check
  try {
    await executeQuery('SELECT 1')
    checks.database = {
      status: 'healthy',
      details: { message: 'Database connection successful' }
    }
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }

  // Queue health check
  try {
    const queues = await redis.getAllQueues()
    let totalJobs = 0
    let criticalQueues = 0

    for (const queue of queues) {
      const length = await redis.getQueueLength(queue)
      totalJobs += length
      if (length > 500) criticalQueues++
    }

    checks.queues = {
      status: criticalQueues > 0 ? 'critical' : totalJobs > 100 ? 'warning' : 'healthy',
      details: {
        totalQueues: queues.length,
        totalJobs,
        criticalQueues
      }
    }
  } catch (error) {
    checks.queues = {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }

  // Overall health
  const healthStatuses = Object.values(checks).map(check => check.status)
  const overallStatus = healthStatuses.includes('unhealthy') ? 'unhealthy' :
                       healthStatuses.includes('critical') ? 'critical' :
                       healthStatuses.includes('warning') ? 'warning' : 'healthy'

  return NextResponse.json({
    success: true,
    health: {
      overall: overallStatus,
      checks
    },
    timestamp: new Date().toISOString()
  })
}

async function startProcessor(config?: any) {
  try {
    if (globalProcessor?.isRunning) {
      return NextResponse.json({
        success: false,
        message: 'Processor is already running'
      })
    }

    if (!globalProcessor) {
      globalProcessor = createOptimizedBackgroundProcessor(config)
    }

    await globalProcessor.start()

    return NextResponse.json({
      success: true,
      message: 'Background processor started successfully',
      config: globalProcessor.config
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start processor'
    }, { status: 500 })
  }
}

async function stopProcessor() {
  try {
    if (!globalProcessor?.isRunning) {
      return NextResponse.json({
        success: false,
        message: 'Processor is not running'
      })
    }

    await globalProcessor.stop()

    return NextResponse.json({
      success: true,
      message: 'Background processor stopped successfully'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop processor'
    }, { status: 500 })
  }
}

async function restartProcessor(config?: any) {
  try {
    if (globalProcessor?.isRunning) {
      await globalProcessor.stop()
    }

    if (config) {
      globalProcessor = createOptimizedBackgroundProcessor(config)
    }

    await globalProcessor.start()

    return NextResponse.json({
      success: true,
      message: 'Background processor restarted successfully',
      config: globalProcessor.config
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restart processor'
    }, { status: 500 })
  }
}

async function configureProcessor(config: any) {
  try {
    if (!globalProcessor) {
      globalProcessor = createOptimizedBackgroundProcessor(config)
    } else {
      globalProcessor.updateConfig(config)
    }

    return NextResponse.json({
      success: true,
      message: 'Processor configuration updated',
      config: globalProcessor.config
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure processor'
    }, { status: 500 })
  }
}

async function clearQueue(queueName: string) {
  try {
    const redis = enhanceRedisWithQueue(getRedisInstance())
    await redis.clearQueue(queueName)

    return NextResponse.json({
      success: true,
      message: `Queue ${queueName} cleared successfully`
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear queue'
    }, { status: 500 })
  }
}

async function retryFailedJobs(queueName: string) {
  try {
    const redis = enhanceRedisWithQueue(getRedisInstance())
    const failedJobs = await redis.getFailedJobs(queueName)

    let retriedCount = 0
    for (const job of failedJobs) {
      try {
        await redis.retryJob(queueName, job.jobId)
        retriedCount++
      } catch (error) {
        console.error(`Failed to retry job ${job.jobId}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Retried ${retriedCount} failed jobs`,
      retriedCount,
      totalFailedJobs: failedJobs.length
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry jobs'
    }, { status: 500 })
  }
}

async function processPendingJobs(organizationId: number) {
  try {
    const redis = enhanceRedisWithQueue(getRedisInstance())
    
    // Get pending jobs from database
    const pendingJobs = await executeQuery(`
      SELECT id, file_id, extraction_method, priority
      FROM text_extraction_jobs 
      WHERE organization_id = ? AND status = 'pending'
      ORDER BY priority DESC, created_at ASC
      LIMIT 100
    `, [organizationId])

    let queuedCount = 0
    for (const job of pendingJobs) {
      try {
        await redis.addJob('unified-extraction', {
          jobId: job.id,
          fileId: job.file_id,
          organizationId,
          extractionMethod: job.extraction_method
        }, job.priority || 5)
        
        queuedCount++
      } catch (error) {
        console.error(`Failed to queue job ${job.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${queuedCount} pending jobs for processing`,
      queuedCount,
      totalPendingJobs: pendingJobs.length
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process pending jobs'
    }, { status: 500 })
  }
}