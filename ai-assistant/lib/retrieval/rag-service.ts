import { openai, AI_MODELS } from '../config/openai';
import { redisMemory } from '../memory/redis-memory';
import { mysqlMemory } from '../memory/mysql-memory';
import { executeQuery } from '@/lib/database';

interface DocumentChunk {
  id: string;
  content: string;
  type: 'text' | 'table' | 'summary';
  metadata: {
    documentId: string;
    title: string;
    page?: number;
    section?: string;
  };
  embedding?: number[];
  score?: number;
}

interface RAGResult {
  context: string;
  sources: string[];
  chunks: DocumentChunk[];
  confidence: number;
}

class RAGService {
  
  async searchDocuments(
    query: string, 
    orgId: string, 
    documentIds?: string[]
  ): Promise<RAGResult> {
    
    // 1. Generate query embedding
    const queryEmbedding = await this.getEmbedding(query);
    
    // 2. Multi-index retrieval
    const textChunks = await this.searchTextIndex(query, orgId, documentIds);
    const tableChunks = await this.searchTableIndex(query, orgId, documentIds);
    const summaryChunks = await this.searchSummaryIndex(queryEmbedding, orgId, documentIds);
    
    // 3. Combine and rank results
    const allChunks = [...textChunks, ...tableChunks, ...summaryChunks];
    const rankedChunks = this.rankChunks(allChunks, query);
    
    // 4. Select top chunks for context
    const topChunks = rankedChunks.slice(0, 8);
    
    // 5. Build context
    const context = this.buildContext(topChunks);
    const sources = [...new Set(topChunks.map(chunk => chunk.metadata.title))];
    
    return {
      context,
      sources,
      chunks: topChunks,
      confidence: this.calculateConfidence(topChunks)
    };
  }

  async getMultipleDocuments(orgId: string, documentIds?: string[]) {
    // Get document summaries from MySQL
    const summaries = await mysqlMemory.getDocumentSummaries(parseInt(orgId), 
      documentIds?.map(id => parseInt(id)));
    
    return summaries.map(summary => ({
      id: summary.documentId.toString(),
      title: summary.title,
      summary: summary.summary,
      keyInsights: summary.keyInsights,
      embedding: summary.embeddingVector
    }));
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // Check Redis cache first
    const cached = await redisMemory.getCachedEmbedding(text);
    if (cached) return cached;
    
    // Check MySQL cache as fallback
    const mysqlCached = await mysqlMemory.getCachedEmbedding(text);
    if (mysqlCached) {
      // Store in Redis for faster access
      await redisMemory.cacheEmbedding(text, mysqlCached);
      return mysqlCached;
    }
    
    // Generate new embedding
    const response = await openai.embeddings.create({
      model: AI_MODELS.EMBEDDING,
      input: text.substring(0, 8000), // Limit input length
    });
    
    const embedding = response.data[0].embedding;
    
    // Cache in both Redis and MySQL
    await redisMemory.cacheEmbedding(text, embedding);
    await mysqlMemory.setCachedEmbedding(text, embedding);
    
    return embedding;
  }

  private async searchTextIndex(
    query: string, 
    orgId: string, 
    documentIds?: string[]
  ): Promise<DocumentChunk[]> {
    try {
      // Extract keywords from query (remove common words)
      const stopWords = ['show', 'me', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'find', 'get', 'give', 'list', 'docs', 'documents', 'files', 'are', 'key', 'insights', 'insight', 'uploaded', 'my', 'your'];
      
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .filter(word => {
          // Remove punctuation
          const cleanWord = word.replace(/[^\w]/g, '');
          // Keep words > 2 chars OR important 2-char words like "hr", "it"
          const importantShortWords = ['hr', 'it', 'ai', 'qa', 'ui', 'ux'];
          return cleanWord.length > 0 && 
                 !stopWords.includes(cleanWord) && 
                 (cleanWord.length > 2 || importantShortWords.includes(cleanWord));
        })
        .map(word => word.replace(/[^\w]/g, '')); // Clean punctuation
      
      console.log('🔍 Query:', query);
      console.log('📌 Keywords extracted:', keywords.length > 0 ? keywords : 'none - will return all files');
      
      // Build search query with department filter
      const queryLower = query.toLowerCase();
      let searchQuery = `
        SELECT 
          f.id,
          f.name,
          f.department,
          f.ai_summary,
          f.ai_description,
          f.tags,
          etc.extracted_text,
          CASE 
            WHEN f.name LIKE ? THEN 3
            WHEN f.department LIKE ? THEN 3
            WHEN f.ai_summary LIKE ? THEN 2
            WHEN f.ai_description LIKE ? THEN 2
            WHEN etc.extracted_text LIKE ? THEN 1
            ELSE 0.5
          END as relevance_score
        FROM files f
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id
        WHERE f.organization_id = ? 
        AND f.is_deleted = 0
      `;
      
      // Use keywords for search pattern
      const searchPattern = keywords.length > 0 ? `%${keywords[0]}%` : `%${query}%`;
      const params: any[] = [
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, // CASE scores
        orgId // WHERE organization_id
      ];
      
      // Add keyword-based OR conditions
      if (keywords.length > 0) {
        const orConditions = keywords.map(() => 
          `(f.name LIKE ? OR f.ai_summary LIKE ? OR f.ai_description LIKE ? OR f.department LIKE ? OR f.tags LIKE ? OR etc.extracted_text LIKE ?)`
        ).join(' OR ');
        
        searchQuery += ` AND (${orConditions})`;
        
        keywords.forEach(keyword => {
          const keywordPattern = `%${keyword}%`;
          params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern);
        });
      } else {
        // If no keywords, return all files (generic query like "show me my files")
        console.log('⚠️ No keywords found, returning all files for organization');
        // No additional WHERE clause needed - will return all files for the org
      }
      
      // Add department filter if query mentions a department
      if (queryLower.includes('engineering') || queryLower.includes('engineer') || queryLower.includes('enginering')) {
        searchQuery += ` AND (f.department LIKE '%engineering%' OR f.department LIKE '%engineer%' OR f.department LIKE '%enginering%')`;
      } else if (queryLower.includes('sales')) {
        searchQuery += ` AND f.department LIKE '%sales%'`;
      } else if (queryLower.includes('marketing')) {
        searchQuery += ` AND f.department LIKE '%marketing%'`;
      } else if (queryLower.includes('hr') || queryLower.includes('human resource')) {
        searchQuery += ` AND (f.department LIKE '%hr%' OR f.department LIKE '%human%')`;
      } else if (queryLower.includes('finance') || queryLower.includes('accounting')) {
        searchQuery += ` AND (f.department LIKE '%finance%' OR f.department LIKE '%accounting%')`;
      }
      
      if (documentIds && documentIds.length > 0) {
        searchQuery += ` AND f.id IN (${documentIds.map(() => '?').join(',')})`;
        params.push(...documentIds);
      }
      
      searchQuery += ` ORDER BY relevance_score DESC, f.created_at DESC LIMIT 10`;
      
      const rows = await executeQuery(searchQuery, params);
      
      return (rows as any[]).map((row, index) => {
        // Build content from available fields
        let content = '';
        
        // Add extracted text if available
        if (row.extracted_text) {
          content += row.extracted_text;
        }
        
        // Add AI summary if available
        if (row.ai_summary && row.ai_summary !== `AI-generated summary for ${row.name}. This document contains important information that has been analyzed by our AI system.`) {
          content += '\n\nSummary: ' + row.ai_summary;
        }
        
        // Add AI description if available
        if (row.ai_description) {
          content += '\n\nDescription: ' + row.ai_description;
        }
        
        // Add AI insights if available (parse JSON)
        if (row.ai_insights) {
          try {
            const insights = typeof row.ai_insights === 'string' ? JSON.parse(row.ai_insights) : row.ai_insights;
            if (Array.isArray(insights) && insights.length > 0 && insights[0] !== 'This document contains structured data') {
              content += '\n\nKey Insights:\n' + insights.map((i: string) => `• ${i}`).join('\n');
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        // If no content, use file name and metadata
        if (!content.trim()) {
          content = `File: ${row.name}\nDepartment: ${row.department || 'Not specified'}\nType: Excel spreadsheet\n\nNote: This file has not been fully processed yet. The actual content is not available for analysis.`;
        }
        
        const snippet = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
        
        return {
          id: `text_${row.id}`,
          content: snippet,
          type: 'text' as const,
          metadata: {
            documentId: row.id.toString(),
            title: row.name,
            section: row.department || 'General'
          },
          score: row.relevance_score || 0.5
        };
      });
    } catch (error) {
      console.error('❌ Text search error:', error);
      return [];
    }
  }

  private async searchTableIndex(
    query: string, 
    orgId: string, 
    documentIds?: string[]
  ): Promise<DocumentChunk[]> {
    try {
      // Search for files with structured data (Excel, CSV)
      let searchQuery = `
        SELECT 
          f.id,
          f.name,
          f.ai_insights,
          f.ai_data_type
        FROM files f
        WHERE f.organization_id = ? 
        AND f.is_deleted = 0 
        AND f.ai_processed = 1
        AND f.ai_data_type IN ('sales', 'financial', 'hr', 'operational')
        AND (f.mime_type LIKE '%spreadsheet%' OR f.mime_type LIKE '%csv%')
      `;
      
      const params: any[] = [orgId];
      
      if (documentIds && documentIds.length > 0) {
        searchQuery += ` AND f.id IN (${documentIds.map(() => '?').join(',')})`;
        params.push(...documentIds);
      }
      
      searchQuery += ` ORDER BY f.ai_processed_at DESC LIMIT 5`;
      
      const rows = await executeQuery(searchQuery, params);
      
      return (rows as any[]).map((row, index) => ({
        id: `table_${row.id}`,
        content: JSON.stringify({
          dataType: row.ai_data_type,
          insights: JSON.parse(row.ai_insights || '[]'),
          summary: `Structured data file: ${row.name}`
        }),
        type: 'table' as const,
        metadata: {
          documentId: row.id.toString(),
          title: row.name,
          section: 'Data Analysis'
        },
        score: 0.8
      }));
    } catch (error) {
      console.error('Table search error:', error);
      return [];
    }
  }

  private async searchSummaryIndex(
    queryEmbedding: number[], 
    orgId: string, 
    documentIds?: string[]
  ): Promise<DocumentChunk[]> {
    try {
      // Get document summaries from MySQL
      const summaries = await mysqlMemory.getDocumentSummaries(
        parseInt(orgId), 
        documentIds?.map(id => parseInt(id))
      );
      
      return summaries.map(summary => ({
        id: `summary_${summary.documentId}`,
        content: summary.summary,
        type: 'summary' as const,
        metadata: {
          documentId: summary.documentId.toString(),
          title: summary.title
        },
        embedding: summary.embeddingVector,
        score: summary.embeddingVector.length > 0 ? 
          this.cosineSimilarity(queryEmbedding, summary.embeddingVector) : 0.5
      })).filter(chunk => chunk.score > 0.3);
    } catch (error) {
      console.error('Summary search error:', error);
      return [];
    }
  }

  private rankChunks(chunks: DocumentChunk[], query: string): DocumentChunk[] {
    // Advanced ranking algorithm
    return chunks
      .map(chunk => ({
        ...chunk,
        finalScore: this.calculateFinalScore(chunk, query)
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  private calculateFinalScore(chunk: DocumentChunk, query: string): number {
    let score = chunk.score || 0;
    
    // Boost based on chunk type
    if (chunk.type === 'table') score *= 1.2; // Tables often contain key data
    if (chunk.type === 'summary') score *= 1.1; // Summaries provide good context
    
    // Boost based on keyword matches
    const queryWords = query.toLowerCase().split(' ');
    const contentWords = chunk.content.toLowerCase();
    const keywordMatches = queryWords.filter(word => contentWords.includes(word)).length;
    score += (keywordMatches / queryWords.length) * 0.3;
    
    return score;
  }

  private buildContext(chunks: DocumentChunk[]): string {
    let context = '';
    
    chunks.forEach((chunk, index) => {
      context += `\n--- Source ${index + 1}: ${chunk.metadata.title} ---\n`;
      
      if (chunk.type === 'table') {
        // Format table data nicely
        try {
          const tableData = JSON.parse(chunk.content);
          context += this.formatTableForContext(tableData);
        } catch {
          context += chunk.content;
        }
      } else {
        context += chunk.content;
      }
      
      context += '\n';
    });
    
    return context;
  }

  private formatTableForContext(tableData: any): string {
    if (tableData.dataType && tableData.insights) {
      return `Data Type: ${tableData.dataType}\nKey Insights: ${tableData.insights.join(', ')}\nSummary: ${tableData.summary}`;
    }
    
    if (!tableData.headers || !tableData.rows) return JSON.stringify(tableData);
    
    let formatted = `Table: ${tableData.headers.join(' | ')}\n`;
    tableData.rows.slice(0, 5).forEach((row: any[]) => {
      formatted += `${row.join(' | ')}\n`;
    });
    
    return formatted;
  }

  private calculateConfidence(chunks: DocumentChunk[]): number {
    if (chunks.length === 0) return 0;
    
    const avgScore = chunks.reduce((sum, chunk) => sum + (chunk.score || 0), 0) / chunks.length;
    const sourceCount = new Set(chunks.map(c => c.metadata.documentId)).size;
    
    // Higher confidence with better scores and more diverse sources
    return Math.min(avgScore + (sourceCount * 0.1), 1.0);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // Pre-process and store document summaries
  async processAndStoreDocument(
    documentId: string,
    orgId: string,
    title: string,
    content: string
  ) {
    try {
      // 1. Generate summary
      const summary = await this.generateDocumentSummary(content);
      
      // 2. Extract key insights
      const insights = await this.extractKeyInsights(content);
      
      // 3. Generate embedding for summary
      const embedding = await this.getEmbedding(summary);
      
      // 4. Detect data type
      const dataType = this.detectDataType(content, title);
      
      // 5. Store in MySQL
      await mysqlMemory.saveDocumentSummary({
        documentId: parseInt(documentId),
        organizationId: parseInt(orgId),
        title,
        summary,
        keyInsights: insights,
        embeddingVector: embedding,
        dataType,
        metrics: {},
        trends: [],
        anomalies: []
      });
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  private detectDataType(content: string, title: string): 'sales' | 'financial' | 'hr' | 'operational' | 'mixed' {
    const text = (content + ' ' + title).toLowerCase();
    
    if (text.includes('revenue') || text.includes('sales') || text.includes('profit')) {
      return 'sales';
    }
    if (text.includes('expense') || text.includes('cost') || text.includes('budget')) {
      return 'financial';
    }
    if (text.includes('employee') || text.includes('salary') || text.includes('department')) {
      return 'hr';
    }
    if (text.includes('operation') || text.includes('production') || text.includes('inventory')) {
      return 'operational';
    }
    
    return 'mixed';
  }

  private async generateDocumentSummary(content: string): Promise<string> {
    const prompt = `Summarize this document in 2-3 paragraphs, focusing on:
1. Main purpose and key topics
2. Important data points and findings
3. Key conclusions or recommendations

Document content:
${content.substring(0, 4000)}`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.SUMMARY,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || 'Summary not available.';
  }

  private async extractKeyInsights(content: string): Promise<string[]> {
    const prompt = `Extract 5-7 key insights from this document. Focus on:
- Important metrics and numbers
- Trends and patterns
- Key decisions or recommendations
- Notable findings

Return as a simple list.

Document content:
${content.substring(0, 4000)}`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.SUMMARY,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.3
    });

    const content_text = response.choices[0]?.message?.content || '';
    return content_text.split('\n').filter(line => line.trim().length > 0);
  }
}

export const ragService = new RAGService();