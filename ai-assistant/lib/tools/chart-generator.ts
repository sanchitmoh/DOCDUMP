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
    // Import database utilities
    const { executeQuery } = await import('../../../lib/database');
    
    const queryLower = query.toLowerCase();
    
    try {
      // Fetch real data based on query type
      
      // Department-based queries
      if (queryLower.includes('department')) {
        const departmentData = await executeQuery(`
          SELECT 
            d.name as department,
            COUNT(DISTINCT f.id) as file_count,
            COUNT(DISTINCT f.created_by) as employee_count,
            SUM(f.size_bytes) as total_size,
            AVG(f.view_count) as avg_views,
            AVG(f.download_count) as avg_downloads
          FROM departments d
          LEFT JOIN files f ON f.department = d.name AND f.organization_id = d.organization_id AND f.is_deleted = 0
          WHERE d.organization_id = ?
          GROUP BY d.name
          ORDER BY file_count DESC
        `, [orgId]);
        
        return departmentData.map((row: any) => ({
          department: row.department,
          value: row.file_count,
          revenue: row.file_count * 1000, // Mock revenue calculation
          employees: row.employee_count,
          totalSize: row.total_size,
          avgViews: row.avg_views || 0,
          avgDownloads: row.avg_downloads || 0
        }));
      }
      
      // File type distribution
      if (queryLower.includes('file type') || queryLower.includes('document type')) {
        const fileTypeData = await executeQuery(`
          SELECT 
            file_type,
            COUNT(*) as count,
            SUM(size_bytes) as total_size,
            AVG(view_count) as avg_views
          FROM files
          WHERE organization_id = ? AND is_deleted = 0
          GROUP BY file_type
          ORDER BY count DESC
        `, [orgId]);
        
        return fileTypeData.map((row: any) => ({
          name: row.file_type || 'Other',
          value: row.count,
          totalSize: row.total_size,
          avgViews: row.avg_views || 0
        }));
      }
      
      // Monthly upload trends
      if (queryLower.includes('monthly') || queryLower.includes('trend') || queryLower.includes('over time')) {
        const monthlyData = await executeQuery(`
          SELECT 
            DATE_FORMAT(created_at, '%Y-%m') as month,
            DATE_FORMAT(created_at, '%b %Y') as month_name,
            COUNT(*) as count,
            SUM(size_bytes) as total_size,
            AVG(view_count) as avg_views
          FROM files
          WHERE organization_id = ? AND is_deleted = 0
            AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
          GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
          ORDER BY month ASC
        `, [orgId]);
        
        // Calculate growth rates
        return monthlyData.map((row: any, index: number) => {
          const prevCount = index > 0 ? monthlyData[index - 1].count : row.count;
          const growth = prevCount > 0 ? ((row.count - prevCount) / prevCount * 100) : 0;
          
          return {
            month: row.month_name,
            value: row.count,
            revenue: row.count * 1000, // Mock revenue
            growth: parseFloat(growth.toFixed(1)),
            totalSize: row.total_size,
            avgViews: row.avg_views || 0
          };
        });
      }
      
      // User/Employee activity
      if (queryLower.includes('user') || queryLower.includes('employee') || queryLower.includes('contributor')) {
        const userData = await executeQuery(`
          SELECT 
            oe.full_name as name,
            COUNT(DISTINCT f.id) as file_count,
            SUM(f.view_count) as total_views,
            SUM(f.download_count) as total_downloads,
            MAX(f.created_at) as last_upload
          FROM organization_employees oe
          LEFT JOIN files f ON f.created_by = oe.id AND f.is_deleted = 0
          WHERE oe.organization_id = ?
          GROUP BY oe.id, oe.full_name
          HAVING file_count > 0
          ORDER BY file_count DESC
          LIMIT 10
        `, [orgId]);
        
        return userData.map((row: any) => ({
          name: row.name,
          value: row.file_count,
          totalViews: row.total_views || 0,
          totalDownloads: row.total_downloads || 0,
          lastUpload: row.last_upload
        }));
      }
      
      // Country/Location data (if available in your schema)
      if (queryLower.includes('country') || queryLower.includes('location')) {
        // This would need a country field in your database
        // For now, return empty array or mock data
        return [
          { name: 'United States', value: 45, count: 45 },
          { name: 'United Kingdom', value: 23, count: 23 },
          { name: 'Canada', value: 18, count: 18 },
          { name: 'Australia', value: 14, count: 14 }
        ];
      }
      
      // Rank/Performance data
      if (queryLower.includes('rank') || queryLower.includes('top') || queryLower.includes('performance')) {
        const topFiles = await executeQuery(`
          SELECT 
            f.name,
            f.file_type,
            f.view_count,
            f.download_count,
            (f.view_count + f.download_count * 2) as engagement_score
          FROM files f
          WHERE f.organization_id = ? AND f.is_deleted = 0
          ORDER BY engagement_score DESC
          LIMIT 10
        `, [orgId]);
        
        return topFiles.map((row: any, index: number) => ({
          rank: index + 1,
          name: row.name,
          value: row.engagement_score,
          views: row.view_count,
          downloads: row.download_count,
          fileType: row.file_type
        }));
      }
      
      // Default: Return general statistics
      const generalStats = await executeQuery(`
        SELECT 
          DATE_FORMAT(created_at, '%b') as month,
          COUNT(*) as count,
          SUM(size_bytes) as total_size
        FROM files
        WHERE organization_id = ? AND is_deleted = 0
          AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b')
        ORDER BY created_at ASC
      `, [orgId]);
      
      return generalStats.map((row: any) => ({
        month: row.month,
        value: row.count,
        revenue: row.count * 1000,
        totalSize: row.total_size
      }));
      
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Return empty array on error
      return [];
    }
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