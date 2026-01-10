# Integration with Your Existing CDL System

## 🚀 Complete File Upload & Analytics Integration

### Step 1: Modify Your Existing File Upload API

Update your existing file upload handler to process files for AI analysis:

```typescript
// In your existing app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const orgId = formData.get('orgId') as string;

    // Your existing file upload logic
    const uploadResult = await uploadToStorage(file);
    
    // NEW: Process file for AI analysis
    if (shouldProcessForAI(file)) {
      await processFileForAI(file, uploadResult.fileId, userId, orgId);
    }

    return NextResponse.json({
      success: true,
      fileId: uploadResult.fileId,
      // NEW: AI processing status
      aiProcessing: {
        enabled: shouldProcessForAI(file),
        status: 'processing',
        readyForAnalysis: false
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// NEW: Check if file should be processed for AI
function shouldProcessForAI(file: File): boolean {
  const aiSupportedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // docx
  ];
  
  return aiSupportedTypes.includes(file.type);
}

// NEW: Process file for AI analysis
async function processFileForAI(file: File, fileId: string, userId: string, orgId: string) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('orgId', orgId);

    const response = await fetch('http://localhost:3001/ai-assistant/api/files/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.success) {
      // Store AI processing results in your database
      await updateFileWithAIResults(fileId, result.data);
    }
  } catch (error) {
    console.error('AI processing failed:', error);
  }
}

async function updateFileWithAIResults(fileId: string, aiData: any) {
  // Update your existing files table with AI analysis results
  await db.files.update({
    where: { id: fileId },
    data: {
      aiProcessed: true,
      aiSummary: aiData.summary,
      aiInsights: JSON.stringify(aiData.insights),
      aiSuggestedQuestions: JSON.stringify(aiData.suggestedQuestions),
      aiDataType: aiData.analytics.dataType,
      readyForAnalysis: aiData.readyForChat
    }
  });
}
```

### Step 2: Enhance Your Existing AI Chat Component

Update your existing AI chat to support file-based analytics:

```typescript
// In your existing components/ai-chat.tsx or similar
import { useState, useEffect } from 'react';
import { BarChart, LineChart, PieChart, Bar, Line, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  charts?: any[];
  insights?: string[];
  fileContext?: {
    fileId: string;
    fileName: string;
  };
}

export function EnhancedAIChat({ selectedFileId, selectedFileName }: { 
  selectedFileId?: string; 
  selectedFileName?: string; 
}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Load suggested questions when file is selected
  useEffect(() => {
    if (selectedFileId) {
      loadSuggestedQuestions(selectedFileId);
    }
  }, [selectedFileId]);

  const loadSuggestedQuestions = async (fileId: string) => {
    try {
      const response = await fetch(`/ai-assistant/api/integration/chat?fileId=${fileId}&orgId=${currentUser.orgId}`);
      const result = await response.json();
      
      if (result.success) {
        setSuggestedQuestions(result.data.suggestions);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const sendMessage = async (message: string, requestType: 'chat' | 'analysis' | 'quick_insight' = 'chat') => {
    setIsLoading(true);
    
    // Add user message
    const userMessage: AIMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/ai-assistant/api/integration/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userId: currentUser.id,
          orgId: currentUser.orgId,
          fileId: selectedFileId,
          fileName: selectedFileName,
          requestType,
          conversationHistory: messages.slice(-10) // Last 10 messages for context
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const aiMessage: AIMessage = {
          role: 'assistant',
          content: result.data.response || result.data.answer,
          sources: result.data.sources,
          charts: result.data.charts,
          insights: result.data.insights || result.data.keyInsights,
          fileContext: selectedFileId ? { fileId: selectedFileId, fileName: selectedFileName || 'Unknown' } : undefined
        };
        
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickInsight = async () => {
    if (!selectedFileId) return;
    
    await sendMessage('Generate quick insights from this file', 'quick_insight');
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question, 'analysis');
  };

  return (
    <div className="ai-chat-container">
      {/* File Context Display */}
      {selectedFileId && (
        <div className="file-context-banner">
          <div className="flex items-center justify-between p-3 bg-blue-50 border-l-4 border-blue-400">
            <div>
              <p className="text-sm font-medium text-blue-800">
                Analyzing: {selectedFileName}
              </p>
              <p className="text-xs text-blue-600">
                Ask questions about this file or request analytics
              </p>
            </div>
            <button 
              onClick={handleQuickInsight}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Quick Insights
            </button>
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {suggestedQuestions.length > 0 && (
        <div className="suggested-questions p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Suggested Questions:</h4>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 4).map((question, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedQuestion(question)}
                className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-full hover:bg-gray-100"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="messages-container">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-content">
              {message.content}
            </div>

            {/* File Context Indicator */}
            {message.fileContext && (
              <div className="file-context-indicator">
                <span className="text-xs text-blue-600">
                  📄 Based on: {message.fileContext.fileName}
                </span>
              </div>
            )}

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <div className="sources">
                <h5 className="text-sm font-medium">Sources:</h5>
                <ul className="text-xs">
                  {message.sources.map((source, i) => (
                    <li key={i}>• {source}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Charts */}
            {message.charts && message.charts.length > 0 && (
              <div className="charts">
                {message.charts.map((chart, i) => (
                  <div key={i} className="chart-container">
                    <h5 className="text-sm font-medium mb-2">{chart.title}</h5>
                    <ResponsiveContainer width="100%" height={300}>
                      {renderChart(chart)}
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}

            {/* Insights */}
            {message.insights && message.insights.length > 0 && (
              <div className="insights">
                <h5 className="text-sm font-medium">Key Insights:</h5>
                <ul className="text-sm">
                  {message.insights.map((insight, i) => (
                    <li key={i}>💡 {insight}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="input-area">
        <ChatInput 
          onSend={sendMessage} 
          isLoading={isLoading}
          placeholder={selectedFileId ? "Ask about your file..." : "Ask me anything..."}
        />
      </div>
    </div>
  );
}

function renderChart(chart: any) {
  switch (chart.type) {
    case 'bar':
      return (
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      );
    case 'line':
      return (
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      );
    case 'pie':
      return (
        <PieChart>
          <Pie
            data={chart.data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#3b82f6"
            label
          />
          <Tooltip />
        </PieChart>
      );
    default:
      return <div>Chart type not supported</div>;
  }
}
```

### Step 3: Update Your File Library/Dashboard

Add AI analysis indicators to your existing file list:

```typescript
// In your existing file library component
export function FileLibrary() {
  const [files, setFiles] = useState([]);

  const renderFileItem = (file: any) => (
    <div key={file.id} className="file-item">
      <div className="file-info">
        <h3>{file.name}</h3>
        <p>{file.size} • {file.uploadedAt}</p>
        
        {/* NEW: AI Analysis Status */}
        {file.aiProcessed && (
          <div className="ai-status">
            <span className="ai-badge">🤖 AI Ready</span>
            <p className="ai-summary">{file.aiSummary}</p>
          </div>
        )}
      </div>

      <div className="file-actions">
        <button onClick={() => downloadFile(file.id)}>
          Download
        </button>
        
        {/* NEW: AI Analysis Button */}
        {file.aiProcessed && (
          <button 
            onClick={() => openAIChat(file.id, file.name)}
            className="ai-analyze-btn"
          >
            🧠 Analyze with AI
          </button>
        )}
      </div>
    </div>
  );

  const openAIChat = (fileId: string, fileName: string) => {
    // Navigate to AI chat with file context
    router.push(`/ai-chat?fileId=${fileId}&fileName=${encodeURIComponent(fileName)}`);
  };

  return (
    <div className="file-library">
      {files.map(renderFileItem)}
    </div>
  );
}
```

### Step 4: Add Database Schema Updates

Add AI-related columns to your existing files table:

```sql
-- Add to your existing files table
ALTER TABLE files ADD COLUMN ai_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN ai_summary TEXT;
ALTER TABLE files ADD COLUMN ai_insights JSON;
ALTER TABLE files ADD COLUMN ai_suggested_questions JSON;
ALTER TABLE files ADD COLUMN ai_data_type VARCHAR(50);
ALTER TABLE files ADD COLUMN ready_for_analysis BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN ai_processed_at TIMESTAMP;

-- Create index for AI queries
CREATE INDEX idx_files_ai_processed ON files(ai_processed, org_id);
CREATE INDEX idx_files_ready_for_analysis ON files(ready_for_analysis, org_id);
```

### Step 5: Environment Configuration

Add to your existing `.env.local`:

```env
# AI Assistant Configuration
AI_ASSISTANT_URL=http://localhost:3001
ENABLE_AI_PROCESSING=true

# OpenAI (for AI Assistant)
OPENAI_API_KEY=your_openai_key_here

# Redis (for AI memory)
REDIS_URL=redis://localhost:6379

# MongoDB (for AI long-term memory)
MONGODB_URI=mongodb://localhost:27017/ai-assistant
```

## 🎯 Usage Examples

### Example 1: Upload and Immediate Analysis
```typescript
// User uploads sales.xlsx
// System automatically:
// 1. Stores file in your existing storage
// 2. Processes file for AI analysis
// 3. Generates summary and suggested questions
// 4. User can immediately ask: "What are the sales trends?"
```

### Example 2: Multi-File Analysis
```typescript
// User selects multiple files and asks:
// "Compare Q1 and Q2 performance across all uploaded reports"
// AI analyzes all selected files and provides comprehensive comparison
```

### Example 3: Interactive Analytics
```typescript
// User asks: "Show me revenue by region"
// AI generates:
// - Bar chart of revenue by region
// - Key insights about top/bottom performers
// - Recommendations for improvement
// - Follow-up questions like "What caused the dip in the South region?"
```

## 🚀 Ready to Use!

With this integration, your users can:

1. **Upload any file** (Excel, CSV, PDF, Word) to your existing system
2. **Get immediate AI processing** with summary and insights
3. **Ask natural language questions** about their data
4. **Get automatic charts and visualizations**
5. **Receive business recommendations** based on their data
6. **Continue conversations** with full context memory

The AI assistant seamlessly integrates with your existing CDL system while adding enterprise-grade analytics capabilities!