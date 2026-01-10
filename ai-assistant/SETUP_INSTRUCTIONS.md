# Enterprise AI Assistant Setup Instructions

## 🚀 Complete Setup Guide

### Prerequisites
- Node.js 18+ 
- Docker (for Redis & MongoDB)
- OpenAI API Key
- Your existing CDL application

### Step 1: Environment Configuration

1. Copy environment file:
```bash
cp .env.example .env
```

2. Configure your `.env` file:
```env
# OpenAI Configuration - REQUIRED
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL_CHAT=gpt-4o-mini
OPENAI_MODEL_EMBEDDING=text-embedding-3-large

# Redis Configuration
REDIS_URL=redis://localhost:6379

# MongoDB Configuration  
MONGODB_URI=mongodb://localhost:27017/ai-assistant

# Security
JWT_SECRET=your-super-secret-jwt-key-here

# Cost Optimization
MAX_TOKENS_PER_REQUEST=4000
MAX_REQUESTS_PER_HOUR=100
```

### Step 2: Install Dependencies

```bash
cd ai-assistant
npm install
```

### Step 3: Start Required Services

#### Option A: Using Docker (Recommended)
```bash
# Start Redis
docker run -d --name ai-redis -p 6379:6379 redis:alpine

# Start MongoDB
docker run -d --name ai-mongo -p 27017:27017 mongo:latest
```

#### Option B: Using Docker Compose
Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

Run: `docker-compose up -d`

### Step 4: Test the System

1. **Health Check:**
```bash
curl http://localhost:3001/ai-assistant/api/health
```

2. **Test Chat API:**
```bash
curl -X POST http://localhost:3001/ai-assistant/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Analyze sales trends for Q3",
    "userId": "test-user",
    "orgId": "test-org"
  }'
```

### Step 5: Integration with Your Existing App

#### Add to your existing `package.json`:
```json
{
  "dependencies": {
    "openai": "^4.20.0",
    "redis": "^4.6.0", 
    "mongodb": "^6.3.0",
    "recharts": "^2.8.0"
  }
}
```

#### Update your existing API routes:

1. **Modify your existing chat API** (`app/api/ai-chat/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, orgId } = body;

    // Check if this should use advanced AI
    if (shouldUseAdvancedAI(message)) {
      // Forward to advanced AI assistant
      const aiResponse = await fetch('http://localhost:3001/ai-assistant/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userId,
          orgId,
          conversationId: `conv_${Date.now()}`,
          contextType: 'General'
        })
      });
      
      return aiResponse;
    }

    // Your existing chat logic here
    return NextResponse.json({ 
      response: "This is your existing chatbot response" 
    });

  } catch (error) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}

function shouldUseAdvancedAI(message: string): boolean {
  const advancedKeywords = [
    'analyze', 'trend', 'compare', 'chart', 'insight', 
    'sales data', 'growth', 'performance', 'metrics',
    'summarize', 'breakdown', 'forecast', 'predict'
  ];
  
  return advancedKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
}
```

2. **Add document processing hook** to your file upload:
```typescript
// In your existing file upload handler
const processForAI = async (fileId: string, content: string, title: string) => {
  try {
    await fetch('http://localhost:3001/ai-assistant/api/documents/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: fileId,
        orgId: user.orgId,
        title,
        content
      })
    });
    console.log('Document processed for AI analysis');
  } catch (error) {
    console.error('AI processing failed:', error);
  }
};
```

### Step 6: Frontend Integration

#### Update your existing chat component:

```typescript
// In your existing chat component (e.g., components/ai-chat.tsx)
import { useState } from 'react';
import { BarChart, LineChart, PieChart } from 'recharts';

interface AIResponse {
  response: string;
  sources: string[];
  charts: any[];
  insights: string[];
  reasoning: string;
}

export function EnhancedAIChat() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userId: 'current-user-id',
          orgId: 'current-org-id'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const aiResponse: AIResponse = result.data;
        
        setMessages(prev => [...prev, {
          role: 'user',
          content: message
        }, {
          role: 'assistant',
          content: aiResponse.response,
          sources: aiResponse.sources,
          charts: aiResponse.charts,
          insights: aiResponse.insights,
          reasoning: aiResponse.reasoning
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-chat">
      {/* Your existing chat UI */}
      
      {messages.map((msg, index) => (
        <div key={index} className="message">
          <div className="content">{msg.content}</div>
          
          {/* Enhanced AI features */}
          {msg.sources && (
            <div className="sources">
              <h4>Sources:</h4>
              <ul>
                {msg.sources.map((source: string, i: number) => (
                  <li key={i}>{source}</li>
                ))}
              </ul>
            </div>
          )}
          
          {msg.charts && msg.charts.length > 0 && (
            <div className="charts">
              {msg.charts.map((chart: any, i: number) => (
                <div key={i} className="chart">
                  <h4>{chart.title}</h4>
                  {renderChart(chart)}
                </div>
              ))}
            </div>
          )}
          
          {msg.insights && (
            <div className="insights">
              <h4>Key Insights:</h4>
              <ul>
                {msg.insights.map((insight: string, i: number) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function renderChart(chart: any) {
  switch (chart.type) {
    case 'bar':
      return (
        <BarChart width={500} height={300} data={chart.data}>
          {/* Chart configuration */}
        </BarChart>
      );
    case 'line':
      return (
        <LineChart width={500} height={300} data={chart.data}>
          {/* Chart configuration */}
        </LineChart>
      );
    default:
      return <div>Chart type not supported</div>;
  }
}
```

### Step 7: Testing Advanced Features

#### Test Multi-Document Analysis:
```bash
curl -X POST http://localhost:3001/ai-assistant/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Compare Q2 and Q3 sales performance",
    "userId": "test-user",
    "orgId": "test-org",
    "documentIds": ["doc1", "doc2"]
  }'
```

#### Test Chart Generation:
```bash
curl -X POST http://localhost:3001/ai-assistant/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me a chart of monthly revenue trends",
    "userId": "test-user", 
    "orgId": "test-org"
  }'
```

### Step 8: Production Deployment

#### Environment Variables for Production:
```env
# Production OpenAI
OPENAI_API_KEY=your-production-key

# Production Redis (consider Redis Cloud)
REDIS_URL=redis://your-redis-cloud-url

# Production MongoDB (consider MongoDB Atlas)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai-assistant

# Security
JWT_SECRET=your-super-secure-production-secret

# Rate Limiting (adjust based on usage)
MAX_TOKENS_PER_REQUEST=4000
MAX_REQUESTS_PER_HOUR=500
```

#### Docker Production Setup:
```dockerfile
# Dockerfile for AI Assistant
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Step 9: Monitoring & Maintenance

#### Set up monitoring:
```typescript
// Add to your monitoring dashboard
const monitorAI = async () => {
  const health = await fetch('/ai-assistant/api/health');
  const analytics = await fetch('/ai-assistant/api/analytics?orgId=your-org');
  
  // Monitor costs, performance, errors
};
```

#### Cost Monitoring:
- Monitor OpenAI usage in your dashboard
- Set up alerts for high token usage
- Review and optimize prompts regularly

## 🎉 You're Ready!

Your enterprise AI assistant is now integrated with:
- ✅ Advanced multi-document reasoning
- ✅ Intelligent chart generation  
- ✅ Cross-month analytics
- ✅ Source-aware responses
- ✅ Conversation memory
- ✅ Cost optimization
- ✅ Enterprise security

Test with queries like:
- "Analyze last 6 months sales trends"
- "Compare HR policies across departments"  
- "Show me a chart of growth metrics"
- "What insights can you find in our Q3 reports?"