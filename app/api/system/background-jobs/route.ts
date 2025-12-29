import { NextRequest, NextResponse } from 'next/server'
import { getBackgroundProcessor } from '@/lib/workers/background-processor'

export async function GET(request: NextRequest) {
  try {
    const processor = getBackgroundProcessor()
    const status = processor.getStatus()
    const health = await processor.healthCheck()
    const queueLengths = await status.queueLengths

    return NextResponse.json({
      success: true,
      processor_status: {
        is_running: status.isRunning,
        queue_lengths: queueLengths,
        health_check: health
      }
    })

  } catch (error) {
    console.error('Error checking background processor status:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check status'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    const processor = getBackgroundProcessor()

    if (action === 'start') {
      await processor.start()
      await processor.processPendingDatabaseJobs()
      
      return NextResponse.json({
        success: true,
        message: 'Background processor started and pending jobs queued'
      })
    } else if (action === 'stop') {
      await processor.stop()
      
      return NextResponse.json({
        success: true,
        message: 'Background processor stopped'
      })
    } else if (action === 'process-pending') {
      await processor.processPendingDatabaseJobs()
      
      return NextResponse.json({
        success: true,
        message: 'Pending jobs added to queue'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "start", "stop", or "process-pending"'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error controlling background processor:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Operation failed'
    }, { status: 500 })
  }
}