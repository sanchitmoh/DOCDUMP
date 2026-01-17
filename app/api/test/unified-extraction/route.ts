import { NextRequest, NextResponse } from 'next/server'
import { createUnifiedExtractionService } from '@/lib/services/unified-extraction-service'
import { getBackgroundProcessor } from '@/lib/workers/background-processor'
import * as path from 'path'
import * as fs from 'fs/promises'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Unified Extraction System via API...')

    const unifiedService = createUnifiedExtractionService()
    const backgroundProcessor = getBackgroundProcessor()

    // Test 1: Simple text extraction
    console.log('📝 Creating test text file...')
    const testContent = `
# Test Document for Unified Extraction

This is a comprehensive test document designed to evaluate the unified extraction system.

## Key Features Being Tested:
- Text extraction from multiple file formats
- AI-powered content analysis
- Background job processing
- OCR capabilities
- Structured data extraction

## Sample Content:
The system should be able to extract this text and analyze it using AI to determine:
- Document type: Technical documentation
- Key topics: Testing, extraction, AI analysis
- Sentiment: Neutral/Professional
- Quality score: High

## Conclusion:
This test validates the complete extraction pipeline from file processing to AI analysis.
    `.trim()

    const tempFilePath = path.join(process.cwd(), 'temp', 'test-unified-extraction.txt')
    
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(tempFilePath), { recursive: true })
    await fs.writeFile(tempFilePath, testContent)

    console.log('🔍 Testing direct extraction with AI...')

    // Test 2: Direct extraction with AI
    const extractionResult = await unifiedService.extractWithAI(
      tempFilePath,
      999, // test fileId
      1,   // organizationId
      {
        enableAI: true,
        enableOCR: false,
        preferredMethods: ['text'],
        priority: 8
      }
    )

    console.log('📋 Testing background job creation...')

    // Test 3: Background job creation
    const jobResult = await unifiedService.createBackgroundJob(
      998, // test fileId
      1,   // organizationId
      tempFilePath,
      {
        enableAI: true,
        enableOCR: false,
        preferredMethods: ['text'],
        priority: 7
      }
    )

    console.log('⚙️ Testing background processor status...')

    // Test 4: Background processor status
    const processorStatus = backgroundProcessor.getStatus()
    const queueLengths = await processorStatus.queueLengths

    console.log('🏥 Testing health check...')

    // Test 5: Health check
    const healthCheck = await backgroundProcessor.healthCheck()

    // Clean up
    try {
      await fs.unlink(tempFilePath)
    } catch (error) {
      console.warn('Could not clean up temp file:', error)
    }

    console.log('✅ Unified extraction API test completed')

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        extraction: {
          success: extractionResult.success,
          textLength: extractionResult.text.length,
          method: extractionResult.metadata.method,
          processingTimeMs: extractionResult.metadata.processing_time_ms,
          attempts: extractionResult.metadata.extraction_attempts?.length || 0,
          aiAnalysis: extractionResult.metadata.ai_analysis ? {
            summary: extractionResult.metadata.ai_analysis.summary,
            documentType: extractionResult.metadata.ai_analysis.document_type,
            qualityScore: extractionResult.metadata.ai_analysis.quality_score,
            keyTopics: extractionResult.metadata.ai_analysis.key_topics,
            sentiment: extractionResult.metadata.ai_analysis.sentiment
          } : null
        },
        backgroundJob: {
          success: jobResult.success,
          jobId: jobResult.jobId,
          error: jobResult.error
        },
        backgroundProcessor: {
          isRunning: processorStatus.isRunning,
          queueLengths
        },
        healthCheck: {
          status: healthCheck.status,
          message: healthCheck.message,
          details: healthCheck.details
        }
      },
      extractedText: extractionResult.text.substring(0, 500) + (extractionResult.text.length > 500 ? '...' : ''),
      metadata: extractionResult.metadata
    })

  } catch (error) {
    console.error('❌ Unified extraction API test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileId, organizationId, filePath, options = {} } = body

    if (!fileId || !organizationId || !filePath) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: fileId, organizationId, filePath'
      }, { status: 400 })
    }

    console.log(`🔍 Processing unified extraction for file ${fileId}...`)

    const unifiedService = createUnifiedExtractionService()

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `File not found: ${filePath}`
      }, { status: 404 })
    }

    // Process extraction
    const result = await unifiedService.extractWithAI(
      filePath,
      parseInt(fileId),
      parseInt(organizationId),
      {
        enableAI: options.enableAI !== false,
        enableOCR: options.enableOCR !== false,
        preferredMethods: options.preferredMethods || [],
        priority: options.priority || 5
      }
    )

    return NextResponse.json({
      success: result.success,
      fileId,
      organizationId,
      extraction: {
        textLength: result.text.length,
        method: result.metadata.method,
        processingTimeMs: result.metadata.processing_time_ms,
        confidence: result.metadata.confidence,
        attempts: result.metadata.extraction_attempts
      },
      aiAnalysis: result.metadata.ai_analysis,
      extractedText: result.text.substring(0, 1000) + (result.text.length > 1000 ? '...' : ''),
      error: result.error,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Unified extraction POST failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}