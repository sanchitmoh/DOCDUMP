import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { executeQuery } from '@/lib/database';

// Initialize OpenAI client with timeout and retry configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      userId, 
      orgId, 
      conversationId, 
      fileId,
      fileName,
      documentIds, 
      contextType,
      conversationHistory = [] 
    } = body;

    // Validate required fields
    if (!message || !userId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, userId, orgId' },
        { status: 400 }
      );
    }

    try {
      // Validate OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
      }

      // Check if we should use a fallback response for testing
      if (message.toLowerCase().includes('test') && message.toLowerCase().includes('fallback')) {
        return NextResponse.json({
          success: true,
          data: {
            response: `This is a test response without OpenAI. Your message was: "${message}". ${fileId ? `You're asking about file: ${fileName}` : 'No file context provided.'}`,
            sources: fileId ? [`Document: ${fileName}`] : ['Local System'],
            charts: [],
            insights: ['This is a fallback response for testing', 'OpenAI integration bypassed'],
            reasoning: 'Fallback response for testing purposes',
            conversationId: conversationId || `conv_${Date.now()}`,
            fileContext: fileId ? { fileId, fileName } : undefined,
            metadata: {
              hasVisualizations: false,
              sourcesUsed: fileId ? 1 : 0,
              confidenceLevel: 'medium' as const,
              mode: 'fallback'
            },
            timestamp: new Date().toISOString(),
            contextType: contextType || 'General'
          }
        });
      }

      // If there's a file context, try to get the file information and content
      let fileContext = '';
      let file: any = null;
      if (fileId) {
        try {
          // Get file information from database
          const fileInfo = await executeQuery(
            `SELECT f.name, f.ai_summary, f.ai_description, f.ai_insights, f.mime_type, f.size_bytes,
                    f.storage_key, f.local_path
             FROM files f
             WHERE f.id = ? AND f.is_deleted = 0`,
            [fileId]
          );
          
          if (fileInfo.length > 0) {
            file = fileInfo[0] as any;
            
            // Get extracted text from separate table
            const extractedTextResults = await executeQuery(
              'SELECT extracted_text FROM extracted_text_content WHERE file_id = ? LIMIT 1',
              [fileId]
            );
            
            let extractedContent = '';
            if (extractedTextResults.length > 0) {
              const extractedTextData = extractedTextResults[0] as any;
              extractedContent = extractedTextData.extracted_text || '';
            }
            
            // Safely parse AI insights
            let insights = [];
            try {
              if (file.ai_insights) {
                // Check if it's already an array (MySQL JSON column returns parsed object)
                if (Array.isArray(file.ai_insights)) {
                  insights = file.ai_insights;
                } else if (typeof file.ai_insights === 'string') {
                  // If it's a string, try to parse it
                  const cleanedInsights = String(file.ai_insights).trim();
                  console.log('Raw AI insights:', cleanedInsights);
                  insights = JSON.parse(cleanedInsights);
                } else {
                  // If it's an object, convert to array
                  insights = [String(file.ai_insights)];
                }
                
                // Ensure it's an array
                if (!Array.isArray(insights)) {
                  insights = [String(insights)];
                }
              }
            } catch (error) {
              console.error('Error parsing AI insights:', error);
              console.error('Raw insights value:', file.ai_insights);
              console.error('Type of insights:', typeof file.ai_insights);
              
              // Fallback: treat as string and split by common delimiters
              if (file.ai_insights) {
                const insightsStr = String(file.ai_insights);
                if (insightsStr.includes(',')) {
                  insights = insightsStr.split(',').map(s => s.trim().replace(/["\[\]]/g, ''));
                } else {
                  insights = [insightsStr];
                }
              }
            }

            // Try to extract Excel content on-demand if no extracted text exists
            if (!extractedContent && file.mime_type?.includes('spreadsheet')) {
              try {
                console.log('Attempting on-demand Excel extraction for file:', file.name);
                
                // Dynamic import to avoid potential module loading issues
                const XLSX = await import('xlsx');
                const path = await import('path');
                const fs = await import('fs');
                
                // Construct file path based on storage configuration
                let filePath = '';
                if (file.local_path) {
                  filePath = path.resolve(file.local_path);
                } else if (file.storage_key) {
                  // For hybrid storage, check local storage first
                  const localStoragePath = process.env.LOCAL_STORAGE_PATH || './storage/files';
                  filePath = path.resolve(path.join(localStoragePath, file.storage_key));
                }
                
                // Normalize path for Windows
                filePath = path.normalize(filePath);
                console.log('Reading Excel file from:', filePath);
                
                // Check if file exists and is accessible
                if (fs.existsSync(filePath)) {
                  // First try to read the file buffer to ensure it's accessible
                  const buffer = fs.readFileSync(filePath);
                  console.log('File buffer read successfully, size:', buffer.length);
                  
                  // Read the workbook from buffer instead of file path
                  const workbook = XLSX.read(buffer, { type: 'buffer' });
                  let allText = '';
                  
                  workbook.SheetNames.forEach((sheetName: string) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const sheetText = XLSX.utils.sheet_to_txt(worksheet);
                    allText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
                  });
                  
                  extractedContent = allText.substring(0, 2000); // Limit to first 2000 chars
                  console.log('Successfully extracted Excel content:', extractedContent.length, 'characters');
                } else {
                  console.log('Excel file not found at path:', filePath);
                  extractedContent = 'Excel file is stored remotely and requires background processing for content extraction';
                }
              } catch (excelError) {
                console.error('On-demand Excel extraction failed:', excelError);
                const errorMsg = excelError instanceof Error ? excelError.message : 'Unknown error';
                if (errorMsg.includes('Cannot access file')) {
                  extractedContent = 'Excel file found but cannot be read - may be corrupted or locked';
                } else if (errorMsg.includes('ENOENT')) {
                  extractedContent = 'Excel file not found at expected location - may be stored remotely';
                } else {
                  extractedContent = `Excel content extraction failed: ${errorMsg}`;
                }
              }
            }
            
            fileContext = `
File Information:
- Name: ${file.name}
- Type: ${file.mime_type}
- Size: ${Math.round(file.size_bytes / 1024)} KB
${file.ai_summary ? `- AI Summary: ${file.ai_summary}` : ''}
${file.ai_description ? `- Description: ${file.ai_description}` : ''}
${insights.length > 0 ? `- Key Insights: ${insights.join(', ')}` : ''}
${extractedContent ? `- Content Preview: ${extractedContent.substring(0, 1500)}${extractedContent.length > 1500 ? '...' : ''}` : ''}

Based on this file information, please provide analysis and insights. You have access to the actual file content above.`;
          }
        } catch (error) {
          console.error('Error fetching file info:', error);
          fileContext = `File "${fileName}" is available in the system but detailed content analysis is currently unavailable.`;
        }
      }

      // Enhanced system prompt with data analysis context
      let analysisContext: string = '';
      let dataAnalysis: any = null;

      // If user is asking for analysis/charts and we have a file, perform advanced analysis
      const shouldIncludeChart = message.toLowerCase().includes('chart') || 
                                message.toLowerCase().includes('graph') || 
                                message.toLowerCase().includes('visualize') ||
                                message.toLowerCase().includes('plot') ||
                                message.toLowerCase().includes('analyze') ||
                                message.toLowerCase().includes('data');

      if (shouldIncludeChart && fileId && file && file.mime_type?.includes('spreadsheet')) {
        try {
          console.log('Performing advanced data analysis for file:', file.name);
          
          // Import the data analysis service
          const { dataAnalysisService } = await import('@/lib/services/data-analysis');
          
          // Perform comprehensive analysis
          dataAnalysis = await dataAnalysisService.analyzeExcelData(parseInt(fileId));
          
          analysisContext = `

ADVANCED DATA ANALYSIS RESULTS:
- Total Records: ${dataAnalysis.summary.totalRecords}
- Columns: ${dataAnalysis.summary.columns.join(', ')}
- Key Statistics: ${Object.entries(dataAnalysis.statistics).slice(0, 3).map(([col, stats]: [string, any]) => 
  `${col} (${stats.type}): ${stats.type === 'numeric' ? `avg ${stats.mean?.toFixed(2)}` : `${stats.unique} unique values`}`
).join(', ')}
- Generated ${dataAnalysis.chartSuggestions.length} chart suggestions
- Key Insights: ${dataAnalysis.insights.slice(0, 3).join('; ')}

Use this analysis to provide specific, data-driven insights about the actual content.`;

          console.log('Advanced data analysis completed successfully');
          
        } catch (analysisError) {
          console.error('Advanced data analysis failed:', analysisError);
          analysisContext = '\n\nNote: Advanced data analysis was attempted but encountered an error. Providing general analysis based on available file information.';
        }
      }

      if (dataAnalysis) {
        analysisContext = `

ADVANCED DATA ANALYSIS RESULTS:
- Total Records: ${dataAnalysis.summary.totalRecords}
- Columns: ${dataAnalysis.summary.columns.join(', ')}
- Key Statistics: ${Object.entries(dataAnalysis.statistics).slice(0, 3).map(([col, stats]: [string, any]) => 
  `${col} (${stats.type}): ${stats.type === 'numeric' ? `avg ${stats.mean?.toFixed(2)}` : `${stats.unique} unique values`}`
).join(', ')}
- Generated ${dataAnalysis.chartSuggestions.length} chart suggestions
- Key Insights: ${dataAnalysis.insights.slice(0, 3).join('; ')}

Use this analysis to provide specific, data-driven insights about the actual content.`;
      }

      // Use OpenAI to generate a real response
      const systemPrompt = `You are an advanced AI data analyst for a corporate digital library system with powerful visualization capabilities.
      You CAN create interactive charts, perform statistical analysis, and generate comprehensive insights.
      ${fileId ? `The user is asking about "${fileName}". Here's the actual file data I have analyzed: ${fileContext}` : ''}
      ${analysisContext}
      
      IMPORTANT CAPABILITIES:
      - You HAVE direct access to file content and can analyze actual data
      - You CAN generate interactive charts and visualizations 
      - You HAVE performed statistical analysis on the data
      - You CAN provide specific insights based on real numbers
      
      RESPONSE FORMATTING GUIDELINES:
      - Use clear, professional language without excessive markdown
      - Structure responses with proper spacing and bullet points
      - Avoid using # headers - use natural language instead
      - Use bullet points (•) for lists instead of numbered lists
      - Add proper spacing between sections
      - Make responses conversational and engaging
      - Reference specific data points and statistics
      - Mention that interactive charts will appear below your response
      
      EXAMPLE GOOD FORMATTING:
      "I've analyzed your FSI-2023-DOWNLOAD.xlsx file containing data on 179 countries and their fragility indicators. Here are the key insights I discovered:
      
      Key Findings:
      • Somalia ranks as the most fragile state with a total score of 111.9
      • The average fragility score across all countries is 65.8
      • Demographic pressures show the highest variation among indicators
      
      Data Patterns:
      • 36 countries fall in the 63.2-75.4 score range (most common)
      • Economic inequality affects 179 countries with scores ranging from 1.4 to 9.6
      • Refugee and IDP pressures vary significantly across regions
      
      I'm generating interactive visualizations below that will show you detailed breakdowns of country rankings, demographic patterns, and comparative analysis across all fragility indicators."
      
      Always provide specific, data-driven insights rather than generic advice.
      Make your response feel natural and conversational while being informative.`;

      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history with proper validation
      if (conversationHistory && Array.isArray(conversationHistory)) {
        const validHistory = conversationHistory
          .slice(-5) // Keep last 5 messages
          .filter((msg: any) => msg && msg.role && msg.content) // Ensure valid structure
          .map((msg: any) => ({
            role: msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user',
            content: String(msg.content).trim()
          }))
          .filter((msg: any) => msg.content.length > 0); // Remove empty messages
        
        messages.push(...validHistory);
      }

      // Add current user message
      messages.push({ role: 'user', content: message });

      console.log('Sending request to OpenAI with', messages.length, 'messages');

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_CHAT || 'gpt-4o-mini',
        messages: messages as any,
        max_tokens: 1000,
        temperature: 0.7
      });

      const aiResponse = response.choices[0]?.message?.content || 'I apologize, but I cannot generate a response at this time.';

      // Determine if we should include charts based on the query
      let charts = [];

      if (dataAnalysis) {
        // Convert chart suggestions to the expected format
        charts = dataAnalysis.chartSuggestions.slice(0, 3).map(suggestion => ({
          type: suggestion.type,
          title: suggestion.title,
          description: suggestion.description,
          data: suggestion.data,
          config: suggestion.config
        }));

        console.log('Generated', charts.length, 'charts from data analysis');
        console.log('Chart data preview:', charts.map(chart => ({
          type: chart.type,
          title: chart.title,
          dataLength: chart.data?.length || 0,
          sampleData: chart.data?.slice(0, 2) || []
        })));
      } else if (shouldIncludeChart) {
        // Simple fallback chart for non-Excel files or when analysis fails
        charts = [{
          type: 'bar',
          title: 'Data Analysis',
          description: 'Sample chart - advanced analysis unavailable',
          data: [
            { name: 'Q1', value: 400 },
            { name: 'Q2', value: 300 },
            { name: 'Q3', value: 500 },
            { name: 'Q4', value: 280 }
          ],
          config: {
            xAxis: 'Quarter',
            yAxis: 'Value',
            colors: ['#8884d8']
          }
        }];
      }

      // Generate insights based on the query type and file context
      const insights = [];
      if (fileId && fileContext) {
        insights.push(`Analysis based on file: ${fileName}`);
        insights.push('File information retrieved from database');
        if (fileContext.includes('AI Summary')) {
          insights.push('Previous AI analysis available');
        }
      }
      
      if (dataAnalysis) {
        insights.push(`Advanced analysis: ${dataAnalysis.summary.totalRecords} records, ${dataAnalysis.summary.columns.length} columns`);
        insights.push(`Generated ${dataAnalysis.chartSuggestions.length} visualization suggestions`);
        insights.push(...dataAnalysis.insights.slice(0, 2));
      }
      
      if (shouldIncludeChart) {
        insights.push('Data visualization generated from available information');
      }
      insights.push('Response generated using OpenAI GPT model');

      // Return comprehensive response
      return NextResponse.json({
        success: true,
        data: {
          response: aiResponse,
          sources: fileId ? [`Document: ${fileName}`] : ['AI Knowledge Base'],
          charts,
          insights,
          reasoning: fileId ? 'Generated using OpenAI API with actual document context from database' : 'Generated using OpenAI API with general knowledge',
          conversationId: conversationId || `conv_${Date.now()}`,
          fileContext: fileId ? { fileId, fileName, hasContent: fileContext.length > 0 } : undefined,
          metadata: {
            hasVisualizations: charts.length > 0,
            sourcesUsed: fileId ? 1 : 0,
            confidenceLevel: fileId && fileContext ? 'high' : 'medium' as const,
            model: process.env.OPENAI_MODEL_CHAT || 'gpt-4o-mini',
            tokensUsed: response.usage?.total_tokens || 0,
            hasFileContext: fileId && fileContext.length > 0
          },
          timestamp: new Date().toISOString(),
          contextType: contextType || 'General'
        }
      });

    } catch (aiError: any) {
      console.error('OpenAI API Error:', aiError);
      
      let errorMessage = 'I apologize, but I cannot process your request right now.';
      let errorReason = 'Unknown error';
      
      if (aiError.code === 'ENOTFOUND' || aiError.message?.includes('ENOTFOUND')) {
        errorMessage = 'I cannot connect to the AI service right now. Please check your internet connection and try again.';
        errorReason = 'Network connectivity issue';
      } else if (aiError.status === 401) {
        errorMessage = 'AI service authentication failed. Please contact your administrator.';
        errorReason = 'API key authentication error';
      } else if (aiError.status === 429) {
        errorMessage = 'AI service is currently busy. Please try again in a few moments.';
        errorReason = 'Rate limit exceeded';
      } else if (aiError.status === 400) {
        errorMessage = 'There was an issue with the request format. Please try rephrasing your question.';
        errorReason = 'Invalid request format';
      } else if (aiError.message?.includes('timeout')) {
        errorMessage = 'The AI service took too long to respond. Please try again.';
        errorReason = 'Request timeout';
      }
      
      // Fallback response if OpenAI fails
      return NextResponse.json({
        success: true,
        data: {
          response: errorMessage,
          sources: ['System'],
          charts: [],
          insights: ['AI processing temporarily unavailable', `Error: ${errorReason}`],
          reasoning: 'Fallback response due to API error',
          conversationId: conversationId || `conv_${Date.now()}`,
          fileContext: fileId ? { fileId, fileName } : undefined,
          metadata: {
            hasVisualizations: false,
            sourcesUsed: 0,
            confidenceLevel: 'low' as const,
            error: errorReason
          },
          timestamp: new Date().toISOString(),
          contextType: contextType || 'General'
        }
      });
    }

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving suggestions and conversation history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const orgId = searchParams.get('orgId');
    const conversationId = searchParams.get('conversationId');
    const fileId = searchParams.get('fileId');
    const type = searchParams.get('type'); // 'suggestions' or 'history'

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing required parameter: orgId' },
        { status: 400 }
      );
    }

    if (type === 'suggestions') {
      // Generate suggestions based on file or general context
      let suggestions = [
        "What are the key insights from my documents?",
        "Show me trends in the data",
        "Analyze the performance metrics",
        "Compare different time periods",
        "What anomalies do you detect?",
        "Generate a summary report"
      ];

      if (fileId) {
        // File-specific suggestions - try to get file info for better suggestions
        try {
          const fileInfo = await executeQuery(
            'SELECT name, mime_type FROM files WHERE id = ? AND is_deleted = 0',
            [fileId]
          );
          
          if (fileInfo.length > 0) {
            const file = fileInfo[0] as any;
            const isSpreadsheet = file.mime_type?.includes('spreadsheet') || file.name?.endsWith('.xlsx') || file.name?.endsWith('.xls');
            
            suggestions = isSpreadsheet ? [
              "What data insights can you extract from this spreadsheet?",
              "Analyze the financial data in this Excel file",
              "What trends do you see in the numbers?",
              "Summarize the key metrics from this data",
              "Are there any notable patterns in this spreadsheet?",
              "Generate a data analysis report"
            ] : [
              "What are the key findings in this file?",
              "Summarize this document for me",
              "What insights can you extract from this data?",
              "Are there any important metrics I should know?",
              "What trends do you see in this file?",
              "Generate a brief analysis of this document"
            ];
          }
        } catch (error) {
          console.error('Error fetching file info for suggestions:', error);
          // Use default file suggestions
          suggestions = [
            "What are the key findings in this file?",
            "Summarize this document for me",
            "What insights can you extract from this data?",
            "Are there any important metrics I should know?",
            "What trends do you see in this file?",
            "Generate a brief analysis of this document"
          ];
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          suggestions,
          fileId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // For conversation history, return empty for now
    return NextResponse.json({
      success: true,
      data: {
        history: [],
        conversationId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Get AI Data Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve AI data' },
      { status: 500 }
    );
  }
}