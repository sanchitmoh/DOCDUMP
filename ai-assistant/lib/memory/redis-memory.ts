import { getRedisInstance } from '@/lib/cache/redis';

class RedisMemory {
  private redis = getRedisInstance();

  // Short-term memory (conversation context)
  async saveShortTermMemory(userId: string, orgId: string, messages: any[]) {
    try {
      const key = `ai_short_memory:${orgId}:${userId}`;
      const data = {
        messages: messages.slice(-15), // Keep last 15 messages
        timestamp: Date.now()
      };
      
      await this.redis.setEx(key, 3600, JSON.stringify(data)); // 1 hour TTL
    } catch (error) {
      console.error('Redis short-term memory save error:', error);
    }
  }

  async getShortTermMemory(userId: string, orgId: string) {
    try {
      const key = `ai_short_memory:${orgId}:${userId}`;
      const data = await this.redis.get(key);
      
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return parsed.messages;
    } catch (error) {
      console.error('Redis short-term memory get error:', error);
      return null;
    }
  }

  // Cache embeddings to save costs (fallback to MySQL if Redis fails)
  async cacheEmbedding(text: string, embedding: number[]) {
    try {
      const key = `ai_embedding:${Buffer.from(text).toString('base64').substring(0, 100)}`;
      await this.redis.setEx(key, 86400, JSON.stringify(embedding)); // 24 hours
    } catch (error) {
      console.error('Redis embedding cache error:', error);
      // Fallback to MySQL handled in mysql-memory.ts
    }
  }

  async getCachedEmbedding(text: string): Promise<number[] | null> {
    try {
      const key = `ai_embedding:${Buffer.from(text).toString('base64').substring(0, 100)}`;
      const data = await this.redis.get(key);
      
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis embedding get error:', error);
      return null;
    }
  }

  // Rate limiting (fallback to MySQL if Redis fails)
  async checkRateLimit(userId: string, orgId: string): Promise<boolean> {
    try {
      const key = `ai_rate_limit:${orgId}:${userId}`;
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, 3600); // 1 hour window
      }
      
      const maxRequests = parseInt(process.env.AI_MAX_REQUESTS_PER_HOUR || '500');
      return current <= maxRequests;
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fallback to MySQL handled in mysql-memory.ts
      return true;
    }
  }

  // Cache analytics results
  async cacheAnalytics(key: string, data: any, ttlSeconds: number = 3600) {
    try {
      const cacheKey = `ai_analytics:${key}`;
      await this.redis.setEx(cacheKey, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Redis analytics cache error:', error);
    }
  }

  async getCachedAnalytics(key: string): Promise<any | null> {
    try {
      const cacheKey = `ai_analytics:${key}`;
      const data = await this.redis.get(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis analytics get error:', error);
      return null;
    }
  }

  // Session management
  async saveSession(sessionId: string, data: any, ttlSeconds: number = 7200) {
    try {
      const key = `ai_session:${sessionId}`;
      await this.redis.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Redis session save error:', error);
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const key = `ai_session:${sessionId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis session get error:', error);
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

export const redisMemory = new RedisMemory();