import { NextRequest, NextResponse } from 'next/server'
import { createTextExtractionService } from '@/lib/services/text-extraction'

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    }

    const textExtractionService = createTextExtractionService()
    
    console.log(`Manually processing text extraction job ${jobId}`)
    
    // Process the job directly
    await textExtractionService.processExtractionJob(parseInt(jobId))

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} processed successfully`
    })

  } catch (error) {
    console.error('Error processing job:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    }, { status: 500 })
  }
}