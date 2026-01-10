import { NextRequest, NextResponse } from 'next/server';
import { dataAnalysisService } from '@/lib/services/data-analysis';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { fileId, insightType = 'comprehensive', focusAreas = [] } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }

    console.log(`Generating ${insightType} insights for file ID: ${fileId}`);

    // Perform comprehensive data analysis
    const analysisResult = await dataAnalysisService.analyzeExcelData(parseInt(fileId));

    // Generate AI-powered insights using OpenAI
    const aiInsights = await generateAIInsights(analysisResult, focusAreas);

    // Combine statistical and AI insights
    const comprehensiveInsights = {
      statistical: {
        summary: analysisResult.summary,
        keyMetrics: extractKeyMetrics(analysisResult),
        trends: identifyTrends(analysisResult),
        anomalies: detectAnomalies(analysisResult)
      },
      ai: aiInsights,
      actionable: generateActionableRecommendations(analysisResult),
      visualizations: {
        recommended: analysisResult.chartSuggestions.slice(0, 5),
        priority: prioritizeCharts(analysisResult.chartSuggestions)
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        insightType,
        insights: comprehensiveInsights,
        confidence: calculateConfidenceScore(analysisResult),
        generatedAt: new Date().toISOString(),
        processingTime: Date.now()
      }
    });

  } catch (error) {
    console.error('Insights generation error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Insights generation failed'
    }, { status: 500 });
  }
}

async function generateAIInsights(analysis: any, focusAreas: string[]): Promise<any> {
  try {
    const prompt = `Analyze this dataset and provide business insights:

Dataset Summary:
- Records: ${analysis.summary.totalRecords}
- Columns: ${analysis.summary.columns.join(', ')}

Key Statistics:
${Object.entries(analysis.statistics).slice(0, 5).map(([col, stats]: [string, any]) => 
  `- ${col}: ${stats.type} (${stats.type === 'numeric' ? `avg: ${stats.mean?.toFixed(2)}, range: ${stats.min}-${stats.max}` : `${stats.unique} unique values, mode: ${stats.mode}`})`
).join('\n')}

Statistical Insights:
${analysis.insights.join('\n')}

Focus Areas: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'General business analysis'}

Provide:
1. Key business insights (3-5 points)
2. Potential risks or opportunities
3. Recommended actions
4. Questions for further investigation

Format as JSON with keys: businessInsights, risks, opportunities, recommendations, questions`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (aiResponse) {
      try {
        return JSON.parse(aiResponse);
      } catch {
        // If JSON parsing fails, return structured text
        return {
          businessInsights: [aiResponse.substring(0, 500)],
          risks: ['AI analysis available in text format'],
          opportunities: ['Detailed analysis provided'],
          recommendations: ['Review AI-generated insights'],
          questions: ['What specific areas need deeper analysis?']
        };
      }
    }
  } catch (error) {
    console.error('AI insights generation failed:', error);
  }

  return {
    businessInsights: ['Statistical analysis completed successfully'],
    risks: ['Data quality assessment needed'],
    opportunities: ['Multiple visualization options available'],
    recommendations: ['Consider trend analysis and correlation studies'],
    questions: ['What business questions should this data answer?']
  };
}

function extractKeyMetrics(analysis: any): any[] {
  const metrics = [];
  
  Object.entries(analysis.statistics).forEach(([column, stats]: [string, any]) => {
    if (stats.type === 'numeric') {
      metrics.push({
        name: column,
        type: 'average',
        value: stats.mean?.toFixed(2),
        unit: detectUnit(column)
      });
      
      metrics.push({
        name: column,
        type: 'range',
        value: `${stats.min} - ${stats.max}`,
        unit: detectUnit(column)
      });
    } else if (stats.type === 'categorical') {
      metrics.push({
        name: column,
        type: 'diversity',
        value: stats.unique,
        unit: 'unique values'
      });
    }
  });
  
  return metrics.slice(0, 8); // Limit to 8 key metrics
}

function identifyTrends(analysis: any): any[] {
  const trends = [];
  
  // Look for time-based patterns
  const dateColumns = analysis.summary.columns.filter((col: string) => 
    col.toLowerCase().includes('date') || col.toLowerCase().includes('time')
  );
  
  if (dateColumns.length > 0) {
    trends.push({
      type: 'temporal',
      description: `Time-based analysis available with ${dateColumns.length} date column(s)`,
      columns: dateColumns,
      recommendation: 'Create time-series visualizations to identify patterns'
    });
  }
  
  // Look for numeric correlations
  const numericColumns = Object.entries(analysis.statistics)
    .filter(([_, stats]: [string, any]) => stats.type === 'numeric')
    .map(([col, _]) => col);
  
  if (numericColumns.length >= 2) {
    trends.push({
      type: 'correlation',
      description: `Potential correlations between ${numericColumns.length} numeric variables`,
      columns: numericColumns,
      recommendation: 'Analyze correlations to identify relationships'
    });
  }
  
  return trends;
}

function detectAnomalies(analysis: any): any[] {
  const anomalies = [];
  
  Object.entries(analysis.statistics).forEach(([column, stats]: [string, any]) => {
    if (stats.type === 'numeric' && stats.standardDeviation) {
      const cv = stats.standardDeviation / stats.mean; // Coefficient of variation
      
      if (cv > 1) {
        anomalies.push({
          type: 'high_variance',
          column,
          description: `High variability in ${column} (CV: ${cv.toFixed(2)})`,
          severity: cv > 2 ? 'high' : 'medium'
        });
      }
    }
    
    if (stats.type === 'categorical' && stats.topValues) {
      const dominantValue = stats.topValues[0];
      const dominanceRatio = dominantValue.count / stats.count;
      
      if (dominanceRatio > 0.8) {
        anomalies.push({
          type: 'dominant_category',
          column,
          description: `${column} is dominated by "${dominantValue.value}" (${(dominanceRatio * 100).toFixed(1)}%)`,
          severity: dominanceRatio > 0.95 ? 'high' : 'medium'
        });
      }
    }
  });
  
  return anomalies;
}

function generateActionableRecommendations(analysis: any): any[] {
  const recommendations = [];
  
  // Data quality recommendations
  if (analysis.summary.totalRecords < 100) {
    recommendations.push({
      category: 'data_quality',
      priority: 'high',
      action: 'Collect more data',
      reason: 'Small dataset may not provide reliable insights',
      impact: 'Improved statistical significance'
    });
  }
  
  // Visualization recommendations
  const numericCols = Object.entries(analysis.statistics)
    .filter(([_, stats]: [string, any]) => stats.type === 'numeric').length;
  
  if (numericCols >= 2) {
    recommendations.push({
      category: 'visualization',
      priority: 'medium',
      action: 'Create correlation matrix',
      reason: 'Multiple numeric variables available for relationship analysis',
      impact: 'Identify hidden patterns and relationships'
    });
  }
  
  // Business recommendations
  recommendations.push({
    category: 'business',
    priority: 'medium',
    action: 'Define KPIs',
    reason: 'Establish key performance indicators based on available data',
    impact: 'Better tracking and decision making'
  });
  
  return recommendations;
}

function prioritizeCharts(chartSuggestions: any[]): any[] {
  return chartSuggestions
    .map(chart => ({
      ...chart,
      priority: calculateChartPriority(chart)
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}

function calculateChartPriority(chart: any): number {
  let priority = 50; // Base priority
  
  // Prioritize based on chart type
  const typePriority: { [key: string]: number } = {
    line: 90,     // Time series are very valuable
    bar: 80,      // Good for comparisons
    scatter: 70,  // Good for correlations
    pie: 60,      // Good for proportions
    histogram: 50 // Good for distributions
  };
  
  priority += typePriority[chart.type] || 40;
  
  // Prioritize based on data size
  if (chart.data && chart.data.length > 5) {
    priority += 20;
  }
  
  return priority;
}

function calculateConfidenceScore(analysis: any): number {
  let score = 50; // Base score
  
  // Data size factor
  if (analysis.summary.totalRecords > 100) score += 20;
  if (analysis.summary.totalRecords > 1000) score += 10;
  
  // Column diversity factor
  if (analysis.summary.columns.length > 3) score += 15;
  
  // Data type diversity
  const numericCols = Object.values(analysis.statistics).filter((s: any) => s.type === 'numeric').length;
  const categoricalCols = Object.values(analysis.statistics).filter((s: any) => s.type === 'categorical').length;
  
  if (numericCols > 0 && categoricalCols > 0) score += 15;
  
  return Math.min(100, score);
}

function detectUnit(columnName: string): string {
  const name = columnName.toLowerCase();
  
  if (name.includes('amount') || name.includes('price') || name.includes('cost')) return '$';
  if (name.includes('percent') || name.includes('rate')) return '%';
  if (name.includes('count') || name.includes('number')) return 'count';
  if (name.includes('date') || name.includes('time')) return 'date';
  
  return '';
}$';
  if (name.includes('percent') || name.includes('rate')) return '%';
  if (name.includes('count') || name.includes('number')) return 'count';
  if (name.includes('date') || name.includes('time')) return 'date';
  
  return '';
}