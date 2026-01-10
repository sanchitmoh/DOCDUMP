import { NextRequest, NextResponse } from 'next/server';
import { aiOrchestrator, QueryContext } from '../../../lib/orchestration/ai-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      question, 
      fileId, 
      userId, 
      orgId, 
      analysisType = 'general',
      conversationHistory = [] 
    } = body;

    // Validate required fields
    if (!question || !fileId || !userId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: question, fileId, userId, orgId' },
        { status: 400 }
      );
    }

    // Build query context for file-specific analysis
    const context: QueryContext = {
      userId,
      orgId,
      conversationId: `file_analysis_${fileId}_${Date.now()}`,
      documentIds: [fileId],
      contextType: 'General'
    };

    // Enhance the question with file context
    const enhancedQuestion = `Based on the uploaded file (ID: ${fileId}), ${question}`;

    // Process the query through AI orchestrator
    const result = await aiOrchestrator.processQuery(
      enhancedQuestion,
      context,
      conversationHistory
    );

    // Return comprehensive analysis response
    return NextResponse.json({
      success: true,
      data: {
        question,
        answer: result.response,
        sources: result.sources,
        charts: result.charts || [],
        insights: result.insights || [],
        reasoning: result.reasoning,
        fileId,
        analysisType,
        conversationId: context.conversationId,
        timestamp: new Date().toISOString(),
        // Additional file-specific metadata
        fileAnalysis: {
          hasVisualizations: (result.charts || []).length > 0,
          sourcesUsed: result.sources.length,
          confidenceLevel: result.sources.length > 0 ? 'high' : 'medium'
        }
      }
    });

  } catch (error: any) {
    console.error('File analysis error:', error);
    
    if (error.message.includes('Rate limit exceeded')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    if (error.message.includes('File not found')) {
      return NextResponse.json(
        { error: 'File not found or not processed yet. Please upload the file first.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to analyze file. Please try again.' },
      { status: 500 }
    );
  }
}

// GET endpoint for file analysis suggestions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const orgId = searchParams.get('orgId');
    const analysisType = searchParams.get('analysisType') || 'general';

    if (!fileId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileId, orgId' },
        { status: 400 }
      );
    }

    // Generate analysis suggestions based on file type and content
    const suggestions = await generateAnalysisSuggestions(fileId, analysisType);

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        analysisType,
        suggestions,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Get analysis suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis suggestions' },
      { status: 500 }
    );
  }
}

async function generateAnalysisSuggestions(fileId: string, analysisType: string) {
  // In a real implementation, this would be based on the actual file content and type
  const baseSuggestions = {
    general: [
      "What are the key insights from this data?",
      "Show me a summary of the main findings",
      "What trends can you identify in the data?",
      "Are there any anomalies or outliers?",
      "What patterns emerge from this analysis?"
    ],
    sales: [
      "What's the sales trend over the time period?",
      "Which products/regions performed best?",
      "Show me a chart of revenue growth",
      "What's the month-over-month growth rate?",
      "Identify the top and bottom performers",
      "What seasonal patterns exist in the sales data?",
      "Compare performance across different segments"
    ],
    financial: [
      "What's the expense breakdown by category?",
      "Show me the budget vs actual analysis",
      "What are the cost trends over time?",
      "Which areas have the highest spending?",
      "Identify cost-saving opportunities",
      "What's the ROI analysis for different investments?",
      "Show me the cash flow patterns"
    ],
    hr: [
      "What's the employee distribution by department?",
      "Show me salary analysis by role and experience",
      "What are the hiring and attrition trends?",
      "Which departments are growing fastest?",
      "Analyze performance ratings distribution",
      "What's the diversity breakdown?",
      "Identify retention risk factors"
    ],
    operational: [
      "What are the operational efficiency metrics?",
      "Show me production trends over time",
      "Identify bottlenecks in the process",
      "What's the quality control analysis?",
      "Compare performance across different locations",
      "What are the resource utilization patterns?",
      "Identify optimization opportunities"
    ]
  };

  const suggestions = baseSuggestions[analysisType as keyof typeof baseSuggestions] || baseSuggestions.general;
  
  // Add some dynamic suggestions based on current date/context
  const dynamicSuggestions = [
    "Compare this month's performance to last month",
    "What would you predict for next quarter based on this data?",
    "Show me the top 5 insights I should focus on",
    "Create a dashboard summary of key metrics"
  ];

  return [...suggestions.slice(0, 6), ...dynamicSuggestions.slice(0, 2)];
}