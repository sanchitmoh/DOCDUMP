import { NextRequest, NextResponse } from 'next/server';
import { dataAnalysisService } from '@/lib/services/data-analysis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId') || '14';
    
    console.log(`Testing data analysis for file ID: ${fileId}`);
    
    // Test the data analysis service directly
    const analysisResult = await dataAnalysisService.analyzeExcelData(parseInt(fileId));
    
    console.log('Analysis result summary:', {
      totalRecords: analysisResult.summary.totalRecords,
      columns: analysisResult.summary.columns.length,
      chartSuggestions: analysisResult.chartSuggestions.length,
      insights: analysisResult.insights.length
    });
    
    // Log chart data for debugging
    analysisResult.chartSuggestions.forEach((chart, index) => {
      console.log(`Chart ${index + 1}:`, {
        type: chart.type,
        title: chart.title,
        dataLength: chart.data?.length || 0,
        sampleData: chart.data?.slice(0, 2) || []
      });
    });
    
    return NextResponse.json({
      success: true,
      data: {
        fileId: parseInt(fileId),
        analysis: analysisResult,
        debug: {
          chartCount: analysisResult.chartSuggestions.length,
          chartTypes: analysisResult.chartSuggestions.map(c => c.type),
          chartDataLengths: analysisResult.chartSuggestions.map(c => c.data?.length || 0),
          sampleChartData: analysisResult.chartSuggestions.map(c => ({
            type: c.type,
            title: c.title,
            sampleData: c.data?.slice(0, 2) || []
          }))
        }
      }
    });
    
  } catch (error) {
    console.error('Test data analysis error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}