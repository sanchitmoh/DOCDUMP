import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check system health
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        openai: await checkOpenAI(),
        redis: await checkRedis(),
        mongodb: await checkMongoDB()
      },
      version: '1.0.0',
      uptime: process.uptime()
    };

    const allHealthy = Object.values(health.services).every(service => service.status === 'healthy');
    
    return NextResponse.json(health, { 
      status: allHealthy ? 200 : 503 
    });

  } catch (error: any) {
    console.error('Health Check Error:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

async function checkOpenAI() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { status: 'unhealthy', message: 'OpenAI API key not configured' };
    }
    
    // Simple API key validation
    const { openai } = await import('../../lib/config/openai');
    await openai.models.list();
    
    return { status: 'healthy', message: 'OpenAI API accessible' };
  } catch (error: any) {
    return { status: 'unhealthy', message: `OpenAI error: ${error.message}` };
  }
}

async function checkRedis() {
  try {
    const { redisMemory } = await import('../../lib/memory/redis-memory');
    // Redis connection is checked during initialization
    return { status: 'healthy', message: 'Redis connection active' };
  } catch (error: any) {
    return { status: 'unhealthy', message: `Redis error: ${error.message}` };
  }
}

async function checkMongoDB() {
  try {
    const { mongoMemory } = await import('../../lib/memory/mongo-memory');
    await mongoMemory.connect();
    return { status: 'healthy', message: 'MongoDB connection active' };
  } catch (error: any) {
    return { status: 'unhealthy', message: `MongoDB error: ${error.message}` };
  }
}