import { NextRequest, NextResponse } from 'next/server';
import { dataAnalysisService } from '@/lib/services/data-analysis';

export async function POST(request: NextRequest) {
  try {
    const { fileId, chartTypes = [], customQuery } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }

    console.log(`Generating charts for file ID: ${fileId}`);

    // Perform data analysis to get chart suggestions
    const analysisResult = await dataAnalysisService.analyzeExcelData(parseInt(fileId));

    let selectedCharts = analysisResult.chartSuggestions;

    // Filter by requested chart types if specified
    if (chartTypes.length > 0) {
      selectedCharts = selectedCharts.filter(chart => chartTypes.includes(chart.type));
    }

    // Limit to 6 charts for performance
    selectedCharts = selectedCharts.slice(0, 6);

    // Generate additional insights for each chart
    const chartsWithInsights = selectedCharts.map(chart => ({
      ...chart,
      insights: generateChartInsights(chart, analysisResult),
      dataQuality: assessDataQuality(chart.data),
      interactionSuggestions: getInteractionSuggestions(chart.type)
    }));

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        totalCharts: chartsWithInsights.length,
        charts: chartsWithInsights,
        summary: {
          totalRecords: analysisResult.summary.totalRecords,
          columns: analysisResult.summary.columns,
          chartTypes: [...new Set(chartsWithInsights.map(c => c.type))]
        },
        recommendations: analysisResult.recommendations,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Chart generation error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Chart generation failed'
    }, { status: 500 });
  }
}

function generateChartInsights(chart: any, analysis: any): string[] {
  const insights = [];
  
  switch (chart.type) {
    case 'bar':
    case 'pie':
      if (chart.data && chart.data.length > 0) {
        const total = chart.data.reduce((sum: number, item: any) => sum + (item.value || item.count || 0), 0);
        const highest = chart.data.reduce((max: any, item: any) => 
          (item.value || item.count || 0) > (max.value || max.count || 0) ? item : max, chart.data[0]);
        
        insights.push(`Total: ${total.toLocaleString()}`);
        insights.push(`Highest: ${highest.name || highest.category} (${(highest.value || highest.count).toLocaleString()})`);
        
        if (chart.data.length > 1) {
          const percentage = ((highest.value || highest.count) / total * 100).toFixed(1);
          insights.push(`Top category represents ${percentage}% of total`);
        }
      }
      break;
      
    case 'line':
      if (chart.data && chart.data.length > 1) {
        const values = chart.data.map((item: any) => item.value).filter((v: any) => !isNaN(v));
        if (values.length > 1) {
          const trend = values[values.length - 1] > values[0] ? 'increasing' : 'decreasing';
          const change = ((values[values.length - 1] - values[0]) / values[0] * 100).toFixed(1);
          insights.push(`Overall trend: ${trend}`);
          insights.push(`Total change: ${change}%`);
        }
      }
      break;
      
    case 'scatter':
      if (chart.data && chart.data.length > 0) {
        insights.push(`${chart.data.length} data points plotted`);
        insights.push('Correlation analysis available');
        insights.push('Outliers may indicate special cases');
      }
      break;
      
    case 'histogram':
      if (chart.data && chart.data.length > 0) {
        const maxBin = chart.data.reduce((max: any, bin: any) => bin.count > max.count ? bin : max, chart.data[0]);
        insights.push(`Most common range: ${maxBin.range}`);
        insights.push(`Peak frequency: ${maxBin.count} occurrences`);
      }
      break;
  }
  
  return insights;
}

function assessDataQuality(data: any[]): { score: number; issues: string[] } {
  if (!data || data.length === 0) {
    return { score: 0, issues: ['No data available'] };
  }
  
  const issues = [];
  let score = 100;
  
  // Check for missing values
  const missingValues = data.filter(item => 
    Object.values(item).some(val => val === null || val === undefined || val === '')
  ).length;
  
  if (missingValues > 0) {
    const percentage = (missingValues / data.length * 100).toFixed(1);
    issues.push(`${percentage}% of records have missing values`);
    score -= Math.min(30, missingValues / data.length * 100);
  }
  
  // Check data size
  if (data.length < 10) {
    issues.push('Small dataset - results may not be representative');
    score -= 20;
  }
  
  if (data.length > 1000) {
    issues.push('Large dataset - consider sampling for better performance');
  }
  
  return { score: Math.max(0, Math.round(score)), issues };
}

function getInteractionSuggestions(chartType: string): string[] {
  const suggestions: { [key: string]: string[] } = {
    bar: ['Click bars to see detailed values', 'Sort by different criteria', 'Filter categories'],
    line: ['Hover for exact values', 'Zoom into time periods', 'Compare multiple series'],
    pie: ['Click slices for breakdown', 'Toggle categories on/off', 'View as donut chart'],
    scatter: ['Identify outliers', 'Add trend lines', 'Color by categories'],
    histogram: ['Adjust bin sizes', 'Overlay normal distribution', 'Filter ranges']
  };
  
  return suggestions[chartType] || ['Interactive features available'];
}