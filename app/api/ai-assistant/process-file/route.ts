import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeSingle } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, fileContent, userId, orgId, fileType } = body;

    // Validate required fields
    if (!fileId || !fileName || !userId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId, fileName, userId, orgId' },
        { status: 400 }
      );
    }

    // For now, return a mock response until the full AI processing system is set up
    console.log(`Mock AI processing for file: ${fileName} (${fileId})`);

    // Mock AI processing results
    const mockResults = {
      fileId,
      fileName,
      summary: `AI-generated summary for ${fileName}. This document contains important information that has been analyzed by our AI system.`,
      keyMetrics: ['Document processed', 'Content analyzed', 'Ready for chat'],
      insights: [
        'This document contains structured data',
        'Key information has been extracted',
        'Document is ready for AI analysis'
      ],
      suggestedQuestions: [
        `What are the main points in ${fileName}?`,
        'Can you summarize this document?',
        'What insights can you provide?'
      ],
      readyForChat: true,
      analytics: {
        dataType: 'mixed',
        hasCharts: false,
        processingTime: Date.now()
      }
    };

    // Update the file with mock AI results
    await updateFileWithAIResults(fileId, mockResults, orgId);

    return NextResponse.json({
      success: true,
      message: 'File processed successfully for AI analysis',
      data: mockResults
    });

  } catch (error: any) {
    console.error('AI file processing error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process file for AI analysis',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

async function updateFileWithAIResults(fileId: string, processedFile: any, orgId: string) {
  try {
    // Update your existing files table with AI analysis results
    const updateQuery = `
      UPDATE files 
      SET 
        ai_processed = true,
        ai_summary = ?,
        ai_insights = ?,
        ai_suggested_questions = ?,
        ai_data_type = ?,
        ready_for_analysis = ?,
        ai_processed_at = NOW()
      WHERE id = ? AND organization_id = ?
    `;

    await executeSingle(updateQuery, [
      processedFile.summary,
      JSON.stringify(processedFile.insights),
      JSON.stringify(processedFile.suggestedQuestions),
      processedFile.analytics.dataType || 'mixed',
      processedFile.readyForChat,
      fileId,
      orgId
    ]);

    console.log(`Updated file ${fileId} with AI results`);
  } catch (error) {
    console.error('Failed to update file with AI results:', error);
    // Don't throw error - AI processing succeeded, DB update failed
  }
}

// GET endpoint to check AI processing status
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

    // Check AI processing status from your database
    const query = `
      SELECT 
        ai_processed,
        ai_summary,
        ai_insights,
        ai_suggested_questions,
        ai_data_type,
        ready_for_analysis,
        ai_processed_at
      FROM files 
      WHERE id = ? AND organization_id = ?
    `;

    const rows = await executeQuery(query, [fileId, orgId]);
    const file = rows[0];

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        aiProcessed: file.ai_processed,
        summary: file.ai_summary,
        insights: file.ai_insights ? JSON.parse(file.ai_insights) : [],
        suggestedQuestions: file.ai_suggested_questions ? JSON.parse(file.ai_suggested_questions) : [],
        dataType: file.ai_data_type,
        readyForAnalysis: file.ready_for_analysis,
        processedAt: file.ai_processed_at
      }
    });

  } catch (error: any) {
    console.error('Get AI status error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve AI processing status' },
      { status: 500 }
    );
  }
}