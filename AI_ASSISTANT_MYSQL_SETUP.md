# 🚀 AI Assistant MySQL Integration Setup

## Overview
This guide integrates the Enterprise AI Assistant with your existing CDL system using **only MySQL** - no MongoDB required! Everything uses your current database setup.

## 🔧 Prerequisites
- Your existing CDL system is running
- OpenAI API key (✅ already configured in your `.env.local`)
- Redis running (✅ already configured)
- MySQL database (✅ your existing database)
- Node.js 18+

## 📋 Step-by-Step Setup

### Step 1: Database Setup
Run the database setup script to add AI tables and columns:

```bash
cd scripts
setup-ai-assistant-db.bat
```

This adds to your **existing MySQL database**:

#### New Columns in `files` table:
- `ai_processed` - Tracks AI processing status
- `ai_summary` - AI-generated file summary
- `ai_insights` - Key insights (JSON array)
- `ai_suggested_questions` - Suggested questions (JSON array)
- `ai_data_type` - Detected data type (sales, financial, hr, etc.)
- `ready_for_analysis` - Ready for AI chat
- `ai_processed_at` - Processing timestamp

#### New Tables Created:
- `ai_conversations` - Conversation history (replaces MongoDB)
- `ai_document_summaries` - Document summaries with embeddings
- `ai_analytics_cache` - Performance caching
- `ai_embeddings_cache` - OpenAI embedding cache (saves costs)
- `ai_rate_limits` - API rate limiting

### Step 2: Install Dependencies
```bash
# In your main project directory
npm install openai redis recharts xlsx csv-parser pdf-parse mammoth
```

### Step 3: Verify Environment Configuration
Your `.env.local` is already configured correctly:

```env
# OpenAI Configuration (✅ Already configured)
OPENAI_API_KEY=sk-proj-ZmBaS3jk3e9UfbFtGKN1...

# Redis Configuration (✅ Already configured)
REDIS_URL=redis://localhost:6379

# MySQL Configuration (✅ Your existing database)
DATABASE_URL="mysql://root:admin@localhost:3306/coprate_digital_library"

# AI Processing Configuration (✅ Added)
ENABLE_AI_ANALYSIS=true
AI_MAX_TOKENS_PER_REQUEST=4000
AI_MAX_REQUESTS_PER_HOUR=500
```

### Step 4: Test the System

#### 4.1 Test File Upload with AI Processing
1. Upload a file (Excel, CSV, PDF, Word) through your existing interface
2. Check the console logs for AI processing messages:
   ```
   📁 [UPLOAD-AI-ENHANCED] Starting enhanced AI assistant processing
   ✅ [UPLOAD-AI-ENHANCED] Enhanced AI processing completed
   ```
3. Verify in database:
   ```sql
   SELECT name, ai_processed, ai_summary, ai_data_type 
   FROM files 
   WHERE ai_processed = 1 
   ORDER BY ai_processed_at DESC;
   ```

#### 4.2 Test AI Chat
```bash
# Test the AI chat endpoint
curl -X POST http://localhost:3000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What insights can you provide from my uploaded files?",
    "userId": "1",
    "orgId": "1"
  }'
```

#### 4.3 Test File-Specific Analysis
```bash
# Test file-specific analysis
curl -X POST http://localhost:3000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Analyze the sales trends in this data",
    "userId": "1",
    "orgId": "1",
    "fileId": "your-file-id",
    "fileName": "sales-data.xlsx"
  }'
```

## 🎯 How It Works

### Automatic File Processing
When users upload files, the system now:

1. **Stores the file** (your existing process)
2. **Extracts content** (text, tables, metadata)
3. **Performs AI analysis** (trends, anomalies, insights)
4. **Stores in MySQL** (ai_document_summaries table)
5. **Updates file record** (ai_processed = true)
6. **Makes file "chat-ready"** for immediate questioning

### MySQL-Based Memory System
- **Short-term memory**: Redis (fast access, 1-hour TTL)
- **Long-term memory**: MySQL `ai_conversations` table
- **Document summaries**: MySQL `ai_document_summaries` table
- **Embeddings cache**: MySQL `ai_embeddings_cache` table (saves OpenAI costs)
- **Analytics cache**: MySQL `ai_analytics_cache` table (performance)

### Supported File Types & Analysis
- **Excel files** (.xlsx, .xls) - Full table analysis, trend detection
- **CSV files** - Data analysis, statistical insights
- **PDF files** - Text extraction and content analysis
- **Word documents** (.docx) - Content summarization
- **Text files** - Content analysis and insights

## 🎨 Database Schema

### Files Table (Enhanced)
```sql
-- Your existing files table now has:
ALTER TABLE files ADD COLUMN ai_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN ai_summary TEXT;
ALTER TABLE files ADD COLUMN ai_insights JSON;
ALTER TABLE files ADD COLUMN ai_suggested_questions JSON;
ALTER TABLE files ADD COLUMN ai_data_type VARCHAR(50);
ALTER TABLE files ADD COLUMN ready_for_analysis BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN ai_processed_at TIMESTAMP NULL;
```

### AI Conversations Table
```sql
CREATE TABLE ai_conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  messages JSON NOT NULL,
  document_ids JSON,
  insights JSON,
  context_type ENUM('HR', 'Sales', 'Finance', 'General') DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### AI Document Summaries Table
```sql
CREATE TABLE ai_document_summaries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  key_insights JSON,
  embedding_vector JSON, -- OpenAI embeddings stored as JSON
  data_type ENUM('sales', 'financial', 'hr', 'operational', 'mixed'),
  metrics JSON,
  trends JSON,
  anomalies JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📊 Example Usage Scenarios

### Scenario 1: Sales Analysis
1. User uploads `Q3-Sales-Data.xlsx`
2. System automatically:
   - Detects it's sales data (`ai_data_type = 'sales'`)
   - Generates insights: "15% growth, peak in August, regional variations"
   - Stores summary in `ai_document_summaries`
   - Updates `files.ai_processed = true`
3. User asks: "Why did sales dip in July?"
4. AI searches MySQL tables and provides detailed analysis with charts

### Scenario 2: Multi-Document Analysis
1. User has multiple reports uploaded over time
2. User asks: "Compare Q1 and Q2 performance across all reports"
3. AI queries `ai_document_summaries` for relevant documents
4. Provides comprehensive comparison with visualizations

## 🔍 Monitoring & Debugging

### Check AI Processing Status
```sql
-- See which files have been AI processed
SELECT 
  f.name, 
  f.ai_processed, 
  f.ai_data_type, 
  f.ready_for_analysis,
  f.ai_processed_at,
  ads.summary
FROM files f
LEFT JOIN ai_document_summaries ads ON f.id = ads.document_id
WHERE f.organization_id = 1 
AND f.ai_processed = 1
ORDER BY f.ai_processed_at DESC;
```

### View AI Insights
```sql
-- See AI-generated insights for a file
SELECT 
  f.name,
  f.ai_summary,
  JSON_EXTRACT(f.ai_insights, '$') as insights,
  JSON_EXTRACT(f.ai_suggested_questions, '$') as questions,
  ads.key_insights
FROM files f
LEFT JOIN ai_document_summaries ads ON f.id = ads.document_id
WHERE f.id = 123;
```

### Check Conversation History
```sql
-- View recent AI conversations
SELECT 
  ac.conversation_id,
  oe.full_name as user_name,
  ac.context_type,
  JSON_LENGTH(ac.messages) as message_count,
  ac.updated_at
FROM ai_conversations ac
JOIN organization_employees oe ON ac.user_id = oe.id
WHERE ac.organization_id = 1
ORDER BY ac.updated_at DESC
LIMIT 10;
```

### Monitor Cache Performance
```sql
-- Check embedding cache hit rate
SELECT 
  COUNT(*) as cached_embeddings,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_cache,
  AVG(TIMESTAMPDIFF(HOUR, created_at, NOW())) as avg_age_hours
FROM ai_embeddings_cache;

-- Check analytics cache
SELECT 
  COUNT(*) as cached_queries,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_cache
FROM ai_analytics_cache;
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "AI processing failed"
- Check OpenAI API key is valid
- Verify Redis is running: `redis-cli ping`
- Check MySQL connection
- Review upload logs for specific errors

#### 2. "File not ready for analysis"
- Wait for AI processing to complete (5-10 seconds after upload)
- Check `files.ai_processed` column in database
- Review console logs for processing errors

#### 3. "No insights generated"
- Ensure file contains analyzable content
- Check if file type is supported
- Verify OpenAI API has sufficient credits

#### 4. Database connection issues
```sql
-- Test AI tables exist
SHOW TABLES LIKE 'ai_%';

-- Check AI columns in files table
DESCRIBE files;
```

## 🎉 Success Indicators

You'll know the system is working when:

✅ **File uploads** show AI processing logs in console  
✅ **Database** has `ai_processed = true` for new files  
✅ **AI chat** responds with file-specific insights  
✅ **Charts** are automatically generated for data files  
✅ **Suggested questions** appear for uploaded files  
✅ **MySQL tables** contain conversation and summary data  

## 🚀 Performance Benefits

### MySQL vs MongoDB Advantages:
- **Single database** - No additional infrastructure
- **ACID compliance** - Reliable transactions
- **Existing expertise** - Your team already knows MySQL
- **Backup integration** - Part of your existing backup strategy
- **Query performance** - Optimized indexes for AI queries
- **Cost effective** - No additional database licensing

### Caching Strategy:
- **Redis** - Fast short-term memory and session data
- **MySQL** - Persistent embeddings and analytics cache
- **Dual-layer** - Redis first, MySQL fallback for reliability

## 🎯 Next Steps

Once setup is complete, your users can:

1. **Upload any business file** and get immediate AI insights
2. **Ask natural language questions** about their data
3. **Get automatic charts** and visualizations
4. **Receive business recommendations** based on their data
5. **Explore data interactively** with follow-up questions

Your CDL system is now a **full Enterprise AI Analytics Platform** using only your existing MySQL infrastructure! 🎯

## 📞 Support

If you encounter issues:
1. Check the debug logs in console
2. Verify Redis is running: `redis-cli ping`
3. Test MySQL connection and verify AI tables exist
4. Review the API endpoints are responding correctly
5. Start with a simple CSV file for initial testing

The system gracefully handles failures - if AI processing fails, your existing file upload still works normally.