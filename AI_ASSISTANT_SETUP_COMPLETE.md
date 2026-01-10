# 🚀 Complete AI Assistant Setup Guide

## Overview
This guide will integrate the Enterprise AI Assistant with your existing CDL system, enabling advanced file analytics, intelligent questioning, and automated insights.

## 🔧 Prerequisites
- Your existing CDL system is running
- OpenAI API key (already configured in your `.env.local`)
- Redis running (already configured)
- MongoDB installed and running
- Node.js 18+

## 📋 Step-by-Step Setup

### Step 1: Database Setup
Run the database setup script to add AI columns:

```bash
cd scripts
setup-ai-assistant-db.bat
```

This adds the following columns to your `files` table:
- `ai_processed` - Tracks AI processing status
- `ai_summary` - AI-generated file summary
- `ai_insights` - Key insights (JSON array)
- `ai_suggested_questions` - Suggested questions (JSON array)
- `ai_data_type` - Detected data type (sales, financial, hr, etc.)
- `ready_for_analysis` - Ready for AI chat
- `ai_processed_at` - Processing timestamp

### Step 2: Start MongoDB
```bash
# Using Docker (recommended)
docker run -d --name ai-mongo -p 27017:27017 mongo:latest

# Or install MongoDB locally and start the service
```

### Step 3: Install AI Assistant Dependencies
```bash
# In your main project directory
npm install openai redis mongodb recharts xlsx csv-parser pdf-parse mammoth
```

### Step 4: Verify Environment Configuration
Your `.env.local` already has the necessary configuration:

```env
# OpenAI Configuration (✅ Already configured)
OPENAI_API_KEY=sk-proj-ZmBaS3jk3e9UfbFtGKN1...

# Redis Configuration (✅ Already configured)
REDIS_URL=redis://localhost:6379

# MongoDB Configuration (✅ Added)
MONGODB_URI=mongodb://localhost:27017/ai-assistant

# AI Processing Configuration (✅ Added)
ENABLE_AI_ANALYSIS=true
AI_MAX_TOKENS_PER_REQUEST=4000
AI_MAX_REQUESTS_PER_HOUR=500
```

### Step 5: Test the System

#### 5.1 Test File Upload with AI Processing
1. Upload a file (Excel, CSV, PDF, Word) through your existing interface
2. Check the console logs for AI processing messages
3. Verify the file gets `ai_processed = true` in the database

#### 5.2 Test AI Chat
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

#### 5.3 Test File-Specific Analysis
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
4. **Generates summary** and suggested questions
5. **Makes file "chat-ready"** for immediate questioning

### Supported File Types
- **Excel files** (.xlsx, .xls) - Full table analysis, trend detection
- **CSV files** - Data analysis, statistical insights
- **PDF files** - Text extraction and content analysis
- **Word documents** (.docx) - Content summarization
- **Text files** - Content analysis and insights

### AI Capabilities
- **Trend Analysis** - Identifies growth patterns, seasonal trends
- **Anomaly Detection** - Finds outliers and unusual data points
- **Correlation Analysis** - Discovers relationships between variables
- **Chart Generation** - Creates relevant visualizations automatically
- **Business Insights** - Provides actionable recommendations
- **Smart Questions** - Suggests relevant questions to ask

## 🎨 Frontend Integration

### Enhanced File Library
Your file library now shows AI status:

```typescript
// Files now have AI indicators
{
  id: 123,
  name: "Q3-Sales-Report.xlsx",
  ai_processed: true,
  ai_summary: "Sales data shows 15% growth with strong Q3 performance...",
  ready_for_analysis: true,
  ai_data_type: "sales"
}
```

### AI Chat Integration
Your existing AI chat now supports:

```typescript
// File-aware conversations
const response = await fetch('/api/ai-assistant/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: "Show me the revenue trends",
    userId: user.id,
    orgId: user.orgId,
    fileId: selectedFile.id,  // 🆕 File context
    fileName: selectedFile.name
  })
});

// Response includes charts, insights, and sources
const { response, charts, insights, sources } = await response.json();
```

## 📊 Example Usage Scenarios

### Scenario 1: Sales Analysis
1. User uploads `Q3-Sales-Data.xlsx`
2. System automatically detects it's sales data
3. Generates insights: "15% growth, peak in August, regional variations"
4. User asks: "Why did sales dip in July?"
5. AI analyzes data and provides detailed explanation with charts

### Scenario 2: Financial Review
1. User uploads `Expense-Report.xlsx`
2. System identifies expense categories and trends
3. User asks: "What are our biggest cost drivers?"
4. AI provides breakdown with pie charts and recommendations

### Scenario 3: HR Analytics
1. User uploads `Employee-Data.csv`
2. System analyzes headcount, departments, salary distributions
3. User asks: "Show me hiring trends by department"
4. AI generates trend charts and insights

## 🔍 Monitoring & Debugging

### Check AI Processing Status
```sql
-- See which files have been AI processed
SELECT 
  name, 
  ai_processed, 
  ai_data_type, 
  ready_for_analysis,
  ai_processed_at
FROM files 
WHERE organization_id = 1 
ORDER BY ai_processed_at DESC;
```

### View AI Insights
```sql
-- See AI-generated insights for a file
SELECT 
  name,
  ai_summary,
  JSON_EXTRACT(ai_insights, '$') as insights,
  JSON_EXTRACT(ai_suggested_questions, '$') as questions
FROM files 
WHERE id = 123;
```

### Debug Logs
Enable debug mode in `.env.local`:
```env
AI_DEBUG_MODE=true
ENABLE_UPLOAD_DEBUGGING=true
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "AI processing failed"
- Check OpenAI API key is valid
- Verify Redis is running
- Check MongoDB connection

#### 2. "File not ready for analysis"
- Wait for AI processing to complete (5-10 seconds after upload)
- Check `ai_processed` column in database
- Review upload logs for errors

#### 3. "No charts generated"
- Ensure file contains numeric data
- Check if file type is supported for chart generation
- Verify data has time-series or categorical structure

#### 4. MongoDB connection issues
```bash
# Check if MongoDB is running
docker ps | grep mongo

# Start MongoDB if not running
docker start ai-mongo
```

## 🎉 Success Indicators

You'll know the system is working when:

✅ **File uploads** show AI processing logs  
✅ **Database** has `ai_processed = true` for new files  
✅ **AI chat** responds with file-specific insights  
✅ **Charts** are automatically generated for data files  
✅ **Suggested questions** appear for uploaded files  

## 🚀 Next Steps

Once setup is complete, your users can:

1. **Upload any business file** and get immediate AI insights
2. **Ask natural language questions** about their data
3. **Get automatic charts** and visualizations
4. **Receive business recommendations** based on their data
5. **Explore data interactively** with follow-up questions

Your CDL system is now an **Enterprise AI Analytics Platform**! 🎯

## 📞 Support

If you encounter issues:
1. Check the debug logs in console
2. Verify all services are running (Redis, MongoDB)
3. Test with a simple CSV file first
4. Review the API endpoints are responding correctly

The system is designed to gracefully handle failures - if AI processing fails, your existing file upload still works normally.