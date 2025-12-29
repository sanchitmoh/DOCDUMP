import { NextRequest, NextResponse } from 'next/server'
import { getRedisInstance } from '@/lib/cache/redis'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisInstance()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'test'

    const results: any = {
      action,
      timestamp: new Date().toISOString(),
      results: {}
    }

    switch (action) {
      case 'test':
        // Basic cache operations
        await redis.set('demo:basic', { message: 'Hello Redis!', count: 42 }, { ttl: 300 })
        const basicValue = await redis.get('demo:basic')
        
        results.results.basic_cache = {
          set: 'demo:basic',
          get: basicValue,
          exists: await redis.exists('demo:basic')
        }
        break

      case 'session':
        // Session management demo
        const sessionId = 'demo-session-' + Date.now()
        const sessionData = {
          userId: 'user123',
          userType: 'employee' as const,
          organizationId: 'org456',
          email: 'demo@example.com',
          fullName: 'Demo User',
          lastActivity: new Date(),
          ipAddress: '127.0.0.1'
        }
        
        await redis.createSession(sessionId, sessionData, 3600)
        const retrievedSession = await redis.getSession(sessionId)
        
        results.results.session_management = {
          sessionId,
          created: sessionData,
          retrieved: retrievedSession
        }
        break

      case 'rate_limit':
        // Rate limiting demo
        const identifier = 'demo-user-' + Date.now()
        const rateLimit1 = await redis.checkRateLimit(identifier, 5, 60) // 5 requests per minute
        const rateLimit2 = await redis.checkRateLimit(identifier, 5, 60)
        const rateLimit3 = await redis.checkRateLimit(identifier, 5, 60)
        
        results.results.rate_limiting = {
          request_1: rateLimit1,
          request_2: rateLimit2,
          request_3: rateLimit3
        }
        break

      case 'search_cache':
        // Search result caching demo
        const query = 'corporate documents'
        const filters = { department: 'IT', file_type: 'pdf' }
        const mockResults = {
          total: 25,
          documents: [
            { id: 1, title: 'IT Policy Document', score: 0.95 },
            { id: 2, title: 'Network Security Guide', score: 0.87 }
          ]
        }
        
        await redis.cacheSearchResults(query, filters, mockResults, 300)
        const cachedResults = await redis.getCachedSearchResults(query, filters)
        
        results.results.search_cache = {
          query,
          filters,
          cached: cachedResults
        }
        break

      case 'job_queue':
        // Job queue demo
        const queueName = 'document-processing'
        const jobData = {
          fileId: 'file123',
          action: 'extract_text',
          priority: 'high'
        }
        
        await redis.addJob(queueName, jobData, 10) // Priority 10
        await redis.addJob(queueName, { ...jobData, fileId: 'file124' }, 5) // Priority 5
        
        const queueLength = await redis.getQueueLength(queueName)
        const nextJob = await redis.getNextJob(queueName)
        
        results.results.job_queue = {
          queue: queueName,
          added_jobs: 2,
          queue_length_before: queueLength + 1, // +1 because we removed one
          next_job: nextJob,
          queue_length_after: await redis.getQueueLength(queueName)
        }
        break

      case 'info':
        // Redis information
        const info = await redis.getInfo()
        const health = await redis.healthCheck()
        
        results.results.redis_info = {
          health,
          server_info: info.split('\n').slice(0, 10).join('\n') // First 10 lines
        }
        break

      case 'cleanup':
        // Cleanup demo data
        await redis.clearPattern('demo:*')
        await redis.clearPattern('session:demo-*')
        await redis.clearPattern('rate_limit:demo-*')
        await redis.clearPattern('search:*')
        await redis.clearPattern('queue:document-processing')
        
        results.results.cleanup = {
          message: 'Demo data cleared successfully'
        }
        break

      default:
        results.results.error = 'Invalid action. Available actions: test, session, rate_limit, search_cache, job_queue, info, cleanup'
    }

    return NextResponse.json(results)

  } catch (error) {
    console.error('Redis demo error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const redis = getRedisInstance()
    const body = await request.json()
    const { key, value, ttl } = body

    if (!key || value === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Key and value are required'
      }, { status: 400 })
    }

    await redis.set(key, value, { ttl: ttl || 300 })
    
    return NextResponse.json({
      success: true,
      message: 'Value cached successfully',
      key,
      ttl: ttl || 300,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Redis cache POST error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const redis = getRedisInstance()
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({
        success: false,
        error: 'Key parameter is required'
      }, { status: 400 })
    }

    await redis.del(key)
    
    return NextResponse.json({
      success: true,
      message: 'Key deleted successfully',
      key,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Redis cache DELETE error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}