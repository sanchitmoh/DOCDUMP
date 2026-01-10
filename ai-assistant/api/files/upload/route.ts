import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../lib/processing/file-processor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const orgId = formData.get('orgId') as string;

    if (!file || !userId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, userId, orgId' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 10MB allowed.' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // docx
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: PDF, Excel, CSV, Word, Text' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Get file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    
    console.log(`Processing uploaded file: ${file.name} (${file.type})`);

    // Process the file
    const processedFile = await fileProcessor.processUploadedFile(
      buffer,
      file.name,
      fileExtension,
      userId,
      orgId
    );

    return NextResponse.json({
      success: true,
      message: 'File processed successfully and ready for analysis',
      data: {
        fileId: processedFile.fileId,
        fileName: processedFile.fileName,
        fileType: processedFile.fileType,
        summary: processedFile.analytics.summary,
        keyMetrics: processedFile.analytics.keyMetrics,
        insights: processedFile.analytics.insights,
        suggestedQuestions: processedFile.analytics.suggestedQuestions,
        readyForChat: processedFile.readyForChat,
        analytics: {
          dataType: processedFile.analytics.dataType,
          rowCount: processedFile.content.tables[0]?.rowCount || 0,
          hasCharts: processedFile.content.tables.length > 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('File upload processing error:', error);
    
    if (error.message.includes('Invalid file format')) {
      return NextResponse.json(
        { error: 'Invalid file format. Please check your file and try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process file. Please try again.' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve processed file info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const orgId = searchParams.get('orgId');

    if (!fileId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileId, orgId' },
        { status: 400 }
      );
    }

    // In a real implementation, you'd retrieve from database
    // For now, return a sample response
    return NextResponse.json({
      success: true,
      data: {
        fileId,
        status: 'processed',
        readyForAnalysis: true,
        lastProcessed: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Get file info error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve file information' },
      { status: 500 }
    );
  }
}