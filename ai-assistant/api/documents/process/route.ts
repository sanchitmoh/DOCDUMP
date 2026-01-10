import { NextRequest, NextResponse } from 'next/server';
import { ragService } from '../../../lib/retrieval/rag-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, orgId, title, content } = body;

    // Validate required fields
    if (!documentId || !orgId || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, orgId, title, content' },
        { status: 400 }
      );
    }

    // Process and store document for RAG
    await ragService.processAndStoreDocument(documentId, orgId, title, content);

    return NextResponse.json({
      success: true,
      message: 'Document processed and stored successfully',
      documentId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Document Processing Error:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve document summaries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const documentIds = searchParams.get('documentIds')?.split(',');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing required parameter: orgId' },
        { status: 400 }
      );
    }

    const { mongoMemory } = await import('../../../lib/memory/mongo-memory');
    const summaries = await mongoMemory.getDocumentSummaries(orgId, documentIds);

    return NextResponse.json({
      success: true,
      data: summaries,
      count: summaries.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Get Document Summaries Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve document summaries' },
      { status: 500 }
    );
  }
}