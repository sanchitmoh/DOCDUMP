import { NextRequest, NextResponse } from 'next/server'
import { createFileService } from '@/lib/services/file-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId parameter required' }, { status: 400 })
    }

    const fileService = createFileService()
    
    // Test AI summary generation
    const result = await fileService.generateAISummary(
      parseInt(fileId),
      3, // organization ID
      1  // user ID
    )

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('Test AI summary error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, { status: 500 })
  }
}