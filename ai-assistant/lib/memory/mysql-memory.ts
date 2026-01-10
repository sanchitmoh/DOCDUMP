import { executeQuery, executeSingle } from '@/lib/database';

interface ConversationMemory {
  conversationId: string;
  userId: number;
  organizationId: number;
  messages: any[];
  documentIds: number[];
  insights: string[];
  contextType: 'HR' | 'Sales' | 'Finance' | 'General';
}

interface DocumentSummary {
  documentId: number;
  organizationId: number;
  title: string;
  summary: string;
  keyInsights: string[];
  embeddingVector: number[];
  dataType: 'sales' | 'financial' | 'hr' | 'operational' | 'mixed';
  metrics: any;
  trends: any;
  anomalies: any;
}

interface AnalyticsCache {
  cacheKey: string;
  organizationId: number;
  queryHash: string;
  resultData: any;
  expiresAt: Date;
}

class MySQLMemory {
  
  // Conversation Memory Management
  async saveConversation(memory: ConversationMemory): Promise<void> {
    try {
      await executeSingle(`
        INSERT INTO ai_conversations (
          conversation_id, user_id, organization_id, messages, 
          document_ids, insights, context_type, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          messages = VALUES(messages),
          document_ids = VALUES(document_ids),
          insights = VALUES(insights),
          context_type = VALUES(context_type),
          updated_at = NOW()
      `, [
        memory.conversationId,
        memory.userId,
        memory.organizationId,
        JSON.stringify(memory.messages),
        JSON.stringify(memory.documentIds),
        JSON.stringify(memory.insights),
        memory.contextType
      ]);
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  async getConversationHistory(
    userId: number, 
    organizationId: number, 
    limit: number = 5
  ): Promise<ConversationMemory[]> {
    try {
      const rows = await executeQuery(`
        SELECT 
          conversation_id,
          user_id,
          organization_id,
          messages,
          document_ids,
          insights,
          context_type,
          updated_at
        FROM ai_conversations 
        WHERE user_id = ? AND organization_id = ?
        ORDER BY updated_at DESC 
        LIMIT ?
      `, [userId, organizationId, limit]);

      return (rows as any[]).map(row => ({
        conversationId: row.conversation_id,
        userId: row.user_id,
        organizationId: row.organization_id,
        messages: JSON.parse(row.messages || '[]'),
        documentIds: JSON.parse(row.document_ids || '[]'),
        insights: JSON.parse(row.insights || '[]'),
        contextType: row.context_type
      }));
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  async getConversationById(conversationId: string): Promise<ConversationMemory | null> {
    try {
      const rows = await executeQuery(`
        SELECT 
          conversation_id,
          user_id,
          organization_id,
          messages,
          document_ids,
          insights,
          context_type
        FROM ai_conversations 
        WHERE conversation_id = ?
      `, [conversationId]);

      if (rows.length === 0) return null;

      const row = (rows as any[])[0];
      return {
        conversationId: row.conversation_id,
        userId: row.user_id,
        organizationId: row.organization_id,
        messages: JSON.parse(row.messages || '[]'),
        documentIds: JSON.parse(row.document_ids || '[]'),
        insights: JSON.parse(row.insights || '[]'),
        contextType: row.context_type
      };
    } catch (error) {
      console.error('Error getting conversation by ID:', error);
      return null;
    }
  }

  // Document Summary Management
  async saveDocumentSummary(summary: DocumentSummary): Promise<void> {
    try {
      await executeSingle(`
        INSERT INTO ai_document_summaries (
          document_id, organization_id, title, summary, key_insights,
          embedding_vector, data_type, metrics, trends, anomalies, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          summary = VALUES(summary),
          key_insights = VALUES(key_insights),
          embedding_vector = VALUES(embedding_vector),
          data_type = VALUES(data_type),
          metrics = VALUES(metrics),
          trends = VALUES(trends),
          anomalies = VALUES(anomalies),
          updated_at = NOW()
      `, [
        summary.documentId,
        summary.organizationId,
        summary.title,
        summary.summary,
        JSON.stringify(summary.keyInsights),
        JSON.stringify(summary.embeddingVector),
        summary.dataType,
        JSON.stringify(summary.metrics),
        JSON.stringify(summary.trends),
        JSON.stringify(summary.anomalies)
      ]);
    } catch (error) {
      console.error('Error saving document summary:', error);
      throw error;
    }
  }

  async getDocumentSummaries(
    organizationId: number, 
    documentIds?: number[]
  ): Promise<DocumentSummary[]> {
    try {
      let query = `
        SELECT 
          document_id,
          organization_id,
          title,
          summary,
          key_insights,
          embedding_vector,
          data_type,
          metrics,
          trends,
          anomalies,
          created_at
        FROM ai_document_summaries 
        WHERE organization_id = ?
      `;
      
      const params: any[] = [organizationId];
      
      if (documentIds && documentIds.length > 0) {
        query += ` AND document_id IN (${documentIds.map(() => '?').join(',')})`;
        params.push(...documentIds);
      }
      
      query += ` ORDER BY created_at DESC`;

      const rows = await executeQuery(query, params);

      return (rows as any[]).map(row => ({
        documentId: row.document_id,
        organizationId: row.organization_id,
        title: row.title,
        summary: row.summary,
        keyInsights: JSON.parse(row.key_insights || '[]'),
        embeddingVector: JSON.parse(row.embedding_vector || '[]'),
        dataType: row.data_type,
        metrics: JSON.parse(row.metrics || '{}'),
        trends: JSON.parse(row.trends || '[]'),
        anomalies: JSON.parse(row.anomalies || '[]')
      }));
    } catch (error) {
      console.error('Error getting document summaries:', error);
      return [];
    }
  }

  // Analytics Cache Management
  async getCachedAnalytics(cacheKey: string, organizationId: number): Promise<any | null> {
    try {
      const rows = await executeQuery(`
        SELECT result_data 
        FROM ai_analytics_cache 
        WHERE cache_key = ? AND organization_id = ? AND expires_at > NOW()
      `, [cacheKey, organizationId]);

      if (rows.length === 0) return null;

      return JSON.parse((rows as any[])[0].result_data);
    } catch (error) {
      console.error('Error getting cached analytics:', error);
      return null;
    }
  }

  async setCachedAnalytics(
    cacheKey: string, 
    organizationId: number, 
    data: any, 
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const queryHash = require('crypto').createHash('sha256').update(cacheKey).digest('hex');

      await executeSingle(`
        INSERT INTO ai_analytics_cache (
          cache_key, organization_id, query_hash, result_data, expires_at
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          result_data = VALUES(result_data),
          expires_at = VALUES(expires_at)
      `, [cacheKey, organizationId, queryHash, JSON.stringify(data), expiresAt]);
    } catch (error) {
      console.error('Error setting cached analytics:', error);
    }
  }

  // Embedding Cache Management
  async getCachedEmbedding(text: string, modelName: string = 'text-embedding-3-large'): Promise<number[] | null> {
    try {
      const textHash = require('crypto').createHash('sha256').update(text).digest('hex');
      
      const rows = await executeQuery(`
        SELECT embedding_vector 
        FROM ai_embeddings_cache 
        WHERE text_hash = ? AND model_name = ? AND expires_at > NOW()
      `, [textHash, modelName]);

      if (rows.length === 0) return null;

      return JSON.parse((rows as any[])[0].embedding_vector);
    } catch (error) {
      console.error('Error getting cached embedding:', error);
      return null;
    }
  }

  async setCachedEmbedding(
    text: string, 
    embedding: number[], 
    modelName: string = 'text-embedding-3-large',
    ttlSeconds: number = 86400 // 24 hours
  ): Promise<void> {
    try {
      const textHash = require('crypto').createHash('sha256').update(text).digest('hex');
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await executeSingle(`
        INSERT INTO ai_embeddings_cache (
          text_hash, embedding_vector, model_name, expires_at
        ) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          embedding_vector = VALUES(embedding_vector),
          expires_at = VALUES(expires_at)
      `, [textHash, JSON.stringify(embedding), modelName, expiresAt]);
    } catch (error) {
      console.error('Error setting cached embedding:', error);
    }
  }

  // Rate Limiting
  async checkRateLimit(
    userId: number, 
    organizationId: number, 
    maxRequests: number = 500,
    windowMinutes: number = 60
  ): Promise<boolean> {
    try {
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);
      const windowEnd = new Date();

      // Clean up old rate limit records
      await executeSingle(`
        DELETE FROM ai_rate_limits 
        WHERE window_end < DATE_SUB(NOW(), INTERVAL 1 DAY)
      `);

      // Get or create current window record
      const rows = await executeQuery(`
        SELECT request_count 
        FROM ai_rate_limits 
        WHERE user_id = ? AND organization_id = ? 
        AND window_start <= NOW() AND window_end > NOW()
      `, [userId, organizationId]);

      if (rows.length === 0) {
        // Create new window
        await executeSingle(`
          INSERT INTO ai_rate_limits (
            user_id, organization_id, request_count, window_start, window_end
          ) VALUES (?, ?, 1, ?, ?)
        `, [userId, organizationId, windowStart, windowEnd]);
        return true;
      } else {
        const currentCount = (rows as any[])[0].request_count;
        
        if (currentCount >= maxRequests) {
          return false;
        }

        // Increment counter
        await executeSingle(`
          UPDATE ai_rate_limits 
          SET request_count = request_count + 1 
          WHERE user_id = ? AND organization_id = ? 
          AND window_start <= NOW() AND window_end > NOW()
        `, [userId, organizationId]);
        
        return true;
      }
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return true; // Allow on error
    }
  }

  // Search similar conversations
  async findSimilarConversations(
    organizationId: number, 
    keywords: string[], 
    limit: number = 3
  ): Promise<ConversationMemory[]> {
    try {
      if (keywords.length === 0) return [];

      // Create MATCH query for fulltext search on messages
      const searchTerms = keywords.join(' ');
      
      const rows = await executeQuery(`
        SELECT 
          conversation_id,
          user_id,
          organization_id,
          messages,
          document_ids,
          insights,
          context_type,
          updated_at
        FROM ai_conversations 
        WHERE organization_id = ? 
        AND (
          JSON_SEARCH(messages, 'one', ?) IS NOT NULL
          OR JSON_SEARCH(insights, 'one', ?) IS NOT NULL
        )
        ORDER BY updated_at DESC 
        LIMIT ?
      `, [organizationId, `%${searchTerms}%`, `%${searchTerms}%`, limit]);

      return (rows as any[]).map(row => ({
        conversationId: row.conversation_id,
        userId: row.user_id,
        organizationId: row.organization_id,
        messages: JSON.parse(row.messages || '[]'),
        documentIds: JSON.parse(row.document_ids || '[]'),
        insights: JSON.parse(row.insights || '[]'),
        contextType: row.context_type
      }));
    } catch (error) {
      console.error('Error finding similar conversations:', error);
      return [];
    }
  }

  // Cleanup expired records
  async cleanupExpiredRecords(): Promise<void> {
    try {
      await executeSingle(`DELETE FROM ai_analytics_cache WHERE expires_at < NOW()`);
      await executeSingle(`DELETE FROM ai_embeddings_cache WHERE expires_at < NOW()`);
      await executeSingle(`DELETE FROM ai_rate_limits WHERE window_end < DATE_SUB(NOW(), INTERVAL 1 DAY)`);
    } catch (error) {
      console.error('Error cleaning up expired records:', error);
    }
  }
}

export const mysqlMemory = new MySQLMemory();