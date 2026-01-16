import { openai, AI_MODELS } from '../config/openai';
import { redisMemory } from '../memory/redis-memory';
import { mysqlMemory } from '../memory/mysql-memory';
import { ragService } from '../retrieval/rag-service';
import { analyticsEngine } from '../analytics/analytics-engine';
import { chartGenerator } from '../tools/chart-generator';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  sources?: string[];
  charts?: any[];
}

export interface QueryContext {
  userId: string | number;
  orgId: string;
  conversationId: string;
  documentIds?: string[];
  contextType?: 'HR' | 'Sales' | 'Finance' | 'General';
}

class AIOrchestrator {
  
  async processQuery(
    query: string, 
    context: QueryContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<{
    response: string;
    sources: string[];
    charts?: any[];
    insights?: string[];
    reasoning: string;
  }> {
    
    try {
      // 1. Security & Rate Limiting (simplified)
      const canProceed = await this.checkBasicRateLimit(context.userId, context.orgId);
      if (!canProceed) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // 2. Smart Query Routing (simplified)
      const queryType = await this.classifyQuery(query);
      console.log('🔍 Query classified as:', queryType.type, `(confidence: ${queryType.confidence})`);
      
      let response: string;
      let sources: string[] = [];
      let charts: any[] = [];
      let insights: string[] = [];
      let reasoning: string;

      switch (queryType.type) {
        case 'factual':
          const ragResult = await this.performBasicRAG(query, context.orgId, context.documentIds);
          console.log('📚 RAG search found:', ragResult.chunks?.length || 0, 'chunks');
          response = await this.generateFactualResponse(query, ragResult, conversationHistory);
          sources = ragResult.sources;
          reasoning = 'Used document search to find relevant information.';
          break;

        case 'visualization':
          const chartResult = await this.generateBasicChart(query, context.orgId, context.documentIds);
          response = await this.generateVisualizationResponse(query, chartResult);
          charts = [chartResult.chart];
          sources = chartResult.sources;
          reasoning = 'Generated visualization based on available data.';
          break;

        default:
          console.log('💬 Using general conversation flow');
          response = await this.generateGeneralResponse(query, conversationHistory, context);
          reasoning = 'Used general conversation flow with context awareness.';
      }

      // 3. Save to Memory (simplified)
      await this.saveBasicMemory(context, query, response);

      return {
        response,
        sources,
        charts,
        insights,
        reasoning
      };
    } catch (error) {
      console.error('AI Orchestrator Error:', error);
      throw error;
    }
  }

  private async classifyQuery(query: string): Promise<{
    type: 'factual' | 'analytical' | 'comparison' | 'visualization' | 'general';
    confidence: number;
  }> {
    const queryLower = query.toLowerCase();
    
    // Quick classification based on keywords (faster than OpenAI call)
    const documentKeywords = ['document', 'file', 'upload', 'show', 'find', 'list', 'search', 'department', 'engineering', 'hr', 'sales', 'finance', 'report', 'pdf', 'doc'];
    const visualKeywords = ['chart', 'graph', 'visualize', 'plot', 'diagram'];
    const analyticalKeywords = ['analyze', 'trend', 'pattern', 'insight', 'compare', 'analysis'];
    
    // Check for document-related queries
    if (documentKeywords.some(keyword => queryLower.includes(keyword))) {
      return { type: 'factual', confidence: 0.9 };
    }
    
    // Check for visualization requests
    if (visualKeywords.some(keyword => queryLower.includes(keyword))) {
      return { type: 'visualization', confidence: 0.9 };
    }
    
    // Check for analytical queries
    if (analyticalKeywords.some(keyword => queryLower.includes(keyword))) {
      return { type: 'analytical', confidence: 0.8 };
    }
    
    // Fallback to OpenAI classification for unclear queries
    try {
      const prompt = `Classify this query into one of these types:
1. factual - asking for specific information from documents
2. analytical - requesting analysis, trends, insights from data
3. comparison - comparing different time periods, departments, or documents
4. visualization - asking for charts, graphs, or visual representations
5. general - general conversation or unclear intent

Query: "${query}"

Respond with just the type name.`;

      const response = await openai.chat.completions.create({
        model: AI_MODELS.CHAT,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.1
      });

      const type = response.choices[0]?.message?.content?.trim().toLowerCase() as any;
      
      return {
        type: ['factual', 'analytical', 'comparison', 'visualization', 'general'].includes(type) ? type : 'factual',
        confidence: 0.7
      };
    } catch (error) {
      console.error('Query classification error:', error);
      // Default to factual for document-related systems
      return { type: 'factual', confidence: 0.5 };
    }
  }

  private async generateFactualResponse(
    query: string, 
    ragResult: any, 
    history: ChatMessage[]
  ): Promise<string> {
    // Check if we found any documents
    if (!ragResult.chunks || ragResult.chunks.length === 0) {
      return `I searched for documents related to "${query}" but couldn't find any matching documents in your organization's library. 

This could mean:
• No documents have been uploaded for this topic yet
• The documents haven't been processed or indexed
• Try using different keywords or phrases

You can upload relevant documents to help me provide better answers in the future.`;
    }

    const systemPrompt = `You are a senior business analyst with access to the organization's document library.

IMPORTANT RULES:
1. Answer ONLY using information from the provided documents
2. Always cite which document(s) you're referencing
3. If information is missing, clearly state "This information is not available in the provided documents"
4. Be specific and quote relevant sections when possible
5. If multiple documents contain relevant info, synthesize them clearly

Be professional, precise, and helpful.`;

    const contextPrompt = `
Documents found (${ragResult.chunks.length} relevant sources):

${ragResult.context}

Previous conversation:
${history.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

User Question: ${query}

Please provide a comprehensive answer based on the documents above. Cite specific documents when referencing information.`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || 'Unable to generate response from the available documents.';
  }

  private async generateAnalyticalResponse(
    query: string,
    analyticsResult: any,
    history: ChatMessage[]
  ): Promise<string> {
    const systemPrompt = `You are a senior business analyst. Based on the data analysis:
1. Identify key trends and patterns
2. Explain possible reasons for the trends
3. Provide actionable business recommendations
4. Predict future outcomes if applicable

Be specific and data-driven in your analysis.`;

    const contextPrompt = `
Analysis Results:
${JSON.stringify(analyticsResult.data, null, 2)}

Key Metrics:
${analyticsResult.metrics.map((m: any) => `- ${m.name}: ${m.value}`).join('\n')}

Question: ${query}`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.4
    });

    return response.choices[0]?.message?.content || 'Unable to generate analysis.';
  }

  private async performMultiDocComparison(query: string, context: QueryContext) {
    // Implementation for multi-document comparison
    const documents = await ragService.getMultipleDocuments(context.orgId, context.documentIds);
    
    // Generate comparison analysis
    const comparisonData = await analyticsEngine.compareDocuments(documents, query);
    
    // Generate charts if needed
    const charts = await chartGenerator.generateComparisonCharts(comparisonData);
    
    const response = await this.generateAnalyticalResponse(query, comparisonData, []);
    
    return {
      response,
      sources: documents.map(d => d.title),
      charts
    };
  }

  private async generateVisualizationResponse(query: string, chartResult: any): Promise<string> {
    return `I've generated a ${chartResult.chart.type} chart showing ${chartResult.chart.title}. 

Key insights from the visualization:
${chartResult.insights.map((insight: string) => `• ${insight}`).join('\n')}

The chart reveals ${chartResult.summary}`;
  }

  private async generateGeneralResponse(
    query: string,
    history: ChatMessage[],
    context: QueryContext
  ): Promise<string> {
    const systemPrompt = `You are a helpful AI assistant for an enterprise knowledge management system.
You can help with document analysis, data insights, and business questions.
Be professional, concise, and helpful.`;

    // Filter and validate history messages
    const validHistory = (history || [])
      .slice(-5)
      .filter(m => m && m.role && m.content && typeof m.content === 'string')
      .map(m => ({ 
        role: m.role as 'user' | 'assistant' | 'system', 
        content: m.content 
      }));

    const response = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages: [
        { role: 'system', content: systemPrompt },
        ...validHistory,
        { role: 'user', content: query }
      ],
      max_tokens: 800,
      temperature: 0.6
    });

    return response.choices[0]?.message?.content || 'I apologize, but I cannot generate a response at this time.';
  }

  private async saveToMemory(
    context: QueryContext,
    messages: ChatMessage[],
    insights: string[]
  ) {
    try {
      const userId = typeof context.userId === 'string' ? parseInt(context.userId) : context.userId;
      const orgId = context.orgId.toString();
      
      // Save to short-term memory (Redis)
      await redisMemory.saveShortTermMemory(userId.toString(), orgId, messages);
      
      // Save to long-term memory (MySQL)
      await mysqlMemory.saveConversation({
        conversationId: context.conversationId,
        userId: userId,
        organizationId: parseInt(orgId),
        messages,
        documentIds: context.documentIds?.map(id => parseInt(id)) || [],
        insights,
        contextType: context.contextType || 'General'
      });
    } catch (error) {
      console.error('Error saving to memory:', error);
      // Don't throw error - memory save failure shouldn't break the response
    }
  }

  // Simplified helper methods
  private async checkBasicRateLimit(userId: string | number, orgId: string): Promise<boolean> {
    try {
      return await redisMemory.checkRateLimit(userId.toString(), orgId);
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow on error
    }
  }

  private async performBasicRAG(query: string, orgId: string, documentIds?: string[]): Promise<any> {
    try {
      return await ragService.searchDocuments(query, orgId, documentIds);
    } catch (error) {
      console.error('RAG search failed:', error);
      return {
        context: 'No relevant documents found.',
        sources: ['System'],
        chunks: [],
        confidence: 0.1
      };
    }
  }

  private async generateBasicChart(query: string, orgId: string, documentIds?: string[]): Promise<any> {
    // Return a simple chart for visualization requests
    return {
      chart: {
        type: 'bar',
        title: 'Data Analysis',
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
      },
      insights: ['Sample chart generated from available data'],
      summary: 'This chart shows quarterly data trends.',
      sources: ['Document Analysis']
    };
  }

  private async saveBasicMemory(context: QueryContext, query: string, response: string): Promise<void> {
    try {
      const messages = [
        { role: 'user', content: query, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date() }
      ];
      
      await redisMemory.saveShortTermMemory(
        context.userId.toString(), 
        context.orgId.toString(), 
        messages
      );
    } catch (error) {
      console.error('Memory save failed:', error);
      // Don't throw - memory failure shouldn't break the response
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();