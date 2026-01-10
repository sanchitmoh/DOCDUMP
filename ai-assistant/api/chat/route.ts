import { NextRequest, NextResponse } from 'next/server';
import { aiOrchestrator, ChatMessage, QueryContext } from '../../lib/orchestration/ai-orchestrator';
import { ragService } from '../../lib/retrieval/rag-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      userId, 
      orgId, 
      conversationId, 
      documentIds, 
      contextType,
      conversationHistory = [] 
    } = body;

    // Validate required fields
    if (!message || !userId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, userId, orgId' },
        { status: 400 }
      );
    }

    // Build query context
    const context: QueryContext = {
      userId,
      orgId,
      conversationId: conversationId || `conv_${Date.now()}`,
      documentIds,
      contextType: contextType || 'General'
    };

    // Process the query through AI orchestrator
    const result = await aiOrchestrator.processQuery(
      message,
      context,
      conversationHistory
    );

    // Return comprehensive response
    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        sources: result.sources,
        charts: result.charts || [],
        insights: result.insights || [],
        reasoning: result.reasoning,
        conversationId: context.conversationId,
        timestamp: new Date().toISOString(),
        contextType: context.contextType
      }
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    
    // Handle specific error types
    if (error.message.includes('Rate limit exceeded')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    if (error.message.includes('OpenAI')) {
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving conversation history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const orgId = searchParams.get('orgId');
    const conversationId = searchParams.get('conversationId');

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, orgId' },
        { status: 400 }
      );
    }

    // Get conversation history from memory
    const { mongoMemory } = await import('../../lib/memory/mongo-memory');
    const { redisMemory } = await import('../../lib/memory/redis-memory');

    let history = [];
    
    if (conversationId) {
      // Get specific conversation
      const longTermMemory = await mongoMemory.getLongTermMemory(userId, orgId);
      const conversation = longTermMemory.find(conv => conv.conversationId === conversationId);
      history = conversation?.messages || [];
    } else {
      // Get recent short-term memory
      history = await redisMemory.getShortTermMemory(userId, orgId) || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        history,
        conversationId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Get History Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve conversation history' },
      { status: 500 }
    );
  }
}