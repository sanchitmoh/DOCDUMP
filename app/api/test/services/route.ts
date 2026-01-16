import { NextResponse } from 'next/server'
import { createSearchService } from '@/lib/search'
import { getRedisInstance } from '@/lib/cache/redis'
import { testConnection } from '@/lib/database'
import { createS3Service } from '@/lib/storage/s3'
import { createTextExtractionService } from '@/lib/services/text-extraction'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    services: {}
  }

  // Test Database
  try {
    const dbHealthy = await testConnection()
    results.services.database = {
      status: dbHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY',
      message: dbHealthy ? 'Connected successfully' : 'Connection failed'
    }
  } catch (error) {
    results.services.database = {
      status: '❌ ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Test Redis
  try {
    const redis = getRedisInstance()
    const redisHealth = await redis.healthCheck()
    results.services.redis = {
      status: redisHealth.status === 'healthy' ? '✅ HEALTHY' : '❌ UNHEALTHY',
      message: redisHealth.message
    }
  } catch (error) {
    results.services.redis = {
      status: '❌ ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Test OpenSearch/Elasticsearch
  try {
    const searchService = createSearchService()
    const searchHealth = await searchService.healthCheck()
    results.services.search = {
      status: searchHealth.status === 'healthy' ? '✅ HEALTHY' : '❌ UNHEALTHY',
      message: searchHealth.message,
      type: process.env.ELASTICSEARCH_URL?.includes('bonsaisearch.net') ? 'OpenSearch (Bonsai)' : 'Elasticsearch'
    }
  } catch (error) {
    results.services.search = {
      status: '❌ ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Test S3
  try {
    const s3Service = createS3Service()
    const s3Health = await s3Service.healthCheck()
    results.services.s3 = {
      status: s3Health.status === 'healthy' ? '✅ HEALTHY' : '❌ UNHEALTHY',
      message: s3Health.message
    }
  } catch (error) {
    results.services.s3 = {
      status: '❌ ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Test Text Extraction
  try {
    const textService = createTextExtractionService()
    results.services.text_extraction = {
      status: '✅ AVAILABLE',
      message: 'Text extraction service initialized',
      ocr_enabled: process.env.ENABLE_OCR === 'true'
    }
  } catch (error) {
    results.services.text_extraction = {
      status: '❌ ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Test AI (OpenAI)
  try {
    const hasApiKey = !!process.env.OPENAI_API_KEY
    results.services.ai = {
      status: hasApiKey ? '✅ CONFIGURED' : '⚠️ NOT CONFIGURED',
      message: hasApiKey ? 'OpenAI API key found' : 'OpenAI API key not set',
      model: process.env.OPENAI_MODEL_CHAT || 'gpt-4o-mini'
    }
  } catch (error) {
    results.services.ai = {
      status: '❌ ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Overall status
  const allHealthy = Object.values(results.services).every((service: any) => 
    service.status.includes('✅') || service.status.includes('⚠️')
  )

  results.overall = allHealthy ? '✅ ALL SERVICES OPERATIONAL' : '❌ SOME SERVICES HAVE ISSUES'

  return NextResponse.json(results, {
    status: allHealthy ? 200 : 503
  })
}
