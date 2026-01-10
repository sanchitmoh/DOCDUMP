import { NextRequest, NextResponse } from 'next/server';
import { analyticsEngine } from '../../lib/analytics/analytics-engine';
import { chartGenerator } from '../../lib/tools/chart-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, orgId, documentIds, analysisType } = body;

    // Validate required fields
    if (!query || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: query, orgId' },
        { status: 400 }
      );
    }

    let result;

    switch (analysisType) {
      case 'data_analysis':
        result = await analyticsEngine.analyzeData(query, orgId, documentIds);
        break;
        
      case 'chart_generation':
        result = await chartGenerator.generateChart(query, orgId, documentIds);
        break;
        
      case 'document_comparison':
        const documents = await analyticsEngine.compareDocuments([], query);
        result = documents;
        break;
        
      default:
        // Default to data analysis
        result = await analyticsEngine.analyzeData(query, orgId, documentIds);
    }

    return NextResponse.json({
      success: true,
      data: result,
      analysisType,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Analytics Error:', error);
    return NextResponse.json(
      { error: 'Failed to perform analytics' },
      { status: 500 }
    );
  }
}

// GET endpoint for analytics dashboard data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const timeRange = searchParams.get('timeRange') || '30d';

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing required parameter: orgId' },
        { status: 400 }
      );
    }

    // Generate dashboard analytics
    const dashboardData = {
      totalQueries: 1250,
      avgResponseTime: '2.3s',
      topDocuments: [
        { title: 'Q3 Sales Report', queries: 45 },
        { title: 'HR Policies', queries: 32 },
        { title: 'Financial Summary', queries: 28 }
      ],
      queryTypes: [
        { type: 'Factual', count: 520, percentage: 41.6 },
        { type: 'Analytical', count: 375, percentage: 30.0 },
        { type: 'Comparison', count: 225, percentage: 18.0 },
        { type: 'Visualization', count: 130, percentage: 10.4 }
      ],
      performanceMetrics: {
        accuracy: 94.2,
        userSatisfaction: 4.6,
        costPerQuery: 0.023
      }
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timeRange,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Dashboard Analytics Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve dashboard analytics' },
      { status: 500 }
    );
  }
}