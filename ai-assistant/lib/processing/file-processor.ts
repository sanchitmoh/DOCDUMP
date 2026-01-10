import { openai, AI_MODELS } from '../config/openai';
import { ragService } from '../retrieval/rag-service';
import { analyticsEngine } from '../analytics/analytics-engine';
import { extractJsonFromAIResponse } from '../../../lib/utils';
import * as XLSX from 'xlsx';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

interface ProcessedFile {
  fileId: string;
  fileName: string;
  fileType: string;
  content: {
    text: string;
    tables: any[];
    metadata: any;
  };
  analytics: {
    summary: string;
    keyMetrics: any[];
    insights: string[];
    suggestedQuestions: string[];
  };
  readyForChat: boolean;
}

interface FileAnalytics {
  dataType: 'sales' | 'financial' | 'hr' | 'operational' | 'mixed';
  timeRange?: { start: Date; end: Date };
  keyColumns: string[];
  rowCount: number;
  numericColumns: string[];
  trends: any[];
  anomalies: any[];
}

class FileProcessor {
  
  async processUploadedFile(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    userId: string,
    orgId: string
  ): Promise<ProcessedFile> {
    
    console.log(`Processing file: ${fileName} (${fileType})`);
    
    // 1. Extract content based on file type
    const content = await this.extractContent(fileBuffer, fileName, fileType);
    
    // 2. Perform immediate analytics
    const analytics = await this.performFileAnalytics(content, fileName);
    
    // 3. Store for RAG retrieval
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await ragService.processAndStoreDocument(fileId, orgId, fileName, content.text);
    
    // 4. Generate suggested questions
    const suggestedQuestions = await this.generateSuggestedQuestions(content, analytics);
    
    const processedFile: ProcessedFile = {
      fileId,
      fileName,
      fileType,
      content,
      analytics: {
        ...analytics,
        suggestedQuestions
      },
      readyForChat: true
    };
    
    console.log(`File processed successfully: ${fileName}`);
    return processedFile;
  }

  private async extractContent(buffer: Buffer, fileName: string, fileType: string) {
    const content = {
      text: '',
      tables: [] as any[],
      metadata: {}
    };

    try {
      switch (fileType.toLowerCase()) {
        case 'pdf':
          content.text = await this.extractFromPDF(buffer);
          break;
          
        case 'docx':
        case 'doc':
          content.text = await this.extractFromWord(buffer);
          break;
          
        case 'xlsx':
        case 'xls':
          const excelData = await this.extractFromExcel(buffer);
          content.text = excelData.text;
          content.tables = excelData.tables;
          content.metadata = excelData.metadata;
          break;
          
        case 'csv':
          const csvData = await this.extractFromCSV(buffer);
          content.text = csvData.text;
          content.tables = [csvData.table];
          content.metadata = csvData.metadata;
          break;
          
        case 'txt':
          content.text = buffer.toString('utf-8');
          break;
          
        default:
          // Try to extract as text
          content.text = buffer.toString('utf-8');
      }
    } catch (error) {
      console.error(`Error extracting content from ${fileName}:`, error);
      content.text = `Error processing file: ${fileName}`;
    }

    return content;
  }

  private async extractFromPDF(buffer: Buffer): Promise<string> {
    // For now, return placeholder - in production, use pdf-parse
    return "PDF content extraction - implement with pdf-parse library";
  }

  private async extractFromWord(buffer: Buffer): Promise<string> {
    // For now, return placeholder - in production, use mammoth
    return "Word document content extraction - implement with mammoth library";
  }

  private async extractFromExcel(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const tables: any[] = [];
    let fullText = '';
    
    const metadata = {
      sheetNames: workbook.SheetNames,
      totalSheets: workbook.SheetNames.length
    };

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length > 0) {
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        
        tables.push({
          sheetName,
          headers,
          rows,
          rowCount: rows.length
        });
        
        // Convert to text for RAG
        fullText += `\n\n=== Sheet: ${sheetName} ===\n`;
        fullText += `Headers: ${headers.join(', ')}\n`;
        fullText += `Rows: ${rows.length}\n`;
        
        // Add sample data
        rows.slice(0, 5).forEach((row: any[], index: number) => {
          fullText += `Row ${index + 1}: ${row.join(', ')}\n`;
        });
      }
    });

    return { text: fullText, tables, metadata };
  }

  private async extractFromCSV(buffer: Buffer) {
    return new Promise<{ text: string; table: any; metadata: any }>((resolve, reject) => {
      const results: any[] = [];
      let headers: string[] = [];
      
      const stream = Readable.from(buffer.toString());
      
      stream
        .pipe(csv())
        .on('headers', (headerList: string[]) => {
          headers = headerList;
        })
        .on('data', (data: any) => {
          results.push(data);
        })
        .on('end', () => {
          const text = `CSV File Analysis:\nHeaders: ${headers.join(', ')}\nRows: ${results.length}\n\nSample Data:\n${results.slice(0, 5).map((row, i) => `Row ${i + 1}: ${Object.values(row).join(', ')}`).join('\n')}`;
          
          resolve({
            text,
            table: { headers, rows: results },
            metadata: { rowCount: results.length, columnCount: headers.length }
          });
        })
        .on('error', reject);
    });
  }

  private async performFileAnalytics(content: any, fileName: string): Promise<FileAnalytics & { summary: string; keyMetrics: any[]; insights: string[] }> {
    
    // Analyze tables if present
    let analytics: FileAnalytics = {
      dataType: 'mixed',
      keyColumns: [],
      rowCount: 0,
      numericColumns: [],
      trends: [],
      anomalies: []
    };

    if (content.tables && content.tables.length > 0) {
      analytics = await this.analyzeTableData(content.tables[0]);
    }

    // Generate AI summary and insights
    const aiAnalysis = await this.generateAIAnalysis(content.text, analytics);
    
    return {
      ...analytics,
      summary: aiAnalysis.summary,
      keyMetrics: aiAnalysis.keyMetrics,
      insights: aiAnalysis.insights
    };
  }

  private async analyzeTableData(table: any): Promise<FileAnalytics> {
    const { headers, rows } = table;
    
    if (!headers || !rows || rows.length === 0) {
      return {
        dataType: 'mixed',
        keyColumns: [],
        rowCount: 0,
        numericColumns: [],
        trends: [],
        anomalies: []
      };
    }

    // Identify numeric columns
    const numericColumns: string[] = [];
    const sampleRow = rows[0];
    
    headers.forEach((header: string, index: number) => {
      const value = sampleRow[index];
      if (!isNaN(parseFloat(value)) && isFinite(value)) {
        numericColumns.push(header);
      }
    });

    // Detect data type based on column names
    const dataType = this.detectDataType(headers);
    
    // Find time-related columns
    const timeRange = this.detectTimeRange(headers, rows);
    
    // Calculate basic trends for numeric columns
    const trends = this.calculateTrends(headers, rows, numericColumns);
    
    // Detect anomalies
    const anomalies = this.detectAnomalies(headers, rows, numericColumns);

    return {
      dataType,
      timeRange,
      keyColumns: headers,
      rowCount: rows.length,
      numericColumns,
      trends,
      anomalies
    };
  }

  private detectDataType(headers: string[]): 'sales' | 'financial' | 'hr' | 'operational' | 'mixed' {
    const headerStr = headers.join(' ').toLowerCase();
    
    if (headerStr.includes('revenue') || headerStr.includes('sales') || headerStr.includes('profit')) {
      return 'sales';
    }
    if (headerStr.includes('expense') || headerStr.includes('cost') || headerStr.includes('budget')) {
      return 'financial';
    }
    if (headerStr.includes('employee') || headerStr.includes('salary') || headerStr.includes('department')) {
      return 'hr';
    }
    if (headerStr.includes('operation') || headerStr.includes('production') || headerStr.includes('inventory')) {
      return 'operational';
    }
    
    return 'mixed';
  }

  private detectTimeRange(headers: string[], rows: any[]): { start: Date; end: Date } | undefined {
    // Look for date columns
    const dateColumns = headers.filter(h => 
      h.toLowerCase().includes('date') || 
      h.toLowerCase().includes('time') || 
      h.toLowerCase().includes('month') ||
      h.toLowerCase().includes('year')
    );

    if (dateColumns.length === 0) return undefined;

    try {
      const dates = rows.map(row => {
        const dateIndex = headers.indexOf(dateColumns[0]);
        return new Date(row[dateIndex]);
      }).filter(date => !isNaN(date.getTime()));

      if (dates.length === 0) return undefined;

      return {
        start: new Date(Math.min(...dates.map(d => d.getTime()))),
        end: new Date(Math.max(...dates.map(d => d.getTime())))
      };
    } catch {
      return undefined;
    }
  }

  private calculateTrends(headers: string[], rows: any[], numericColumns: string[]): any[] {
    const trends: any[] = [];

    numericColumns.forEach(column => {
      const columnIndex = headers.indexOf(column);
      const values = rows.map(row => parseFloat(row[columnIndex])).filter(v => !isNaN(v));
      
      if (values.length < 2) return;

      // Calculate simple trend
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const trendDirection = secondAvg > firstAvg ? 'increasing' : secondAvg < firstAvg ? 'decreasing' : 'stable';
      const trendStrength = Math.abs((secondAvg - firstAvg) / firstAvg);

      trends.push({
        column,
        direction: trendDirection,
        strength: trendStrength,
        change: ((secondAvg - firstAvg) / firstAvg * 100).toFixed(2) + '%'
      });
    });

    return trends;
  }

  private detectAnomalies(headers: string[], rows: any[], numericColumns: string[]): any[] {
    const anomalies: any[] = [];

    numericColumns.forEach(column => {
      const columnIndex = headers.indexOf(column);
      const values = rows.map(row => parseFloat(row[columnIndex])).filter(v => !isNaN(v));
      
      if (values.length < 3) return;

      // Simple outlier detection using IQR
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      values.forEach((value, index) => {
        if (value < lowerBound || value > upperBound) {
          anomalies.push({
            column,
            rowIndex: index,
            value,
            type: value < lowerBound ? 'low_outlier' : 'high_outlier'
          });
        }
      });
    });

    return anomalies.slice(0, 10); // Limit to top 10 anomalies
  }

  private async generateAIAnalysis(text: string, analytics: FileAnalytics) {
    const prompt = `Analyze this data file and provide:
1. A concise summary (2-3 sentences)
2. Key metrics (3-5 important numbers/findings)
3. Business insights (3-4 actionable insights)

File Content Summary:
${text.substring(0, 2000)}

Analytics:
- Data Type: ${analytics.dataType}
- Row Count: ${analytics.rowCount}
- Numeric Columns: ${analytics.numericColumns.join(', ')}
- Trends: ${JSON.stringify(analytics.trends)}
- Anomalies Found: ${analytics.anomalies.length}

Provide analysis in JSON format:
{
  "summary": "...",
  "keyMetrics": [{"name": "...", "value": "...", "significance": "..."}],
  "insights": ["...", "...", "..."]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: AI_MODELS.CHAT,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '{}';
      return extractJsonFromAIResponse(content);
    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        summary: `File contains ${analytics.rowCount} rows of ${analytics.dataType} data with ${analytics.numericColumns.length} numeric columns.`,
        keyMetrics: [
          { name: 'Total Rows', value: analytics.rowCount.toString(), significance: 'Data volume' },
          { name: 'Numeric Columns', value: analytics.numericColumns.length.toString(), significance: 'Analysis potential' }
        ],
        insights: [
          'File has been processed and is ready for analysis',
          'Multiple data points available for trend analysis',
          'Ready to answer questions about the data'
        ]
      };
    }
  }

  private async generateSuggestedQuestions(content: any, analytics: any): Promise<string[]> {
    const baseQuestions = [
      "What are the key insights from this data?",
      "Show me a summary of the main findings",
      "What trends can you identify?"
    ];

    // Add data-type specific questions
    const specificQuestions: string[] = [];
    
    switch (analytics.dataType) {
      case 'sales':
        specificQuestions.push(
          "What's the sales trend over time?",
          "Which period had the highest revenue?",
          "Show me a chart of sales performance",
          "What's the growth rate analysis?"
        );
        break;
        
      case 'financial':
        specificQuestions.push(
          "What's the expense breakdown?",
          "Show me the budget vs actual analysis",
          "What are the cost trends?",
          "Which categories have the highest spending?"
        );
        break;
        
      case 'hr':
        specificQuestions.push(
          "What's the employee distribution by department?",
          "Show me salary analysis by role",
          "What are the hiring trends?",
          "Which departments are growing fastest?"
        );
        break;
        
      default:
        specificQuestions.push(
          "What patterns do you see in the data?",
          "Show me the distribution of key metrics",
          "What correlations exist between variables?",
          "Are there any anomalies to investigate?"
        );
    }

    // Add trend-based questions if trends exist
    if (analytics.trends && analytics.trends.length > 0) {
      specificQuestions.push(
        `Explain the ${analytics.trends[0].direction} trend in ${analytics.trends[0].column}`,
        "Compare the performance across different time periods"
      );
    }

    // Add anomaly questions if anomalies exist
    if (analytics.anomalies && analytics.anomalies.length > 0) {
      specificQuestions.push(
        "What caused the unusual values in the data?",
        "Show me the outliers and explain them"
      );
    }

    return [...baseQuestions, ...specificQuestions].slice(0, 8); // Return top 8 questions
  }
}

export const fileProcessor = new FileProcessor();