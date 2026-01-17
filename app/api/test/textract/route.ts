import { NextRequest, NextResponse } from 'next/server'
import { createAWSTextractService } from '@/lib/services/aws-textract'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import * as fs from 'fs/promises'
import * as path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { filePath, useAnalysis = false, method = 'auto' } = await request.json()

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    console.log(`🧪 Testing Textract with file: ${filePath}`)

    let result: any

    if (method === 'direct') {
      // Test direct Textract service
      const textractService = createAWSTextractService()
      
      if (useAnalysis) {
        result = await textractService.analyzeDocumentAuto(filePath, ['TABLES', 'FORMS'])
      } else {
        result = await textractService.extractTextAuto(filePath)
      }

      return NextResponse.json({
        success: true,
        method: 'direct_textract',
        data: {
          text: result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''),
          textLength: result.text.length,
          confidence: Math.round(result.confidence),
          metadata: result.metadata,
          tables: result.tables?.length || 0,
          forms: result.forms?.length || 0,
          structuredData: useAnalysis ? {
            tables: result.tables?.slice(0, 2), // First 2 tables
            forms: result.forms?.slice(0, 5)    // First 5 forms
          } : undefined
        }
      })

    } else {
      // Test through extraction service
      const extractionService = createTextExtractionService()
      result = await extractionService.extractWithTextract(filePath, useAnalysis)

      return NextResponse.json({
        success: true,
        method: 'extraction_service',
        data: {
          text: result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''),
          textLength: result.text.length,
          metadata: result.metadata
        }
      })
    }

  } catch (error) {
    console.error('Textract test error:', error)
    
    let errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let troubleshooting: string[] = []

    // Provide specific troubleshooting based on error type
    if (errorMessage.includes('credentials')) {
      troubleshooting = [
        'Check AWS_ACCESS_KEY_ID in .env.local',
        'Check AWS_SECRET_ACCESS_KEY in .env.local',
        'Verify AWS credentials have Textract permissions'
      ]
    } else if (errorMessage.includes('S3')) {
      troubleshooting = [
        'Check AWS_S3_BUCKET in .env.local',
        'Verify S3 bucket exists and is accessible',
        'Ensure AWS credentials have S3 permissions'
      ]
    } else if (errorMessage.includes('File too large')) {
      troubleshooting = [
        'File is larger than 10MB - async processing required',
        'Ensure S3 bucket is configured for async processing',
        'Consider compressing the file'
      ]
    } else if (errorMessage.includes('Unsupported file type')) {
      troubleshooting = [
        'Textract supports: PDF, PNG, JPG, JPEG, TIFF',
        'Convert file to supported format',
        'Check file extension and content type'
      ]
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        troubleshooting,
        awsConfig: {
          region: process.env.AWS_REGION,
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          bucket: process.env.AWS_S3_BUCKET
        }
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AWS Textract Test Endpoint',
    usage: {
      method: 'POST',
      body: {
        filePath: 'string (required) - Path to file to process',
        useAnalysis: 'boolean (optional) - Extract tables and forms',
        method: 'string (optional) - "auto" (default) or "direct"'
      }
    },
    examples: [
      {
        description: 'Basic text extraction',
        body: {
          filePath: './test-document.pdf'
        }
      },
      {
        description: 'Document analysis with tables and forms',
        body: {
          filePath: './test-document.pdf',
          useAnalysis: true
        }
      },
      {
        description: 'Direct Textract service test',
        body: {
          filePath: './test-document.pdf',
          method: 'direct',
          useAnalysis: true
        }
      }
    ],
    supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG', 'TIFF'],
    limits: {
      syncProcessing: '10MB max file size',
      asyncProcessing: '500MB max file size (requires S3)'
    }
  })
}