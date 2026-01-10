# Enterprise AI Assistant Integration Guide

## 🚀 Quick Integration with Your Existing Chatbox

### 1. Environment Setup

Copy the `.env.example` to `.env` and configure:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL_CHAT=gpt-4o-mini
OPENAI_MODEL_EMBEDDING=text-embedding-3-large

# Redis Configuration (for memory)
REDIS_URL=redis://localhost:6379

# MongoDB Configuration (for long-term memory)
MONGODB_URI=mongodb://localhost:27017/ai-assistant

# Security
JWT_SECRET=your_jwt_secret_here

# Cost Optimization
MAX_TOKENS_PER_REQUEST=4000
MAX_REQUESTS_PER_HOUR=100
```

### 2. Install Dependencies

```bash
cd ai-assistant
npm install
```

### 3. Start Services

```bash
# Start Redis (for short-term memory)
docker run -d -p 6379:6379 redis:alpine

# Start MongoDB (for long-term memory)
docker run -d -p 27017:27017 mongo:latest
```

### 4. Integration with Your Existing Chatbox

#### Frontend Integration (Add to your existing chat component):

```typescript
// In your existing chat component
const sendAdvancedMessage = async (message: string) => {
  try {
    const response = await fetch('/ai-assistant/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        userId: currentUser.id,
        orgId: currentUser.orgId,
        conversationId: conversationId,
        documentIds: selectedDocuments, // Optional: specific documents
        contextType: 'Sales', // Optional: HR, Sales, Finance, General
        conversationHistory: chatHistory.slice(-10) // Last 10 messages
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // Handle the advanced AI response
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: result.data.response,
        sources: result.data.sources,
        charts: result.data.charts,
        insights: result.data.insights,
        reasoning: result.data.reasoning
      }]);
      
      // Render charts if available
      if (result.data.charts?.length > 0) {
        renderCharts(result.data.charts);
      }
    }
  } catch (error) {
    console.error('Advanced AI Error:', error);
  }
};
```

#### Backend Route Integration (Add to your existing API):

```typescript
// In your existing API routes
import { aiOrchestrator } from './ai-assistant/lib/orchestration/ai-orchestrator';

// Add this to your existing chat API
export async function POST(request: NextRequest) {
  // ... your existing logic
  
  // Check if this should use advanced AI
  if (shouldUseAdvancedAI(message)) {
    // Proxy to advanced AI assistant
    const aiResponse = await fetch(`${process.env.AI_ASSISTANT_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userId,
        orgId,
        conversationId,
        documentIds,
        contextType,
        conversationHistory
      })
    });
    
    return aiResponse;
  }
  
  // ... your existing chat logic
}

function shouldUseAdvancedAI(message: string): boolean {
  const advancedKeywords = [
    'analyze', 'trend', 'compare', 'chart', 'insight', 
    'sales data', 'growth', 'performance', 'metrics'
  ];
  
  return advancedKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
}
```

### 5. Document Processing Integration

When users upload documents, process them for AI analysis:

```typescript
// In your existing file upload handler
const processDocumentForAI = async (fileId: string, content: string) => {
  try {
    await fetch('/ai-assistant/api/documents/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: fileId,
        orgId: currentUser.orgId,
        title: fileName,
        content: extractedText
      })
    });
  } catch (error) {
    console.error('Document processing error:', error);
  }
};
```

### 6. Chart Rendering Component

```typescript
// Add to your components
import { Recharts } from 'recharts';

const AIChartRenderer = ({ charts }: { charts: any[] }) => {
  return (
    <div className="ai-charts">
      {charts.map((chart, index) => (
        <div key={index} className="chart-container">
          <h3>{chart.title}</h3>
          {chart.type === 'bar' && (
            <BarChart width={600} height={300} data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.config.xAxis} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          )}
          {chart.type === 'line' && (
            <LineChart width={600} height={300} data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="y" stroke="#3b82f6" />
            </LineChart>
          )}
          {/* Add other chart types as needed */}
        </div>
      ))}
    </div>
  );
};
```

## 🎯 Advanced Features Usage

### Multi-Document Analysis
```typescript
const analyzeMultipleDocuments = async (query: string, documentIds: string[]) => {
  const response = await fetch('/ai-assistant/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: query,
      userId,
      orgId,
      documentIds, // Specify which documents to analyze
      contextType: 'General'
    })
  });
};
```

### Sales Trend Analysis
```typescript
const analyzeSalesTrend = async () => {
  const response = await sendAdvancedMessage(
    "Analyze last 10 months sales and compare Q2 vs Q3"
  );
  // Will automatically generate charts and insights
};
```

### Context-Aware Queries
```typescript
const askContextualQuestion = async (context: 'HR' | 'Sales' | 'Finance') => {
  const response = await sendAdvancedMessage(
    "What are the key insights from recent reports?",
    { contextType: context }
  );
};
```

## 🔧 Configuration Options

### Cost Optimization
- Adjust `MAX_TOKENS_PER_REQUEST` and `MAX_REQUESTS_PER_HOUR` in `.env`
- Enable embedding caching (automatically enabled)
- Use cheaper models for summaries

### Security Settings
- All queries are isolated by `orgId`
- Rate limiting per user
- Document-level permissions
- No raw database exposure to LLM

### Memory Configuration
- Short-term memory: Redis (1 hour TTL)
- Long-term memory: MongoDB (permanent)
- Embedding cache: Redis (24 hours TTL)

## 📊 Monitoring & Analytics

Access analytics dashboard:
```typescript
const getAnalytics = async () => {
  const response = await fetch('/ai-assistant/api/analytics?orgId=your_org_id');
  const analytics = await response.json();
  // Shows query types, performance metrics, cost analysis
};
```

## 🚨 Health Monitoring

Check system health:
```typescript
const checkHealth = async () => {
  const response = await fetch('/ai-assistant/api/health');
  const health = await response.json();
  // Monitor OpenAI, Redis, MongoDB status
};
```

## 🎨 UI Integration Examples

### Sources Panel
```typescript
const SourcesPanel = ({ sources }: { sources: string[] }) => (
  <div className="sources-panel">
    <h4>Sources Used:</h4>
    <ul>
      {sources.map((source, index) => (
        <li key={index}>{source}</li>
      ))}
    </ul>
  </div>
);
```

### Insights Display
```typescript
const InsightsDisplay = ({ insights }: { insights: string[] }) => (
  <div className="insights-panel">
    <h4>Key Insights:</h4>
    <ul>
      {insights.map((insight, index) => (
        <li key={index}>{insight}</li>
      ))}
    </ul>
  </div>
);
```

This integration transforms your existing chatbox into an enterprise-grade AI assistant with advanced analytics, multi-document reasoning, and intelligent chart generation!