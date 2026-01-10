interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title: string;
  data: any[];
  config: {
    xAxis?: string;
    yAxis?: string;
    colors?: string[];
    labels?: string[];
  };
}

interface ChartResult {
  chart: ChartData;
  insights: string[];
  summary: string;
  sources: string[];
}

class ChartGenerator {
  
  async generateChart(
    query: string, 
    orgId: string, 
    documentIds?: string[]
  ): Promise<ChartResult> {
    
    // 1. Determine chart type from query
    const chartType = this.determineChartType(query);
    
    // 2. Get relevant data
    const data = await this.getChartData(query, orgId, documentIds);
    
    // 3. Generate chart configuration
    const chartConfig = this.generateChartConfig(chartType, data, query);
    
    // 4. Generate insights about the chart
    const insights = this.generateChartInsights(chartConfig, data);
    
    return {
      chart: chartConfig,
      insights,
      summary: this.generateChartSummary(chartConfig, data),
      sources: ['Sales Data', 'Analytics Engine']
    };
  }

  async generateComparisonCharts(comparisonData: any): Promise<ChartData[]> {
    const charts: ChartData[] = [];
    
    // Revenue comparison chart
    if (comparisonData.period1 && comparisonData.period2) {
      charts.push({
        type: 'bar',
        title: 'Revenue Comparison',
        data: [
          { name: comparisonData.period1.name, value: comparisonData.period1.revenue },
          { name: comparisonData.period2.name, value: comparisonData.period2.revenue }
        ],
        config: {
          xAxis: 'name',
          yAxis: 'value',
          colors: ['#3b82f6', '#ef4444']
        }
      });
      
      // Growth comparison chart
      charts.push({
        type: 'bar',
        title: 'Growth Rate Comparison',
        data: [
          { name: comparisonData.period1.name, value: comparisonData.period1.avgGrowth },
          { name: comparisonData.period2.name, value: comparisonData.period2.avgGrowth }
        ],
        config: {
          xAxis: 'name',
          yAxis: 'value',
          colors: ['#10b981', '#f59e0b']
        }
      });
    }
    
    return charts;
  }

  private determineChartType(query: string): 'bar' | 'line' | 'pie' | 'area' | 'scatter' {
    const queryLower = query.toLowerCase();
    
    // Line charts for trends over time
    if (queryLower.includes('trend') || queryLower.includes('over time') || 
        queryLower.includes('monthly') || queryLower.includes('growth')) {
      return 'line';
    }
    
    // Pie charts for distribution/share
    if (queryLower.includes('share') || queryLower.includes('distribution') || 
        queryLower.includes('breakdown') || queryLower.includes('percentage')) {
      return 'pie';
    }
    
    // Area charts for cumulative data
    if (queryLower.includes('cumulative') || queryLower.includes('total over')) {
      return 'area';
    }
    
    // Scatter for correlation
    if (queryLower.includes('correlation') || queryLower.includes('relationship')) {
      return 'scatter';
    }
    
    // Default to bar chart for comparisons
    return 'bar';
  }

  private async getChartData(query: string, orgId: string, documentIds?: string[]): Promise<any[]> {
    // Mock sales data - in real implementation, this would fetch from your data sources
    const salesData = [
      { month: 'Jan', revenue: 2400000, growth: 8.2, department: 'Sales' },
      { month: 'Feb', revenue: 2600000, growth: 12.1, department: 'Sales' },
      { month: 'Mar', revenue: 2800000, growth: 15.3, department: 'Sales' },
      { month: 'Apr', revenue: 2200000, growth: -8.5, department: 'Sales' },
      { month: 'May', revenue: 2900000, growth: 18.7, department: 'Sales' },
      { month: 'Jun', revenue: 3100000, growth: 22.3, department: 'Sales' },
      { month: 'Jul', revenue: 2100000, growth: -15.2, department: 'Sales' },
      { month: 'Aug', revenue: 3200000, growth: 25.1, department: 'Sales' },
      { month: 'Sep', revenue: 3400000, growth: 28.9, department: 'Sales' },
      { month: 'Oct', revenue: 3600000, growth: 32.4, department: 'Sales' }
    ];

    // Department breakdown data
    const departmentData = [
      { department: 'Sales', revenue: 15000000, employees: 45 },
      { department: 'Marketing', revenue: 3200000, employees: 12 },
      { department: 'Engineering', revenue: 8500000, employees: 28 },
      { department: 'Support', revenue: 2100000, employees: 15 }
    ];

    // Return appropriate data based on query
    if (query.toLowerCase().includes('department')) {
      return departmentData;
    }
    
    return salesData;
  }

  private generateChartConfig(
    type: 'bar' | 'line' | 'pie' | 'area' | 'scatter',
    data: any[],
    query: string
  ): ChartData {
    
    const config: ChartData = {
      type,
      title: this.generateChartTitle(query, type),
      data: this.formatDataForChart(data, type, query),
      config: {
        colors: this.getChartColors(type),
      }
    };

    // Set axis labels based on data and chart type
    if (type !== 'pie') {
      config.config.xAxis = this.determineXAxis(data, query);
      config.config.yAxis = this.determineYAxis(data, query);
    }

    return config;
  }

  private generateChartTitle(query: string, type: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('revenue')) {
      return type === 'line' ? 'Revenue Trend Over Time' : 'Revenue Analysis';
    }
    
    if (queryLower.includes('growth')) {
      return type === 'line' ? 'Growth Rate Trend' : 'Growth Analysis';
    }
    
    if (queryLower.includes('department')) {
      return 'Department Performance Analysis';
    }
    
    if (queryLower.includes('comparison') || queryLower.includes('compare')) {
      return 'Comparative Analysis';
    }
    
    return 'Data Analysis Chart';
  }

  private formatDataForChart(data: any[], type: string, query: string): any[] {
    const queryLower = query.toLowerCase();
    
    switch (type) {
      case 'line':
      case 'area':
        if (queryLower.includes('growth')) {
          return data.map(item => ({
            x: item.month || item.name,
            y: item.growth || item.value,
            label: `${item.month}: ${item.growth}%`
          }));
        }
        return data.map(item => ({
          x: item.month || item.name,
          y: item.revenue || item.value,
          label: `${item.month}: $${(item.revenue || item.value).toLocaleString()}`
        }));
        
      case 'pie':
        if (queryLower.includes('department')) {
          const total = data.reduce((sum, item) => sum + (item.revenue || item.value), 0);
          return data.map(item => ({
            name: item.department || item.name,
            value: item.revenue || item.value,
            percentage: ((item.revenue || item.value) / total * 100).toFixed(1)
          }));
        }
        return data.map(item => ({
          name: item.name || item.month,
          value: item.value || item.revenue
        }));
        
      case 'bar':
        return data.map(item => ({
          name: item.month || item.department || item.name,
          value: item.revenue || item.value,
          growth: item.growth
        }));
        
      case 'scatter':
        return data.map(item => ({
          x: item.revenue || item.value,
          y: item.growth || item.employees,
          name: item.month || item.department || item.name
        }));
        
      default:
        return data;
    }
  }

  private determineXAxis(data: any[], query: string): string {
    if (data[0]?.month) return 'Month';
    if (data[0]?.department) return 'Department';
    if (data[0]?.name) return 'Category';
    return 'X-Axis';
  }

  private determineYAxis(data: any[], query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('revenue')) return 'Revenue ($)';
    if (queryLower.includes('growth')) return 'Growth Rate (%)';
    if (queryLower.includes('employees')) return 'Employee Count';
    if (data[0]?.revenue) return 'Revenue ($)';
    if (data[0]?.value) return 'Value';
    
    return 'Y-Axis';
  }

  private getChartColors(type: string): string[] {
    const colorSchemes = {
      bar: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'],
      line: ['#3b82f6', '#ef4444'],
      pie: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
      area: ['#3b82f6', '#ef4444'],
      scatter: ['#3b82f6']
    };
    
    return colorSchemes[type] || colorSchemes.bar;
  }

  private generateChartInsights(chart: ChartData, rawData: any[]): string[] {
    const insights: string[] = [];
    
    switch (chart.type) {
      case 'line':
        const trend = this.analyzeTrend(chart.data);
        insights.push(`The trend shows a ${trend.direction} pattern with ${trend.strength} consistency`);
        
        const peaks = this.findPeaks(chart.data);
        if (peaks.length > 0) {
          insights.push(`Peak performance occurred in: ${peaks.join(', ')}`);
        }
        break;
        
      case 'bar':
        const highest = chart.data.reduce((max, item) => item.value > max.value ? item : max);
        const lowest = chart.data.reduce((min, item) => item.value < min.value ? item : min);
        
        insights.push(`Highest performer: ${highest.name} with ${highest.value.toLocaleString()}`);
        insights.push(`Lowest performer: ${lowest.name} with ${lowest.value.toLocaleString()}`);
        
        const range = highest.value - lowest.value;
        insights.push(`Performance range: ${range.toLocaleString()} (${((range/lowest.value)*100).toFixed(1)}% variation)`);
        break;
        
      case 'pie':
        const total = chart.data.reduce((sum, item) => sum + item.value, 0);
        const largest = chart.data.reduce((max, item) => item.value > max.value ? item : max);
        
        insights.push(`${largest.name} represents the largest share at ${((largest.value/total)*100).toFixed(1)}%`);
        
        const balanced = chart.data.every(item => Math.abs((item.value/total) - 0.25) < 0.1);
        if (balanced) {
          insights.push('Distribution is relatively balanced across categories');
        } else {
          insights.push('Distribution shows significant variation across categories');
        }
        break;
    }
    
    return insights;
  }

  private generateChartSummary(chart: ChartData, rawData: any[]): string {
    const dataPoints = chart.data.length;
    const chartTypeDesc = {
      bar: 'comparison',
      line: 'trend analysis',
      pie: 'distribution breakdown',
      area: 'cumulative analysis',
      scatter: 'correlation analysis'
    };
    
    return `${chart.title} showing ${chartTypeDesc[chart.type]} across ${dataPoints} data points. The visualization reveals key patterns and performance indicators for strategic decision-making.`;
  }

  private analyzeTrend(data: any[]): { direction: string; strength: string } {
    if (data.length < 2) return { direction: 'insufficient data', strength: 'unknown' };
    
    const values = data.map(d => d.y);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    let direction = 'stable';
    if (Math.abs(change) > 0.05) {
      direction = change > 0 ? 'upward' : 'downward';
    }
    
    let strength = 'weak';
    if (Math.abs(change) > 0.2) strength = 'strong';
    else if (Math.abs(change) > 0.1) strength = 'moderate';
    
    return { direction, strength };
  }

  private findPeaks(data: any[]): string[] {
    const values = data.map(d => d.y);
    const peaks: string[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(data[i].x);
      }
    }
    
    return peaks;
  }
}

export const chartGenerator = new ChartGenerator();