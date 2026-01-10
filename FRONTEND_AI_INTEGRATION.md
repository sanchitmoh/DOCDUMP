# 🎨 Frontend AI Integration Guide

## Overview
This guide shows you how to integrate the enhanced AI chatbox with your existing frontend components.

## 🔧 Components Created

### 1. **Enhanced AI Chatbox** (`components/enhanced-ai-chatbox.tsx`)
- **Advanced AI features**: Charts, insights, sources, file context
- **Real-time analytics**: Connects to your AI assistant backend
- **File-aware conversations**: Can analyze specific uploaded files
- **Smart suggestions**: Shows relevant questions based on file content

### 2. **AI Chat Wrapper** (`components/ai-chat-wrapper.tsx`)
- **Authentication integration**: Works with your existing auth system
- **User context management**: Handles user ID and organization ID
- **Error handling**: Graceful fallbacks for auth issues

### 3. **Enhanced File Item** (`components/enhanced-file-item.tsx`)
- **AI status indicators**: Shows which files are AI-processed
- **Smart suggestions**: Displays AI-generated questions for each file
- **Quick AI chat**: Direct integration with AI chatbox
- **Visual insights**: Shows data type, processing status, and insights

### 4. **AI Chat Hook** (`hooks/use-ai-chat.ts`)
- **User management**: Handles authentication and user context
- **File selection**: Manages selected file for AI context
- **State management**: Centralized AI chat state

## 🚀 Integration Steps

### Step 1: Replace Your Existing AI Chatbox

In your layout or main component, replace the old chatbox:

```tsx
// OLD: components/ai-chatbox.tsx
import { AIChatbox } from '@/components/ai-chatbox'

// NEW: Enhanced version
import { AIChatWrapper } from '@/components/ai-chat-wrapper'

export default function Layout() {
  return (
    <div>
      {/* Your existing layout */}
      
      {/* Replace old chatbox with enhanced version */}
      <AIChatWrapper />
    </div>
  )
}
```

### Step 2: Update Your File Library

Enhance your existing library page to use the new file component:

```tsx
// In your app/library/page.tsx or similar
import { EnhancedFileItem } from '@/components/enhanced-file-item'
import { AIChatWrapper } from '@/components/ai-chat-wrapper'
import { useState } from 'react'

export default function Library() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  
  // Your existing state and functions...

  const handleAIChat = (fileId: string, fileName: string) => {
    setSelectedFileId(fileId)
    setSelectedFileName(fileName)
    // The AI chatbox will automatically open with file context
  }

  return (
    <div>
      {/* Your existing library UI */}
      
      {/* Enhanced file listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file) => (
          <EnhancedFileItem
            key={file.id}
            file={file}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onShare={handleShare}
            onAIChat={handleAIChat}  // NEW: AI chat integration
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {/* Enhanced AI chatbox with file context */}
      <AIChatWrapper
        selectedFileId={selectedFileId}
        selectedFileName={selectedFileName}
        onFileSelect={(fileId, fileName) => {
          setSelectedFileId(fileId)
          setSelectedFileName(fileName)
        }}
      />
    </div>
  )
}
```

### Step 3: Update Your Authentication Hook

Make sure your auth context provides the necessary user information:

```tsx
// In your context/auth-context.tsx or similar
interface User {
  id: number           // User ID (required for AI)
  orgId: number        // Organization ID (required for AI)
  organizationId: number // Alternative field name
  userId: number       // Alternative field name
  name: string
  email: string
  type: 'employee' | 'organization'
}

// Make sure your auth context exposes these fields
export const useAuth = () => {
  // Your existing auth logic...
  
  return {
    user: {
      id: user.userId || user.id,
      orgId: user.organizationId || user.orgId,
      name: user.full_name || user.name,
      email: user.email,
      type: user.type || 'employee'
    },
    isAuthenticated,
    // ... other auth methods
  }
}
```

### Step 4: Add AI Status to File Interface

Update your file interface to include AI fields:

```tsx
// In your types or interfaces file
interface FileItem {
  id: number
  name: string
  // ... existing fields
  
  // NEW: AI-related fields
  ai_processed?: boolean
  ai_summary?: string
  ai_data_type?: 'sales' | 'financial' | 'hr' | 'operational' | 'mixed'
  ready_for_analysis?: boolean
  ai_suggested_questions?: string[] | string
  ai_insights?: string[] | string
  ai_processed_at?: string
}
```

## 🎯 Features You Get

### **Enhanced File Experience**
- **AI Status Indicators**: See which files are AI-ready
- **Smart Suggestions**: Get relevant questions for each file
- **Quick AI Chat**: Click to start AI conversation about specific files
- **Data Type Detection**: Visual indicators for sales, financial, HR data

### **Advanced AI Chat**
- **File Context**: AI knows which file you're asking about
- **Automatic Charts**: AI generates visualizations from your data
- **Source Citations**: See which documents AI used for answers
- **Business Insights**: Get actionable recommendations
- **Conversation Memory**: AI remembers your chat history

### **Seamless Integration**
- **Works with existing auth**: Uses your current authentication system
- **Backward compatible**: Doesn't break existing functionality
- **Progressive enhancement**: AI features appear as files get processed

## 🔍 User Experience Flow

### **1. File Upload**
```
User uploads file → AI processes automatically → 
File shows "AI Ready" status → User can ask questions
```

### **2. AI Chat Interaction**
```
User clicks "AI Chat" on file → Chatbox opens with file context → 
User asks question → AI analyzes file data → 
Returns answer with charts/insights
```

### **3. Smart Suggestions**
```
File processed → AI generates suggested questions → 
User sees questions on file card → Click to ask AI
```

## 🎨 Visual Enhancements

### **File Cards Show:**
- ✅ **AI Processing Status** (Ready/Processing/Not Processed)
- ✅ **Data Type Badges** (Sales/Financial/HR/Operational)
- ✅ **AI Summary Preview** (Expandable summary)
- ✅ **Suggested Questions** (Click to ask AI)
- ✅ **Quick AI Chat Button** (Direct access to AI)

### **AI Chatbox Shows:**
- ✅ **File Context Banner** (Which file you're discussing)
- ✅ **Source Citations** (Which documents AI used)
- ✅ **Interactive Charts** (Bar, line, pie charts)
- ✅ **Key Insights** (Business recommendations)
- ✅ **Confidence Indicators** (How sure AI is about answers)

## 🚨 Testing the Integration

### **1. Test File Upload**
1. Upload a CSV or Excel file
2. Wait for AI processing (5-10 seconds)
3. File should show "AI Ready" status
4. Click "AI Chat" button

### **2. Test AI Conversation**
1. Ask: "What insights can you provide from this data?"
2. Should get response with charts and insights
3. Try: "Show me trends over time"
4. Should generate appropriate visualizations

### **3. Test File Context**
1. Select different files
2. Ask same question about each
3. AI should provide file-specific answers
4. Context banner should show current file

## 🔧 Troubleshooting

### **AI Chat Not Working**
- Check user authentication (user ID and org ID required)
- Verify AI assistant API is running
- Check browser console for errors

### **Files Not Showing AI Status**
- Ensure database setup is complete
- Check if AI processing is enabled in environment
- Verify file upload triggers AI processing

### **Charts Not Displaying**
- Install recharts: `npm install recharts`
- Check if file contains numeric data
- Verify chart data format in API response

## 🎉 Result

Your users now have:
- **Smart file management** with AI insights
- **Interactive data analysis** through natural language
- **Automatic visualizations** from their data
- **Contextual conversations** about specific files
- **Business intelligence** at their fingertips

The integration is **seamless**, **backward-compatible**, and **progressively enhanced** - existing functionality continues to work while new AI features appear as files get processed! 🚀