import { NextRequest, NextResponse } from 'next/server';
import { aiOrchestrator, QueryContext } from '../../../lib/orchestration/ai-orchestrator';
import { fileAnalytics } from '../../../lib/analytics/file-analytics';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      userId, 
      orgId, 
      fileId,
      fileName,
      conversationId,
      analysisType = 'general',
      conversationHistory = [],
      requestType = 'chat' // 'chat', 'analysis', 'quick_insight'
    } = body;

    // Validate required fields
    if (!message || !userId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, userId, orgId' },
        { status: 400 }
      );
    }

    let result;

    switch (requestType) {
      case 'analysis':
        // Deep file analysis
        result = await handleFileAnalysis(message, fileId, userId, orgId, analysisType);
        break;
        
      case 'quick_insight':
        // Quick insights from file
        result = await handleQuickInsight(fileId, userId, orgId);
        break;
        
      default:
        // Regular chat with optional file context
        result = await handleRegularChat(message, userId, orgId, conversationId, fileId, conversationHistory);
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Integration chat error:', error);
    
    if (error.message.includes('Rate limit exceeded')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    );
  }
}

async function handleFileAnalysis(
  question: string, 
  fileId: string, 
  userId: string, 
  orgId: string, 
  analysisType: string
) {
  if (!fileId) {
    throw new Error('File ID required for analysis');
  }

  // Build context for file-specific analysis
  const context: QueryContext = {
    userId,
    orgId,
    conversationId: `file_analysis_${fileId}_${Date.now()}`,
    documentIds: [fileId],
    contextType: 'General'
  };

  // Enhanced question with analysis context
  const enhancedQuestion = `Perform ${analysisType} analysis on the uploaded file and answer: ${question}`;

  // Process through AI orchestrator
  const aiResult = await aiOrchestrator.processQuery(enhancedQuestion, context, []);

  return {
    type: 'file_analysis',
    question,
    answer: aiResult.response,
    sources: aiResult.sources,
    charts: aiResult.charts || [],
    insights: aiResult.insights || [],
    reasoning: aiResult.reasoning,
    fileId,
    analysisType,
    conversationId: context.conversationId,
    metadata: {
      hasVisualizations: (aiResult.charts || []).length > 0,
      sourcesUsed: aiResult.sources.length,
      confidenceLevel: aiResult.sources.length > 0 ? 'high' : 'medium'
    }
  };
}

async function handleQuickInsight(fileId: string, userId: string, orgId: string) {
  if (!fileId) {
    throw new Error('File ID required for quick insights');
  }

  // This would typically fetch the processed file data from your database
  // For now, we'll simulate it
  const mockFileData = {
    tables: [{
      headers: ['Month', 'Revenue', 'Growth', 'Region'],
      rows: [
        ['Jan', 100000, 5.2, 'North'],
        ['Feb', 110000, 10.0, 'North'],
        ['Mar', 95000, -4.5, 'South'],
        // ... more data
      ]
    }]
  };

  // Perform quick analytics
  const analytics = await fileAnalytics.performDeepAnalysis(mockFileData, 'sales');

  return {
    type: 'quick_insight',
    fileId,
    summary: analytics.summary,
    keyInsights: [
      `Found ${analytics.summary.totalRecords} records with ${analytics.insights.trends.length} trends identified`,
      `Data quality is ${analytics.summary.dataQuality}`,
      `${analytics.insights.anomalies.length} anomalies detected requiring attention`
    ],
    trends: analytics.insights.trends,
    recommendations: analytics.recommendations.slice(0, 3),
    charts: analytics.charts.slice(0, 2), // Top 2 charts for quick view
    metadata: {
      analysisDepth: 'quick',
      processingTime: '< 5 seconds',
      dataPoints: analytics.summary.totalRecords
    }
  };
}

async function handleRegularChat(
  message: string,
  userId: string,
  orgId: string,
  conversationId: string,
  fileId?: string,
  conversationHistory: any[] = []
) {
  const context: QueryContext = {
    userId,
    orgId,
    conversationId: conversationId || `chat_${Date.now()}`,
    documentIds: fileId ? [fileId] : undefined,
    contextType: 'General'
  };

  // Add file context to message if fileId is provided
  const contextualMessage = fileId 
    ? `Based on the uploaded file (${fileId}), ${message}`
    : message;

  const result = await aiOrchestrator.processQuery(contextualMessage, context, conversationHistory);

  return {
    type: 'chat',
    message,
    response: result.response,
    sources: result.sources,
    charts: result.charts || [],
    insights: result.insights || [],
    reasoning: result.reasoning,
    conversationId: context.conversationId,
    fileContext: fileId ? { fileId, hasFileContext: true } : { hasFileContext: false }
  };
}

// GET endpoint for suggested questions based on uploaded file
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const orgId = searchParams.get('orgId');
    const analysisType = searchParams.get('analysisType') || 'general';

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing required parameter: orgId' },
        { status: 400 }
      );
    }

    let suggestions;

    if (fileId) {
      // File-specific suggestions
      suggestions = await generateFileSpecificSuggestions(fileId, analysisType);
    } else {
      // General AI assistant suggestions
      suggestions = getGeneralSuggestions();
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        fileId,
        analysisType,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Get suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

async function generateFileSpecificSuggestions(fileId: string, analysisType: string) {
  // In production, this would analyze the actual file content
  const suggestions = {
    sales: [
      "What are the sales trends over the past months?",
      "Which regions are performing best?",
      "Show me a revenue growth chart",
      "What's the month-over-month growth rate?",
      "Identify top and bottom performing periods",
      "Are there any seasonal patterns?",
      "Compare performance across different segments",
      "What factors contributed to revenue changes?"
    ],
    financial: [
      "What's the expense breakdown by category?",
      "Show me budget vs actual analysis",
      "What are the cost trends?",
      "Which areas have highest spending?",
      "Identify cost-saving opportunities",
      "What's the ROI on different investments?",
      "Show cash flow patterns",
      "Analyze profit margins by segment"
    ],
    hr: [
      "What's the employee distribution by department?",
      "Show salary analysis by role",
      "What are the hiring trends?",
      "Which departments are growing fastest?",
      "Analyze performance ratings",
      "What's the diversity breakdown?",
      "Identify retention risks",
      "Compare compensation across levels"
    ],
    general: [
      "What are the key insights from this data?",
      "Show me the main trends",
      "Are there any anomalies?",
      "What patterns do you see?",
      "Create a summary dashboard",
      "What should I focus on first?",
      "Compare different time periods",
      "Generate actionable recommendations"
    ]
  };

  return suggestions[analysisType as keyof typeof suggestions] || suggestions.general;
}

function getGeneralSuggestions() {
  return [
    "Help me analyze my uploaded data",
    "What insights can you provide from my documents?",
    "Show me trends in my business data",
    "Create charts from my spreadsheet",
    "Summarize key findings from my reports",
    "Compare performance across different periods",
    "Identify opportunities for improvement",
    "Generate a business intelligence dashboard"
  ];
}