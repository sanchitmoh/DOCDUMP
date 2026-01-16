import { executeQuery, executeSingle } from '@/lib/database';

interface LongTermMemory {
  userId: string;
  orgId: string;
  conversationId: string;
  messages: any[];
  documentIds: string[];
  insights: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentSummary {
  documentId: number;
  organizationId: number;
  title: string;
  summary: string;
  keyInsights: string[];
  embeddingVector: number[];
  dataType: string;
  metrics: any;
  trends: any[];
  anomalies: any[];
}

class MySQLMemory {
  // Long-term conversation memory
  async saveLongTermMemory(
    userId: string, 
    orgId: string, 
    conversationId: string,
    messages: any[],
    documentIds: string[] = [],
    insights: string[] = []
  ) {
    try {
      await executeSingle(`
        INSERT INTO ai_conversations (
          user_id, organization_id, conversation_id, 
          messages, document_ids, insights, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          messages = VALUES(messages),
          document_ids = VALUES(document_ids),
          insights = VALUES(insights),
          updated_at = NOW()
      `, [
        userId,
        orgId,
        conversationId,
        JSON.stringify(messages),
        JSON.stringify(documentIds),
        JSON.stringify(insights)
      ]);
    } catch (error) {
      console.error('Error saving long-term memory:', error);
      // Don't throw - memory save failure shouldn't break the app
    }
  }

  async getLongTermMemory(userId: string, orgId: string, limit = 5): Promise<any[]> {
    try {
      const rows = await executeQuery(`
        SELECT 
          conversation_id as conversationId,
          messages,
          document_ids as documentIds,
          insights,
          created_at as createdAt,
          updated_at as updatedAt
        FROM ai_conversations
        WHERE user_id = ? AND organization_id = ?
        ORDER BY updated_at DESC
        LIMIT ?
      `, [userId, orgId, limit]);

      return (rows as any[]).map(row => ({
        ...row,
        messages: JSON.parse(row.messages || '[]'),
        documentIds: JSON.parse(row.documentIds || '[]'),
        insights: JSON.parse(row.insights || '[]')
      }));
    } catch (error) {
      console.error('Error getting long-term memory:', error);
      return [];
    }
  }

  // Document summaries for faster retrieval
  async saveDocumentSummary(summary: DocumentSummary) {
    try {
      await executeSingle(`
        INSERT INTO ai_document_summaries (
          document_id, organization_id, title, summary,
          key_insights, embedding_vector, data_type,
          metrics, trends, anomalies, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          summary = VALUES(summary),
          key_insights = VALUES(key_insights),
          embedding_vector = VALUES(embedding_vector),
          data_type = VALUES(data_type),
          metrics = VALUES(metrics),
          trends = VALUES(trends),
          anomalies = VALUES(anomalies)
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

  async getDocumentSummaries(orgId: number, documentIds?: number[]): Promise<DocumentSummary[]> {
    try {
      let query = `
        SELECT 
          document_id as documentId,
          organization_id as organizationId,
          title,
          summary,
          key_insights as keyInsights,
          embedding_vector as embeddingVector,
          data_type as dataType,
          metrics,
          trends,
          anomalies
        FROM ai_document_summaries
        WHERE organization_id = ?
      `;
      
      const params: any[] = [orgId];
      
      if (documentIds && documentIds.length > 0) {
        query += ` AND document_id IN (${documentIds.map(() => '?').join(',')})`;
        params.push(...documentIds);
      }

      const rows = await executeQuery(query, params);

      return (rows as any[]).map(row => ({
        documentId: row.documentId,
        organizationId: row.organizationId,
        title: row.title,
        summary: row.summary,
        keyInsights: JSON.parse(row.keyInsights || '[]'),
        embeddingVector: JSON.parse(row.embeddingVector || '[]'),
        dataType: row.dataType,
        metrics: JSON.parse(row.metrics || '{}'),
        trends: JSON.parse(row.trends || '[]'),
        anomalies: JSON.parse(row.anomalies || '[]')
      }));
    } catch (error) {
      console.error('Error getting document summaries:', error);
      return [];
    }
  }

  // Find similar conversations for context
  async findSimilarConversations(orgId: string, keywords: string[], limit = 3): Promise<any[]> {
    try {
      const searchPattern = `%${keywords.join('%')}%`;
      
      const rows = await executeQuery(`
        SELECT 
          conversation_id as conversationId,
          messages,
          insights,
          updated_at as updatedAt
        FROM ai_conversations
        WHERE organization_id = ?
          AND (messages LIKE ? OR insights LIKE ?)
        ORDER BY updated_at DESC
        LIMIT ?
      `, [orgId, searchPattern, searchPattern, limit]);

      return (rows as any[]).map(row => ({
        ...row,
        messages: JSON.parse(row.messages || '[]'),
        insights: JSON.parse(row.insights || '[]')
      }));
    } catch (error) {
      console.error('Error finding similar conversations:', error);
      return [];
    }
  }

  // Cached embeddings
  async getCachedEmbedding(text: string): Promise<number[] | null> {
    try {
      const rows = await executeQuery(`
        SELECT embedding_vector
        FROM ai_embedding_cache
        WHERE text_hash = MD5(?)
        AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
        LIMIT 1
      `, [text]);

      if (rows.length > 0) {
        const embeddingData = (rows as any)[0].embedding_vector;
        // Handle both string and already-parsed array
        if (typeof embeddingData === 'string') {
          return JSON.parse(embeddingData);
        } else if (Array.isArray(embeddingData)) {
          return embeddingData;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting cached embedding:', error);
      return null;
    }
  }

  async setCachedEmbedding(text: string, embedding: number[]): Promise<void> {
    try {
      await executeSingle(`
        INSERT INTO ai_embedding_cache (text_hash, embedding_vector, created_at)
        VALUES (MD5(?), ?, NOW())
        ON DUPLICATE KEY UPDATE
          embedding_vector = VALUES(embedding_vector),
          created_at = NOW()
      `, [text, JSON.stringify(embedding)]);
    } catch (error) {
      console.error('Error caching embedding:', error);
      // Don't throw - cache failure shouldn't break the app
    }
  }
}

export const mysqlMemory = new MySQLMemory();
// Export as mongoMemory for backward compatibility
export const mongoMemory = mysqlMemory;