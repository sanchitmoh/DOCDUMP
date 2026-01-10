"use client"

import { useState } from "react"
import { 
  File, 
  Eye, 
  Share2, 
  Download, 
  Brain, 
  MessageCircle, 
  BarChart3, 
  Lightbulb,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react"

interface FileItem {
  id: number
  name: string
  file_type: string
  mime_type: string
  size_bytes: number
  folder_id: number
  description?: string
  tags?: string[]
  visibility: string
  department?: string
  created_at: string
  updated_at: string
  created_by: number
  uploaded_by_name?: string
  folder_name?: string
  last_viewed_at?: string
  // AI-related fields
  ai_processed?: boolean
  ai_summary?: string
  ai_data_type?: string
  ready_for_analysis?: boolean
  ai_suggested_questions?: string[]
  ai_insights?: string[]
  ai_processed_at?: string
}

interface EnhancedFileItemProps {
  file: FileItem
  onPreview: (file: FileItem) => void
  onDownload: (file: FileItem) => void
  onShare: (file: FileItem) => void
  onAIChat: (fileId: string, fileName: string) => void
  onViewDetails: (file: FileItem) => void
}

export function EnhancedFileItem({ 
  file, 
  onPreview, 
  onDownload, 
  onShare, 
  onAIChat, 
  onViewDetails 
}: EnhancedFileItemProps) {
  const [showAIPreview, setShowAIPreview] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('image')) return '🖼️'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📋'
    return '📁'
  }

  const getAIStatusIcon = () => {
    if (file.ai_processed && file.ready_for_analysis) {
      return <CheckCircle className="w-4 h-4 text-green-400" title="AI Analysis Complete" />
    }
    if (file.ai_processed && !file.ready_for_analysis) {
      return <Clock className="w-4 h-4 text-yellow-400" title="AI Processing..." />
    }
    return <AlertCircle className="w-4 h-4 text-gray-400" title="Not AI Processed" />
  }

  const getDataTypeColor = (dataType?: string) => {
    switch (dataType) {
      case 'sales': return 'bg-green-500/20 text-green-300 border-green-500/50'
      case 'financial': return 'bg-blue-500/20 text-blue-300 border-blue-500/50'
      case 'hr': return 'bg-purple-500/20 text-purple-300 border-purple-500/50'
      case 'operational': return 'bg-orange-500/20 text-orange-300 border-orange-500/50'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/50'
    }
  }

  const parsedSuggestedQuestions = file.ai_suggested_questions 
    ? (typeof file.ai_suggested_questions === 'string' 
        ? JSON.parse(file.ai_suggested_questions) 
        : file.ai_suggested_questions)
    : []

  const parsedInsights = file.ai_insights
    ? (typeof file.ai_insights === 'string'
        ? JSON.parse(file.ai_insights)
        : file.ai_insights)
    : []

  return (
    <div className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-lg p-4 transition-all duration-200">
      {/* Main File Info */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="text-2xl">{getFileIcon(file.mime_type)}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate group-hover:text-cyan-300 transition-colors">
              {file.name}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.size_bytes)}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {new Date(file.created_at).toLocaleDateString()}
              </span>
              {file.ai_data_type && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${getDataTypeColor(file.ai_data_type)}`}>
                    {file.ai_data_type}
                  </span>
                </>
              )}
            </div>
            {file.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {file.description}
              </p>
            )}
          </div>
        </div>

        {/* AI Status */}
        <div className="flex items-center space-x-2">
          {getAIStatusIcon()}
        </div>
      </div>

      {/* AI Summary Preview */}
      {file.ai_processed && file.ai_summary && (
        <div className="mt-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-300">AI Summary</span>
          </div>
          <p className="text-xs text-cyan-100 line-clamp-3">
            {file.ai_summary}
          </p>
          {parsedSuggestedQuestions.length > 0 && (
            <button
              onClick={() => setShowAIPreview(!showAIPreview)}
              className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 flex items-center space-x-1"
            >
              <Lightbulb className="w-3 h-3" />
              <span>{showAIPreview ? 'Hide' : 'Show'} Suggested Questions ({parsedSuggestedQuestions.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Suggested Questions Preview */}
      {showAIPreview && parsedSuggestedQuestions.length > 0 && (
        <div className="mt-2 space-y-1">
          {parsedSuggestedQuestions.slice(0, 3).map((question: string, index: number) => (
            <button
              key={index}
              onClick={() => onAIChat(file.id.toString(), file.name)}
              className="w-full text-left px-3 py-2 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-200 transition-colors"
            >
              💡 {question}
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPreview(file)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDownload(file)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onShare(file)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewDetails(file)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Details"
          >
            <File className="w-4 h-4" />
          </button>
        </div>

        {/* AI Actions */}
        <div className="flex items-center space-x-2">
          {file.ai_processed && (
            <button
              onClick={() => onAIChat(file.id.toString(), file.name)}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/50 rounded-lg transition-all text-xs text-cyan-300 hover:text-cyan-200 flex items-center space-x-1"
              title="Chat with AI about this file"
            >
              <MessageCircle className="w-3 h-3" />
              <span>AI Chat</span>
            </button>
          )}
          {file.ai_processed && parsedInsights.length > 0 && (
            <button
              onClick={() => onAIChat(file.id.toString(), file.name)}
              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg transition-colors text-green-300 hover:text-green-200"
              title={`${parsedInsights.length} AI insights available`}
            >
              <BarChart3 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Processing Indicator */}
      {!file.ai_processed && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Processing for AI analysis..."></div>
        </div>
      )}
    </div>
  )
}