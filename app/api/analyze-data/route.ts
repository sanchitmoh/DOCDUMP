import { NextRequest, NextResponse } from 'next/server';
import { dataAnalysisService } from '@/lib/services/data-analysis';

export async function POST(request: NextRequest) {
  try {
    const { fileId, analysisType = 'comprehensive' } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }

    console.log(`Starting ${analysisType} analysis for file ID: ${fileId}`);

    // Perform comprehensive data analysis
    const analysisResult = await dataAnalysisService.analyzeExcelData(parseInt(fileId));

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        analysisType,
        analysis: analysisResult,
        generatedAt: new Date().toISOString(),
        processingTime: Date.now()
      }
    });

  } catch (error) {
    console.error('Data analysis error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }

    // Get quick analysis summary
    const analysisResult = await dataAnalysisService.analyzeExcelData(parseInt(fileId));

    return NextResponse.json({
      success: true,
      data: {
        summary: analysisResult.summary,
        chartCount: analysisResult.chartSuggestions.length,
        insightCount: analysisResult.insights.length,
        availableCharts: analysisResult.chartSuggestions.map(chart => ({
          type: chart.type,
          title: chart.title,
          description: chart.description
        }))
      }
    });

  } catch (error) {
    console.error('Analysis summary error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analysis summary'
    }, { status: 500 });
  }
}