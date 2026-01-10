import { openai, AI_MODELS } from '../config/openai';
import { chartGenerator } from '../tools/chart-generator';
import { extractJsonFromAIResponse } from '../../../lib/utils';

interface FileAnalyticsResult {
  summary: {
    totalRecords: number;
    dateRange?: { start: string; end: string };
    keyColumns: string[];
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  insights: {
    trends: Array<{
      metric: string;
      direction: 'increasing' | 'decreasing' | 'stable';
      strength: 'strong' | 'moderate' | 'weak';
      significance: string;
    }>;
    anomalies: Array<{
      type: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    correlations: Array<{
      variables: [string, string];
      strength: number;
      description: string;
    }>;
  };
  recommendations: string[];
  charts: any[];
}

class FileAnalytics {
  
  async performDeepAnalysis(
    fileData: any,
    analysisType: string,
    userQuestion?: string
  ): Promise<FileAnalyticsResult> {
    
    console.log(`Performing deep analysis for ${analysisType}`);
    
    // 1. Basic data summary
    const summary = this.generateDataSummary(fileData);
    
    // 2. Statistical analysis
    const insights = await this.generateInsights(fileData, analysisType);
    
    // 3. AI-powered recommendations
    const recommendations = await this.generateRecommendations(fileData, insights, userQuestion);
    
    // 4. Auto-generate relevant charts
    const charts = await this.generateRelevantCharts(fileData, analysisType);
    
    return {
      summary,
      insights,
      recommendations,
      charts
    };
  }

  private generateDataSummary(fileData: any) {
    const tables = fileData.tables || [];
    const mainTable = tables[0];
    
    if (!mainTable) {
      return {
        totalRecords: 0,
        keyColumns: [],
        dataQuality: 'poor' as const
      };
    }

    const { headers, rows } = mainTable;
    const totalRecords = rows.length;
    
    // Detect date range
    const dateRange = this.detectDateRange(headers, rows);
    
    // Assess data quality
    const dataQuality = this.assessDataQuality(headers, rows);
    
    return {
      totalRecords,
      dateRange,
      keyColumns: headers,
      dataQuality
    };
  }

  private detectDateRange(headers: string[], rows: any[]) {
    const dateColumns = headers.filter(h => 
      h.toLowerCase().includes('date') || 
      h.toLowerCase().includes('time') ||
      h.toLowerCase().includes('month') ||
      h.toLowerCase().includes('year')
    );

    if (dateColumns.length === 0) return undefined;

    try {
      const dateIndex = headers.indexOf(dateColumns[0]);
      const dates = rows
        .map(row => new Date(row[dateIndex]))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (dates.length === 0) return undefined;

      return {
        start: dates[0].toISOString().split('T')[0],
        end: dates[dates.length - 1].toISOString().split('T')[0]
      };
    } catch {
      return undefined;
    }
  }

  private assessDataQuality(headers: string[], rows: any[]): 'excellent' | 'good' | 'fair' | 'poor' {
    if (rows.length === 0) return 'poor';
    
    // Calculate completeness
    let totalCells = 0;
    let filledCells = 0;
    
    rows.forEach(row => {
      headers.forEach((_, index) => {
        totalCells++;
        if (row[index] !== null && row[index] !== undefined && row[index] !== '') {
          filledCells++;
        }
      });
    });
    
    const completeness = filledCells / totalCells;
    
    if (completeness >= 0.95) return 'excellent';
    if (completeness >= 0.85) return 'good';
    if (completeness >= 0.70) return 'fair';
    return 'poor';
  }

  private async generateInsights(fileData: any, analysisType: string) {
    const tables = fileData.tables || [];
    const mainTable = tables[0];
    
    if (!mainTable) {
      return { trends: [], anomalies: [], correlations: [] };
    }

    const { headers, rows } = mainTable;
    
    // Identify numeric columns
    const numericColumns = this.identifyNumericColumns(headers, rows);
    
    // Calculate trends
    const trends = this.calculateTrends(headers, rows, numericColumns);
    
    // Detect anomalies
    const anomalies = this.detectAnomalies(headers, rows, numericColumns);
    
    // Find correlations
    const correlations = this.findCorrelations(headers, rows, numericColumns);
    
    return { trends, anomalies, correlations };
  }

  private identifyNumericColumns(headers: string[], rows: any[]): string[] {
    const numericColumns: string[] = [];
    
    headers.forEach((header, index) => {
      let numericCount = 0;
      const sampleSize = Math.min(10, rows.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const value = rows[i][index];
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          numericCount++;
        }
      }
      
      // If more than 70% of sample values are numeric, consider it a numeric column
      if (numericCount / sampleSize > 0.7) {
        numericColumns.push(header);
      }
    });
    
    return numericColumns;
  }

  private calculateTrends(headers: string[], rows: any[], numericColumns: string[]) {
    const trends: any[] = [];
    
    numericColumns.forEach(column => {
      const columnIndex = headers.indexOf(column);
      const values = rows
        .map(row => parseFloat(row[columnIndex]))
        .filter(v => !isNaN(v));
      
      if (values.length < 3) return;
      
      // Simple linear regression to detect trend
      const n = values.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      
      let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let strength: 'strong' | 'moderate' | 'weak' = 'weak';
      
      if (Math.abs(slope) > 0.1) {
        direction = slope > 0 ? 'increasing' : 'decreasing';
        strength = Math.abs(slope) > 1 ? 'strong' : 'moderate';
      }
      
      trends.push({
        metric: column,
        direction,
        strength,
        significance: this.getTrendSignificance(direction, strength, column)
      });
    });
    
    return trends;
  }

  private getTrendSignificance(direction: string, strength: string, column: string): string {
    const directionText = direction === 'increasing' ? 'growth' : direction === 'decreasing' ? 'decline' : 'stability';
    const strengthText = strength === 'strong' ? 'significant' : strength === 'moderate' ? 'moderate' : 'slight';
    
    return `${column} shows ${strengthText} ${directionText} over the analyzed period`;
  }

  private detectAnomalies(headers: string[], rows: any[], numericColumns: string[]) {
    const anomalies: any[] = [];
    
    numericColumns.forEach(column => {
      const columnIndex = headers.indexOf(column);
      const values = rows
        .map(row => parseFloat(row[columnIndex]))
        .filter(v => !isNaN(v));
      
      if (values.length < 5) return;
      
      // Use IQR method for outlier detection
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      const outliers = values.filter(v => v < lowerBound || v > upperBound);
      
      if (outliers.length > 0) {
        const impact = outliers.length / values.length > 0.1 ? 'high' : 
                      outliers.length / values.length > 0.05 ? 'medium' : 'low';
        
        anomalies.push({
          type: 'statistical_outlier',
          description: `${outliers.length} outlier(s) detected in ${column}`,
          impact
        });
      }
    });
    
    return anomalies.slice(0, 5); // Limit to top 5 anomalies
  }

  private findCorrelations(headers: string[], rows: any[], numericColumns: string[]) {
    const correlations: any[] = [];
    
    // Calculate correlations between numeric columns
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];
        
        const correlation = this.calculateCorrelation(headers, rows, col1, col2);
        
        if (Math.abs(correlation) > 0.5) { // Only significant correlations
          correlations.push({
            variables: [col1, col2] as [string, string],
            strength: correlation,
            description: this.getCorrelationDescription(col1, col2, correlation)
          });
        }
      }
    }
    
    return correlations.slice(0, 3); // Top 3 correlations
  }

  private calculateCorrelation(headers: string[], rows: any[], col1: string, col2: string): number {
    const index1 = headers.indexOf(col1);
    const index2 = headers.indexOf(col2);
    
    const pairs = rows
      .map(row => [parseFloat(row[index1]), parseFloat(row[index2])])
      .filter(([x, y]) => !isNaN(x) && !isNaN(y));
    
    if (pairs.length < 3) return 0;
    
    const n = pairs.length;
    const sumX = pairs.reduce((sum, [x]) => sum + x, 0);
    const sumY = pairs.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = pairs.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumXX = pairs.reduce((sum, [x]) => sum + x * x, 0);
    const sumYY = pairs.reduce((sum, [, y]) => sum + y * y, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private getCorrelationDescription(col1: string, col2: string, correlation: number): string {
    const strength = Math.abs(correlation) > 0.8 ? 'strong' : 'moderate';
    const direction = correlation > 0 ? 'positive' : 'negative';
    
    return `${strength} ${direction} correlation between ${col1} and ${col2}`;
  }

  private async generateRecommendations(fileData: any, insights: any, userQuestion?: string): Promise<string[]> {
    const prompt = `Based on this data analysis, provide 3-5 actionable business recommendations:

Data Summary:
- Records: ${fileData.tables?.[0]?.rows?.length || 0}
- Columns: ${fileData.tables?.[0]?.headers?.join(', ') || 'N/A'}

Key Insights:
- Trends: ${insights.trends.map((t: any) => `${t.metric} is ${t.direction}`).join(', ')}
- Anomalies: ${insights.anomalies.length} detected
- Correlations: ${insights.correlations.length} significant relationships found

${userQuestion ? `User Question: ${userQuestion}` : ''}

Provide specific, actionable recommendations as a JSON array:
["recommendation 1", "recommendation 2", ...]`;

    try {
      const response = await openai.chat.completions.create({
        model: AI_MODELS.CHAT,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.4
      });

      const content = response.choices[0]?.message?.content || '[]';
      return extractJsonFromAIResponse(content);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [
        'Review the identified trends for strategic planning',
        'Investigate anomalies to understand underlying causes',
        'Leverage correlations for predictive insights',
        'Improve data quality in areas with missing information',
        'Set up monitoring for key performance indicators'
      ];
    }
  }

  private async generateRelevantCharts(fileData: any, analysisType: string): Promise<any[]> {
    const charts: any[] = [];
    const mainTable = fileData.tables?.[0];
    
    if (!mainTable || !mainTable.rows || mainTable.rows.length === 0) {
      return charts;
    }

    const { headers, rows } = mainTable;
    const numericColumns = this.identifyNumericColumns(headers, rows);
    
    // Generate different chart types based on data
    if (numericColumns.length > 0) {
      // Trend chart if we have time-based data
      const hasTimeColumn = headers.some(h => 
        h.toLowerCase().includes('date') || 
        h.toLowerCase().includes('month') || 
        h.toLowerCase().includes('time')
      );
      
      if (hasTimeColumn && numericColumns.length > 0) {
        charts.push(this.createTrendChart(headers, rows, numericColumns[0]));
      }
      
      // Distribution chart for the first numeric column
      if (numericColumns.length > 0) {
        charts.push(this.createDistributionChart(headers, rows, numericColumns[0]));
      }
      
      // Comparison chart if we have categories
      const categoryColumns = headers.filter(h => !numericColumns.includes(h));
      if (categoryColumns.length > 0 && numericColumns.length > 0) {
        charts.push(this.createComparisonChart(headers, rows, categoryColumns[0], numericColumns[0]));
      }
    }
    
    return charts.slice(0, 3); // Limit to 3 charts
  }

  private createTrendChart(headers: string[], rows: any[], metric: string) {
    const timeColumn = headers.find(h => 
      h.toLowerCase().includes('date') || 
      h.toLowerCase().includes('month') || 
      h.toLowerCase().includes('time')
    );
    
    if (!timeColumn) return null;
    
    const timeIndex = headers.indexOf(timeColumn);
    const metricIndex = headers.indexOf(metric);
    
    const data = rows.map(row => ({
      x: row[timeIndex],
      y: parseFloat(row[metricIndex]) || 0,
      label: `${row[timeIndex]}: ${row[metricIndex]}`
    })).filter(d => !isNaN(d.y));
    
    return {
      type: 'line',
      title: `${metric} Trend Over Time`,
      data,
      config: {
        xAxis: timeColumn,
        yAxis: metric,
        colors: ['#3b82f6']
      }
    };
  }

  private createDistributionChart(headers: string[], rows: any[], metric: string) {
    const metricIndex = headers.indexOf(metric);
    const values = rows.map(row => parseFloat(row[metricIndex])).filter(v => !isNaN(v));
    
    // Create histogram bins
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
    const binSize = (max - min) / binCount;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
      count: 0
    }));
    
    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
      bins[binIndex].count++;
    });
    
    return {
      type: 'bar',
      title: `${metric} Distribution`,
      data: bins.map(bin => ({ name: bin.range, value: bin.count })),
      config: {
        xAxis: 'Range',
        yAxis: 'Frequency',
        colors: ['#10b981']
      }
    };
  }

  private createComparisonChart(headers: string[], rows: any[], category: string, metric: string) {
    const categoryIndex = headers.indexOf(category);
    const metricIndex = headers.indexOf(metric);
    
    // Group by category and sum/average the metric
    const groups: { [key: string]: number[] } = {};
    
    rows.forEach(row => {
      const cat = row[categoryIndex];
      const val = parseFloat(row[metricIndex]);
      
      if (!isNaN(val)) {
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(val);
      }
    });
    
    const data = Object.entries(groups).map(([cat, values]) => ({
      name: cat,
      value: values.reduce((sum, v) => sum + v, 0) / values.length // Average
    }));
    
    return {
      type: 'bar',
      title: `${metric} by ${category}`,
      data,
      config: {
        xAxis: category,
        yAxis: `Average ${metric}`,
        colors: ['#f59e0b']
      }
    };
  }
}

export const fileAnalytics = new FileAnalytics();