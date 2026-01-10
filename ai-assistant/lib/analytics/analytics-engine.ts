import { openai, AI_MODELS } from '../config/openai';

interface AnalyticsResult {
  data: any;
  metrics: Array<{
    name: string;
    value: number | string;
    trend?: 'up' | 'down' | 'stable';
    change?: number;
  }>;
  insights: string[];
  sources: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

interface SalesData {
  month: string;
  revenue: number;
  growth: number;
  department?: string;
  region?: string;
}

class AnalyticsEngine {
  
  async analyzeData(
    query: string, 
    orgId: string, 
    documentIds?: string[]
  ): Promise<AnalyticsResult> {
    
    // 1. Extract data from documents
    const rawData = await this.extractDataFromDocuments(orgId, documentIds);
    
    // 2. Determine analysis type from query
    const analysisType = await this.determineAnalysisType(query);
    
    // 3. Perform specific analysis
    let result: AnalyticsResult;
    
    switch (analysisType) {
      case 'sales_trend':
        result = await this.analyzeSalesTrend(rawData, query);
        break;
      case 'comparison':
        result = await this.performComparison(rawData, query);
        break;
      case 'growth_analysis':
        result = await this.analyzeGrowth(rawData, query);
        break;
      case 'performance_metrics':
        result = await this.calculatePerformanceMetrics(rawData, query);
        break;
      default:
        result = await this.performGeneralAnalysis(rawData, query);
    }
    
    // 4. Generate AI insights
    result.insights = await this.generateInsights(result.data, query);
    
    return result;
  }

  async compareDocuments(documents: any[], query: string): Promise<AnalyticsResult> {
    const comparisonData = {
      documents: documents.map(doc => ({
        title: doc.title,
        summary: doc.summary,
        keyMetrics: this.extractMetricsFromSummary(doc.summary)
      }))
    };

    const insights = await this.generateComparisonInsights(comparisonData, query);
    
    return {
      data: comparisonData,
      metrics: this.calculateComparisonMetrics(comparisonData),
      insights,
      sources: documents.map(d => d.title)
    };
  }

  private async extractDataFromDocuments(orgId: string, documentIds?: string[]): Promise<any[]> {
    // This would integrate with your existing document storage
    // For now, returning mock sales data
    
    return [
      { month: 'January', revenue: 2400000, growth: 8.2, department: 'Sales' },
      { month: 'February', revenue: 2600000, growth: 12.1, department: 'Sales' },
      { month: 'March', revenue: 2800000, growth: 15.3, department: 'Sales' },
      { month: 'April', revenue: 2200000, growth: -8.5, department: 'Sales' },
      { month: 'May', revenue: 2900000, growth: 18.7, department: 'Sales' },
      { month: 'June', revenue: 3100000, growth: 22.3, department: 'Sales' },
      { month: 'July', revenue: 2100000, growth: -15.2, department: 'Sales' },
      { month: 'August', revenue: 3200000, growth: 25.1, department: 'Sales' },
      { month: 'September', revenue: 3400000, growth: 28.9, department: 'Sales' },
      { month: 'October', revenue: 3600000, growth: 32.4, department: 'Sales' }
    ];
  }

  private async determineAnalysisType(query: string): Promise<string> {
    const prompt = `Classify this analytics query into one of these types:
1. sales_trend - analyzing sales over time
2. comparison - comparing different periods, departments, or metrics
3. growth_analysis - analyzing growth rates and patterns
4. performance_metrics - calculating KPIs and performance indicators
5. general - other types of analysis

Query: "${query}"

Respond with just the type name.`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content?.trim() || 'general';
  }

  private async analyzeSalesTrend(data: SalesData[], query: string): Promise<AnalyticsResult> {
    // Calculate trend metrics
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const avgGrowth = data.reduce((sum, item) => sum + item.growth, 0) / data.length;
    const maxRevenue = Math.max(...data.map(item => item.revenue));
    const minRevenue = Math.min(...data.map(item => item.revenue));
    
    // Find best and worst performing months
    const bestMonth = data.find(item => item.revenue === maxRevenue);
    const worstMonth = data.find(item => item.revenue === minRevenue);
    
    // Calculate moving averages
    const movingAverages = this.calculateMovingAverage(data.map(d => d.revenue), 3);
    
    // Detect trends
    const trend = this.detectTrend(data.map(d => d.revenue));
    
    return {
      data: {
        salesData: data,
        movingAverages,
        trend
      },
      metrics: [
        { name: 'Total Revenue', value: totalRevenue, trend: trend.overall },
        { name: 'Average Growth', value: `${avgGrowth.toFixed(1)}%`, trend: avgGrowth > 0 ? 'up' : 'down' },
        { name: 'Best Month', value: bestMonth?.month || 'N/A' },
        { name: 'Worst Month', value: worstMonth?.month || 'N/A' },
        { name: 'Revenue Range', value: `$${minRevenue.toLocaleString()} - $${maxRevenue.toLocaleString()}` }
      ],
      insights: [], // Will be filled by generateInsights
      sources: ['Sales Data']
    };
  }

  private async performComparison(data: any[], query: string): Promise<AnalyticsResult> {
    // Extract comparison periods from query
    const periods = this.extractPeriodsFromQuery(query);
    
    if (periods.length >= 2) {
      const period1Data = this.filterDataByPeriod(data, periods[0]);
      const period2Data = this.filterDataByPeriod(data, periods[1]);
      
      const comparison = {
        period1: {
          name: periods[0],
          revenue: period1Data.reduce((sum: number, item: any) => sum + item.revenue, 0),
          avgGrowth: period1Data.reduce((sum: number, item: any) => sum + item.growth, 0) / period1Data.length
        },
        period2: {
          name: periods[1],
          revenue: period2Data.reduce((sum: number, item: any) => sum + item.revenue, 0),
          avgGrowth: period2Data.reduce((sum: number, item: any) => sum + item.growth, 0) / period2Data.length
        }
      };
      
      const revenueChange = ((comparison.period2.revenue - comparison.period1.revenue) / comparison.period1.revenue) * 100;
      const growthChange = comparison.period2.avgGrowth - comparison.period1.avgGrowth;
      
      return {
        data: comparison,
        metrics: [
          { name: `${periods[0]} Revenue`, value: comparison.period1.revenue },
          { name: `${periods[1]} Revenue`, value: comparison.period2.revenue },
          { name: 'Revenue Change', value: `${revenueChange.toFixed(1)}%`, trend: revenueChange > 0 ? 'up' : 'down' },
          { name: 'Growth Change', value: `${growthChange.toFixed(1)}%`, trend: growthChange > 0 ? 'up' : 'down' }
        ],
        insights: [],
        sources: ['Sales Data']
      };
    }
    
    return this.performGeneralAnalysis(data, query);
  }

  private async analyzeGrowth(data: SalesData[], query: string): Promise<AnalyticsResult> {
    const growthRates = data.map(item => item.growth);
    const avgGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const maxGrowth = Math.max(...growthRates);
    const minGrowth = Math.min(...growthRates);
    
    // Calculate growth acceleration
    const growthAcceleration = this.calculateGrowthAcceleration(growthRates);
    
    // Predict next quarter
    const prediction = this.predictNextQuarter(data);
    
    return {
      data: {
        growthRates,
        growthAcceleration,
        prediction
      },
      metrics: [
        { name: 'Average Growth', value: `${avgGrowth.toFixed(1)}%` },
        { name: 'Peak Growth', value: `${maxGrowth.toFixed(1)}%` },
        { name: 'Lowest Growth', value: `${minGrowth.toFixed(1)}%` },
        { name: 'Growth Volatility', value: this.calculateVolatility(growthRates).toFixed(2) },
        { name: 'Next Quarter Prediction', value: `${prediction.toFixed(1)}%` }
      ],
      insights: [],
      sources: ['Sales Data']
    };
  }

  private async calculatePerformanceMetrics(data: any[], query: string): Promise<AnalyticsResult> {
    const revenues = data.map(item => item.revenue);
    const totalRevenue = revenues.reduce((sum, rev) => sum + rev, 0);
    const avgRevenue = totalRevenue / revenues.length;
    
    // Calculate KPIs
    const kpis = {
      totalRevenue,
      avgRevenue,
      revenueGrowthRate: this.calculateCompoundGrowthRate(revenues),
      consistency: this.calculateConsistency(revenues),
      momentum: this.calculateMomentum(revenues)
    };
    
    return {
      data: kpis,
      metrics: [
        { name: 'Total Revenue', value: totalRevenue },
        { name: 'Average Monthly Revenue', value: avgRevenue },
        { name: 'Compound Growth Rate', value: `${kpis.revenueGrowthRate.toFixed(1)}%` },
        { name: 'Performance Consistency', value: `${kpis.consistency.toFixed(1)}%` },
        { name: 'Business Momentum', value: kpis.momentum > 0 ? 'Positive' : 'Negative' }
      ],
      insights: [],
      sources: ['Performance Data']
    };
  }

  private async performGeneralAnalysis(data: any[], query: string): Promise<AnalyticsResult> {
    // Basic statistical analysis
    const values = data.map(item => item.revenue || item.value || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    return {
      data: { rawData: data, statistics: { sum, avg, max, min } },
      metrics: [
        { name: 'Total', value: sum },
        { name: 'Average', value: avg.toFixed(2) },
        { name: 'Maximum', value: max },
        { name: 'Minimum', value: min },
        { name: 'Count', value: data.length }
      ],
      insights: [],
      sources: ['Data Analysis']
    };
  }

  private async generateInsights(data: any, query: string): Promise<string[]> {
    const prompt = `As a senior business analyst, analyze this data and provide 3-5 key insights:

Data: ${JSON.stringify(data, null, 2)}

Original Question: ${query}

Provide insights about:
1. Key trends and patterns
2. Notable findings or anomalies
3. Business implications
4. Actionable recommendations

Return as a numbered list.`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.4
    });

    const content = response.choices[0]?.message?.content || '';
    return content.split('\n').filter(line => line.trim().length > 0);
  }

  private async generateComparisonInsights(data: any, query: string): Promise<string[]> {
    const prompt = `Compare these documents and provide key insights:

Data: ${JSON.stringify(data, null, 2)}

Question: ${query}

Provide insights about:
1. Key differences between documents
2. Common themes or patterns
3. Performance comparisons
4. Strategic implications

Return as a numbered list.`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.4
    });

    const content = response.choices[0]?.message?.content || '';
    return content.split('\n').filter(line => line.trim().length > 0);
  }

  // Utility functions
  private calculateMovingAverage(values: number[], window: number): number[] {
    const result = [];
    for (let i = window - 1; i < values.length; i++) {
      const sum = values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
    return result;
  }

  private detectTrend(values: number[]): { overall: 'up' | 'down' | 'stable'; strength: number } {
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    return {
      overall: Math.abs(change) < 0.05 ? 'stable' : change > 0 ? 'up' : 'down',
      strength: Math.abs(change)
    };
  }

  private extractPeriodsFromQuery(query: string): string[] {
    const periods = [];
    const quarterRegex = /Q[1-4]/gi;
    const monthRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)/gi;
    
    const quarters = query.match(quarterRegex) || [];
    const months = query.match(monthRegex) || [];
    
    return [...quarters, ...months];
  }

  private filterDataByPeriod(data: any[], period: string): any[] {
    // Simple filtering - in real implementation, this would be more sophisticated
    if (period.startsWith('Q')) {
      const quarterMonths = {
        'Q1': ['January', 'February', 'March'],
        'Q2': ['April', 'May', 'June'],
        'Q3': ['July', 'August', 'September'],
        'Q4': ['October', 'November', 'December']
      };
      const months = quarterMonths[period as keyof typeof quarterMonths] || [];
      return data.filter(item => months.includes(item.month));
    }
    
    return data.filter(item => item.month === period);
  }

  private calculateGrowthAcceleration(growthRates: number[]): number {
    if (growthRates.length < 2) return 0;
    
    let acceleration = 0;
    for (let i = 1; i < growthRates.length; i++) {
      acceleration += growthRates[i] - growthRates[i - 1];
    }
    
    return acceleration / (growthRates.length - 1);
  }

  private predictNextQuarter(data: SalesData[]): number {
    const recentGrowth = data.slice(-3).map(d => d.growth);
    const avgRecentGrowth = recentGrowth.reduce((sum, g) => sum + g, 0) / recentGrowth.length;
    
    // Simple trend-based prediction
    const trend = this.detectTrend(data.map(d => d.growth));
    const adjustment = trend.overall === 'up' ? 1.1 : trend.overall === 'down' ? 0.9 : 1.0;
    
    return avgRecentGrowth * adjustment;
  }

  private calculateVolatility(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateCompoundGrowthRate(revenues: number[]): number {
    if (revenues.length < 2) return 0;
    const firstValue = revenues[0];
    const lastValue = revenues[revenues.length - 1];
    const periods = revenues.length - 1;
    
    return (Math.pow(lastValue / firstValue, 1 / periods) - 1) * 100;
  }

  private calculateConsistency(values: number[]): number {
    const volatility = this.calculateVolatility(values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const coefficientOfVariation = volatility / mean;
    
    // Convert to consistency percentage (lower CV = higher consistency)
    return Math.max(0, 100 - (coefficientOfVariation * 100));
  }

  private calculateMomentum(values: number[]): number {
    if (values.length < 3) return 0;
    
    const recent = values.slice(-3);
    const earlier = values.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;
    
    return recentAvg - earlierAvg;
  }

  private extractMetricsFromSummary(summary: string): any {
    // Extract numbers and metrics from text summary
    const numberRegex = /\$?[\d,]+\.?\d*/g;
    const percentRegex = /\d+\.?\d*%/g;
    
    const numbers = summary.match(numberRegex) || [];
    const percentages = summary.match(percentRegex) || [];
    
    return {
      numbers: numbers.slice(0, 5), // Top 5 numbers
      percentages: percentages.slice(0, 3) // Top 3 percentages
    };
  }

  private calculateComparisonMetrics(data: any): any[] {
    const docs = data.documents;
    
    return [
      { name: 'Documents Compared', value: docs.length },
      { name: 'Total Metrics Found', value: docs.reduce((sum: number, doc: any) => sum + doc.keyMetrics.numbers.length, 0) },
      { name: 'Avg Metrics per Document', value: (docs.reduce((sum: number, doc: any) => sum + doc.keyMetrics.numbers.length, 0) / docs.length).toFixed(1) }
    ];
  }
}

export const analyticsEngine = new AnalyticsEngine();