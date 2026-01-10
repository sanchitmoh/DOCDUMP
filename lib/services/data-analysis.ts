import * as XLSX from 'xlsx';
import { executeQuery } from '@/lib/database';

export interface DataAnalysisResult {
  summary: {
    totalRecords: number;
    columns: string[];
    dataTypes: { [key: string]: string };
    dateRange?: { start: string; end: string };
  };
  statistics: {
    [column: string]: {
      type: 'numeric' | 'categorical' | 'date' | 'text';
      count: number;
      unique?: number;
      min?: number;
      max?: number;
      mean?: number;
      median?: number;
      mode?: string | number;
      standardDeviation?: number;
      topValues?: Array<{ value: any; count: number }>;
    };
  };
  insights: string[];
  recommendations: string[];
  chartSuggestions: Array<{
    type: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'heatmap';
    title: string;
    description: string;
    xAxis?: string;
    yAxis?: string;
    data: any[];
    config: any;
  }>;
}

export class DataAnalysisService {
  
  /**
   * Analyze Excel data and generate comprehensive insights
   */
  async analyzeExcelData(fileId: number): Promise<DataAnalysisResult> {
    let file: any = null;
    
    try {
      // Get file information
      const files = await executeQuery(
        'SELECT name, storage_key, local_path, mime_type FROM files WHERE id = ? AND is_deleted = 0',
        [fileId]
      );

      if (files.length === 0) {
        throw new Error('File not found');
      }

      file = files[0] as any;

      // Try to get extracted text from the separate table
      const extractedTextResults = await executeQuery(
        'SELECT extracted_text FROM extracted_text_content WHERE file_id = ? LIMIT 1',
        [fileId]
      );

      // If we have extracted text, try to use it first for fallback
      if (extractedTextResults.length > 0) {
        const extractedText = extractedTextResults[0] as any;
        console.log('Found extracted text content, will use as fallback if Excel reading fails');
        file.extracted_text = extractedText.extracted_text;
      }

      // First, try to get data from extracted_text if available and Excel reading fails
      let useExtractedTextFallback = false;

      // Read Excel file
      const path = require('path');
      const fs = require('fs');
      
      // Construct file path based on storage configuration
      let filePath = '';
      if (file.local_path) {
        filePath = path.resolve(file.local_path);
      } else if (file.storage_key) {
        // For hybrid storage, check local storage first
        const localStoragePath = process.env.LOCAL_STORAGE_PATH || './storage/files';
        filePath = path.resolve(path.join(localStoragePath, file.storage_key));
      } else {
        throw new Error('No file path available');
      }

      // Normalize path for Windows
      filePath = path.normalize(filePath);

      console.log('Reading Excel file from:', filePath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
      }

      // Read file as buffer to handle paths with spaces and special characters
      let workbook;
      try {
        console.log('Attempting to read file buffer...');
        const buffer = fs.readFileSync(filePath);
        console.log(`Buffer read successfully, size: ${buffer.length} bytes`);
        
        console.log('Parsing Excel workbook from buffer...');
        workbook = XLSX.read(buffer, { type: 'buffer' });
        console.log(`Workbook parsed successfully, sheets: ${workbook.SheetNames.join(', ')}`);
        
        // Process the workbook immediately after successful reading
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON for analysis
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          throw new Error('No data found in Excel file');
        }

        // Extract headers and data
        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1).filter(row => row && (row as any[]).some(cell => cell !== undefined && cell !== ''));

        if (dataRows.length === 0) {
          throw new Error('No data rows found in Excel file');
        }

        console.log(`Analyzing Excel data: ${headers.length} columns, ${dataRows.length} rows`);

        // Perform comprehensive analysis
        const analysis = this.performDataAnalysis(headers, dataRows);
        
        return analysis;
        
      } catch (readError) {
        console.error('Error reading Excel file:', readError);
        
        // Provide more specific error messages
        if (readError.code === 'ENOENT') {
          throw new Error(`File not found: ${filePath}`);
        } else if (readError.code === 'EACCES') {
          throw new Error(`Permission denied accessing file: ${filePath}`);
        } else if (readError.message?.includes('Unsupported file')) {
          throw new Error(`Invalid Excel file format: ${filePath}`);
        } else {
          throw new Error(`Cannot read Excel file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
        }
      }
      
    } catch (error) {
      console.error('Excel file reading failed, trying extracted text fallback:', error);
      
      // If Excel reading fails and we have extracted text, use it as fallback
      if (file && file.extracted_text) {
        console.log('Using extracted text content for analysis');
        return this.analyzeFromExtractedText(file.extracted_text, file.name);
      }
      
      // If no fallback available, throw the original error
      throw error;
    }
  }

  /**
   * Perform comprehensive data analysis
   */
  private performDataAnalysis(headers: string[], dataRows: any[][]): DataAnalysisResult {
    const totalRecords = dataRows.length;
    const statistics: any = {};
    const insights: string[] = [];
    const recommendations: string[] = [];
    const chartSuggestions: any[] = [];

    console.log(`Starting analysis of ${totalRecords} records with ${headers.length} columns`);

    // Analyze each column
    headers.forEach((header, index) => {
      const columnData = dataRows.map(row => row[index]).filter(val => val !== undefined && val !== '');
      
      if (columnData.length === 0) return;

      const analysis = this.analyzeColumn(header, columnData);
      statistics[header] = analysis;

      // Generate insights
      if (analysis.type === 'numeric') {
        insights.push(`${header}: Average ${analysis.mean?.toFixed(2)}, Range ${analysis.min} - ${analysis.max}`);
        
        // Only create charts for numeric data with meaningful variation
        if (analysis.standardDeviation && analysis.standardDeviation > 0.1) {
          chartSuggestions.push({
            type: 'bar',
            title: `${header} Distribution`,
            description: `Statistical distribution of ${header} values`,
            data: this.createNumericBarData(columnData, header),
            config: { xAxis: 'range', yAxis: 'count' }
          });
        }

      } else if (analysis.type === 'categorical') {
        insights.push(`${header}: ${analysis.unique} unique values, most common: ${analysis.mode}`);
        
        // Create pie chart for categorical data with reasonable number of categories
        if (analysis.topValues && analysis.topValues.length <= 8 && analysis.topValues.length > 1) {
          chartSuggestions.push({
            type: 'pie',
            title: `${header} Distribution`,
            description: `Breakdown of ${header} categories`,
            data: analysis.topValues.map(item => ({ 
              name: String(item.value).length > 20 ? String(item.value).substring(0, 20) + '...' : String(item.value), 
              value: item.count 
            })),
            config: { dataKey: 'value', nameKey: 'name' }
          });
        }

        // Create bar chart for categorical data (prefer this over pie for many categories)
        if (analysis.topValues && analysis.topValues.length <= 15 && analysis.topValues.length > 1) {
          chartSuggestions.push({
            type: 'bar',
            title: `${header} Count`,
            description: `Frequency count of ${header} categories`,
            data: analysis.topValues.slice(0, 10).map(item => ({ 
              category: String(item.value).length > 15 ? String(item.value).substring(0, 15) + '...' : String(item.value), 
              count: item.count 
            })),
            config: { xAxis: 'category', yAxis: 'count' }
          });
        }
      }
    });

    // Generate cross-column insights for financial data
    this.generateFinancialInsights(headers, dataRows, statistics, insights, chartSuggestions);

    // Generate recommendations
    recommendations.push('Consider creating time-series visualizations if date columns are available');
    recommendations.push('Use correlation analysis to identify relationships between numeric variables');
    recommendations.push('Create categorical breakdowns to understand data distribution');
    
    if (totalRecords > 1000) {
      recommendations.push('Consider data sampling for large datasets to improve visualization performance');
    }

    console.log(`Analysis complete: ${insights.length} insights, ${chartSuggestions.length} chart suggestions`);

    return {
      summary: {
        totalRecords,
        columns: headers,
        dataTypes: Object.fromEntries(headers.map(h => [h, statistics[h]?.type || 'unknown']))
      },
      statistics,
      insights,
      recommendations,
      chartSuggestions: chartSuggestions.slice(0, 6) // Limit to 6 chart suggestions
    };
  }

  /**
   * Generate financial-specific insights and charts
   */
  private generateFinancialInsights(headers: string[], dataRows: any[][], statistics: any, insights: string[], chartSuggestions: any[]) {
    // Look for financial transaction patterns
    const amountIndex = headers.findIndex(h => h.toLowerCase().includes('amount'));
    const typeIndex = headers.findIndex(h => h.toLowerCase().includes('type'));
    const statusIndex = headers.findIndex(h => h.toLowerCase().includes('status'));
    const currencyIndex = headers.findIndex(h => h.toLowerCase().includes('currency'));
    const dateIndex = headers.findIndex(h => h.toLowerCase().includes('date'));

    // Transaction type analysis
    if (typeIndex >= 0) {
      const typeData = dataRows.map(row => row[typeIndex]).filter(val => val);
      const typeCounts = {};
      typeData.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      if (Object.keys(typeCounts).length > 1) {
        insights.push(`Transaction types: ${Object.entries(typeCounts).map(([type, count]) => `${type} (${count})`).join(', ')}`);
        
        chartSuggestions.push({
          type: 'pie',
          title: 'Transaction Types',
          description: 'Distribution of transaction types in your data',
          data: Object.entries(typeCounts).map(([type, count]) => ({ name: type, value: count })),
          config: { dataKey: 'value', nameKey: 'name' }
        });
      }
    }

    // Amount analysis by type
    if (amountIndex >= 0 && typeIndex >= 0) {
      const amountByType = {};
      dataRows.forEach(row => {
        const amount = parseFloat(row[amountIndex]);
        const type = row[typeIndex];
        if (!isNaN(amount) && type) {
          if (!amountByType[type]) amountByType[type] = [];
          amountByType[type].push(amount);
        }
      });

      if (Object.keys(amountByType).length > 1) {
        const avgByType = Object.entries(amountByType).map(([type, amounts]) => ({
          type,
          average: amounts.reduce((a, b) => a + b, 0) / amounts.length,
          total: amounts.reduce((a, b) => a + b, 0),
          count: amounts.length
        }));

        insights.push(`Average amounts by type: ${avgByType.map(item => `${item.type}: ${item.average.toFixed(2)}`).join(', ')}`);

        chartSuggestions.push({
          type: 'bar',
          title: 'Average Amount by Transaction Type',
          description: 'Comparison of average transaction amounts by type',
          data: avgByType.map(item => ({ category: item.type, amount: parseFloat(item.average.toFixed(2)) })),
          config: { xAxis: 'category', yAxis: 'amount' }
        });
      }
    }

    // Currency distribution
    if (currencyIndex >= 0) {
      const currencyData = dataRows.map(row => {
        const currency = row[currencyIndex];
        // Handle currency format like "('QAR', 'Qatari riyal')"
        if (typeof currency === 'string' && currency.includes(',')) {
          const match = currency.match(/\('([^']+)'/);
          return match ? match[1] : currency;
        }
        return currency;
      }).filter(val => val);

      const currencyCounts = {};
      currencyData.forEach(currency => {
        currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;
      });

      if (Object.keys(currencyCounts).length > 1) {
        insights.push(`Multi-currency transactions: ${Object.keys(currencyCounts).length} currencies detected`);
        
        chartSuggestions.push({
          type: 'pie',
          title: 'Currency Distribution',
          description: 'Breakdown of transactions by currency',
          data: Object.entries(currencyCounts).map(([currency, count]) => ({ name: currency, value: count })),
          config: { dataKey: 'value', nameKey: 'name' }
        });
      }
    }

    // Status analysis
    if (statusIndex >= 0) {
      const statusData = dataRows.map(row => row[statusIndex]).filter(val => val);
      const statusCounts = {};
      statusData.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      if (Object.keys(statusCounts).length > 1) {
        const completedCount = statusCounts['Completed'] || 0;
        const totalCount = statusData.length;
        const completionRate = ((completedCount / totalCount) * 100).toFixed(1);
        
        insights.push(`Transaction completion rate: ${completionRate}% (${completedCount}/${totalCount})`);
        
        chartSuggestions.push({
          type: 'pie',
          title: 'Transaction Status',
          description: 'Current status of all transactions',
          data: Object.entries(statusCounts).map(([status, count]) => ({ name: status, value: count })),
          config: { dataKey: 'value', nameKey: 'name' }
        });
      }
    }
  }

  /**
   * Create bar chart data for numeric columns
   */
  private createNumericBarData(data: any[], columnName: string) {
    const numericData = data.filter(val => !isNaN(Number(val))).map(val => Number(val));
    if (numericData.length === 0) return [];

    const min = Math.min(...numericData);
    const max = Math.max(...numericData);
    
    // If all values are the same, create a single bin
    if (min === max) {
      return [{
        range: `${min}`,
        count: numericData.length
      }];
    }
    
    const binCount = Math.min(8, Math.ceil(Math.sqrt(numericData.length))); // Limit to 8 bins for readability
    const binSize = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    const binLabels = [];

    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binSize;
      const binEnd = min + (i + 1) * binSize;
      binLabels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
    }

    numericData.forEach(val => {
      let binIndex = Math.floor((val - min) / binSize);
      // Handle edge case where value equals max
      if (binIndex >= binCount) binIndex = binCount - 1;
      bins[binIndex]++;
    });

    return binLabels.map((label, index) => ({
      range: label,
      count: bins[index]
    })).filter(item => item.count > 0); // Remove empty bins
  }

  /**
   * Analyze individual column
   */
  private analyzeColumn(header: string, data: any[]) {
    const nonEmptyData = data.filter(val => val !== null && val !== undefined && val !== '');
    const count = nonEmptyData.length;
    const unique = new Set(nonEmptyData).size;

    // Determine data type
    const numericData = nonEmptyData.filter(val => !isNaN(Number(val))).map(val => Number(val));
    const isNumeric = numericData.length > count * 0.8; // 80% numeric threshold

    if (isNumeric && numericData.length > 0) {
      // Numeric analysis
      const sorted = numericData.sort((a, b) => a - b);
      const sum = numericData.reduce((a, b) => a + b, 0);
      const mean = sum / numericData.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const variance = numericData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericData.length;
      const standardDeviation = Math.sqrt(variance);

      return {
        type: 'numeric' as const,
        count,
        unique,
        min: Math.min(...numericData),
        max: Math.max(...numericData),
        mean,
        median,
        standardDeviation
      };
    } else {
      // Categorical analysis
      const valueCounts = new Map();
      nonEmptyData.forEach(val => {
        const key = String(val);
        valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
      });

      const topValues = Array.from(valueCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const mode = topValues[0]?.value;

      return {
        type: 'categorical' as const,
        count,
        unique,
        mode,
        topValues
      };
    }
  }

  /**
   * Create histogram data for numeric columns
   */
  private createHistogramData(data: any[]) {
    const numericData = data.filter(val => !isNaN(Number(val))).map(val => Number(val));
    if (numericData.length === 0) return [];

    const min = Math.min(...numericData);
    const max = Math.max(...numericData);
    const binCount = Math.min(20, Math.ceil(Math.sqrt(numericData.length)));
    const binSize = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    const binLabels = [];

    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binSize;
      const binEnd = min + (i + 1) * binSize;
      binLabels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
    }

    numericData.forEach(val => {
      const binIndex = Math.min(Math.floor((val - min) / binSize), binCount - 1);
      bins[binIndex]++;
    });

    return binLabels.map((label, index) => ({
      range: label,
      count: bins[index]
    }));
  }

  /**
   * Create time series data
   */
  private createTimeSeriesData(dataRows: any[][], dateIndex: number, valueIndex: number) {
    return dataRows
      .filter(row => row[dateIndex] && row[valueIndex])
      .map(row => ({
        date: row[dateIndex],
        value: Number(row[valueIndex]) || 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 100); // Limit to 100 points for performance
  }

  /**
   * Create scatter plot data
   */
  private createScatterData(dataRows: any[][], xIndex: number, yIndex: number) {
    return dataRows
      .filter(row => row[xIndex] && row[yIndex])
      .map(row => ({
        x: Number(row[xIndex]) || 0,
        y: Number(row[yIndex]) || 0
      }))
      .slice(0, 200); // Limit to 200 points for performance
  }

  /**
   * Fallback analysis using extracted text content
   */
  private analyzeFromExtractedText(extractedText: string, fileName: string): DataAnalysisResult {
    console.log('Performing fallback analysis from extracted text');
    
    // Parse the extracted text to find tabular data
    const lines = extractedText.split('\n').filter(line => line.trim());
    
    // Try to identify headers and data rows
    let headers: string[] = [];
    let dataRows: any[][] = [];
    
    // Look for patterns that suggest tabular data
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and sheet names
      if (!line || line.startsWith('Sheet:')) continue;
      
      // Split by tabs or multiple spaces (common in extracted text)
      const cells = line.split(/\t+|\s{2,}/).filter(cell => cell.trim());
      
      if (cells.length > 1) {
        if (headers.length === 0) {
          headers = cells;
        } else {
          dataRows.push(cells);
        }
      }
    }
    
    // If we couldn't parse tabular data, create a simple analysis
    if (headers.length === 0 || dataRows.length === 0) {
      return this.createFallbackAnalysis(fileName, extractedText);
    }
    
    console.log(`Parsed ${headers.length} columns and ${dataRows.length} rows from extracted text`);
    
    // Perform analysis on the parsed data
    return this.performDataAnalysis(headers, dataRows);
  }

  /**
   * Create a basic analysis when data parsing fails
   */
  private createFallbackAnalysis(fileName: string, content: string): DataAnalysisResult {
    const wordCount = content.split(/\s+/).length;
    const lineCount = content.split('\n').length;
    
    return {
      summary: {
        totalRecords: lineCount,
        columns: ['Content'],
        dataTypes: { 'Content': 'text' }
      },
      statistics: {
        'Content': {
          type: 'text' as const,
          count: lineCount,
          unique: Math.min(lineCount, wordCount)
        }
      },
      insights: [
        `Document contains ${wordCount} words across ${lineCount} lines`,
        'Text-based analysis performed due to data parsing limitations',
        'Consider re-uploading the file for detailed numerical analysis'
      ],
      recommendations: [
        'Upload the original Excel file for comprehensive analysis',
        'Ensure the file is not corrupted or password-protected',
        'Check file format compatibility'
      ],
      chartSuggestions: [
        {
          type: 'bar',
          title: 'Document Statistics',
          description: 'Basic document metrics',
          data: [
            { name: 'Lines', value: lineCount },
            { name: 'Words', value: Math.min(wordCount, 1000) }, // Cap for visualization
          ],
          config: { xAxis: 'name', yAxis: 'value' }
        }
      ]
    };
  }
}

export const dataAnalysisService = new DataAnalysisService();