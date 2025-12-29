import { NextRequest, NextResponse } from 'next/server'
import { createS3Service } from '@/lib/storage/s3'
import { createLocalStorageService } from '@/lib/storage/local'
import { createHybridStorageManager } from '@/lib/storage/hybrid'

export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      storage_mode: process.env.STORAGE_MODE || 'hybrid',
      tests: {}
    }

    // Test S3 connection
    try {
      const s3Service = createS3Service()
      const s3Health = await s3Service.healthCheck()
      results.tests.s3 = s3Health
    } catch (error) {
      results.tests.s3 = {
        status: 'unhealthy',
        message: `S3 setup error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Test Local Storage
    try {
      const localService = createLocalStorageService()
      await localService.initialize()
      const localHealth = await localService.healthCheck()
      results.tests.local = localHealth
    } catch (error) {
      results.tests.local = {
        status: 'unhealthy',
        message: `Local storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Test Hybrid Storage Manager
    try {
      const hybridManager = createHybridStorageManager()
      results.tests.hybrid = {
        status: 'healthy',
        message: 'Hybrid storage manager initialized successfully'
      }
    } catch (error) {
      results.tests.hybrid = {
        status: 'unhealthy',
        message: `Hybrid storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Overall status
    const allHealthy = Object.values(results.tests).every((test: any) => test.status === 'healthy')
    results.overall_status = allHealthy ? 'healthy' : 'unhealthy'

    return NextResponse.json(results, { 
      status: allHealthy ? 200 : 503 
    })

  } catch (error) {
    console.error('Storage setup test error:', error)
    
    return NextResponse.json({
      overall_status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}