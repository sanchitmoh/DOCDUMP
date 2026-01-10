import { MongoClient, Db, Collection } from 'mongodb';

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
  documentId: string;
  orgId: string;
  title: string;
  summary: string;
  keyInsights: string[];
  embedding: number[];
  createdAt: Date;
}

class MongoMemory {
  private client: MongoClient;
  private db: Db;
  private conversations: Collection<LongTermMemory>;
  private summaries: Collection<DocumentSummary>;
  private connected = false;

  constructor() {
    this.client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant');
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.db = this.client.db('ai-assistant');
      this.conversations = this.db.collection('conversations');
      this.summaries = this.db.collection('document_summaries');
      
      // Create indexes for performance
      await this.conversations.createIndex({ userId: 1, orgId: 1 });
      await this.conversations.createIndex({ orgId: 1, updatedAt: -1 });
      await this.summaries.createIndex({ orgId: 1, documentId: 1 });
      
      this.connected = true;
    }
  }

  // Long-term conversation memory
  async saveLongTermMemory(
    userId: string, 
    orgId: string, 
    conversationId: string,
    messages: any[],
    documentIds: string[] = [],
    insights: string[] = []
  ) {
    await this.connect();
    
    const memory: LongTermMemory = {
      userId,
      orgId,
      conversationId,
      messages,
      documentIds,
      insights,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.conversations.updateOne(
      { userId, orgId, conversationId },
      { $set: memory },
      { upsert: true }
    );
  }

  async getLongTermMemory(userId: string, orgId: string, limit = 5) {
    await this.connect();
    
    return await this.conversations
      .find({ userId, orgId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  }

  // Document summaries for faster retrieval
  async saveDocumentSummary(
    documentId: string,
    orgId: string,
    title: string,
    summary: string,
    keyInsights: string[],
    embedding: number[]
  ) {
    await this.connect();
    
    const docSummary: DocumentSummary = {
      documentId,
      orgId,
      title,
      summary,
      keyInsights,
      embedding,
      createdAt: new Date()
    };

    await this.summaries.updateOne(
      { documentId, orgId },
      { $set: docSummary },
      { upsert: true }
    );
  }

  async getDocumentSummaries(orgId: string, documentIds?: string[]) {
    await this.connect();
    
    const filter: any = { orgId };
    if (documentIds?.length) {
      filter.documentId = { $in: documentIds };
    }

    return await this.summaries.find(filter).toArray();
  }

  // Find similar conversations for context
  async findSimilarConversations(orgId: string, keywords: string[], limit = 3) {
    await this.connect();
    
    const regex = new RegExp(keywords.join('|'), 'i');
    
    return await this.conversations
      .find({
        orgId,
        $or: [
          { 'messages.content': regex },
          { insights: regex }
        ]
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async disconnect() {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}

export const mongoMemory = new MongoMemory();