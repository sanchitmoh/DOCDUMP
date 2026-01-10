"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { X, Send, Paperclip, MessageCircle, History, FileText, Search, Download, Brain, BarChart3, TrendingUp, Lightbulb } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts"

interface Message {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
  attachments?: string[]
  sources?: string[]
  charts?: any[]
  insights?: string[]
  reasoning?: string
  fileContext?: {
    fileId: string
    fileName: string
  }
  metadata?: {
    hasVisualizations: boolean
    sourcesUsed: number
    confidenceLevel: 'high' | 'medium' | 'low'
  }
}

interface UploadedDocument {
  id: string
  name: string
  category: string
  ai_processed?: boolean
  ai_summary?: string
  ai_data_type?: string
  ready_for_analysis?: boolean
  ai_suggested_questions?: string[]
}

interface User {
  id: number
  orgId: number
  name: string
  email: string
}

interface EnhancedAIChatboxProps {
  user?: User
  selectedFileId?: string
  selectedFileName?: string
  onFileSelect?: (fileId: string, fileName: string) => void
}

export function EnhancedAIChatbox({ user, selectedFileId, selectedFileName, onFileSelect }: EnhancedAIChatboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: "Hello! I'm your enhanced DocDump AI Assistant. I can analyze your documents, generate insights, create charts, and answer complex questions about your data. Upload files and ask me anything!",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showRecentSearches, setShowRecentSearches] = useState(true)
  const [selectedAttachments, setSelectedAttachments] = useState<UploadedDocument[]>([])
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [allResponses, setAllResponses] = useState<Message[]>([])
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])
  const [conversationId, setConversationId] = useState<string>(`conv_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const attachmentMenuRef = useRef<HTMLDivElement>(null)

  const recentSearches = [
    "What are the key insights from my uploaded files?",
    "Show me sales trends over time",
    "Analyze the financial performance",
    "Compare Q2 vs Q3 results",
    "What anomalies do you detect?",
    "Generate a summary dashboard",
  ]

  // Load user's uploaded documents
  useEffect(() => {
    if (user) {
      loadUserDocuments()
      loadSuggestedQuestions()
    }
  }, [user])

  // Load suggested questions when file is selected
  useEffect(() => {
    if (selectedFileId) {
      loadFileSpecificSuggestions(selectedFileId)
    }
  }, [selectedFileId])

  const loadUserDocuments = async () => {
    try {
      // Use the recent files API to get user's recent documents
      const response = await fetch(`/api/files/recent?limit=20`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.files) {
          const docs: UploadedDocument[] = data.files.map((file: any) => ({
            id: file.id.toString(),
            name: file.name,
            category: file.ai_data_type || file.file_type || 'General',
            ai_processed: file.ai_processed,
            ai_summary: file.ai_summary,
            ai_data_type: file.ai_data_type,
            ready_for_analysis: file.ready_for_analysis,
            ai_suggested_questions: file.ai_suggested_questions ? 
              (typeof file.ai_suggested_questions === 'string' ? 
                JSON.parse(file.ai_suggested_questions) : 
                file.ai_suggested_questions) : []
          }))
          setUploadedDocuments(docs)
        }
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  const loadSuggestedQuestions = async () => {
    try {
      const response = await fetch(`/api/ai-assistant/chat?userId=${user?.id}&orgId=${user?.orgId}&type=suggestions`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuggestedQuestions(data.data.suggestions || [])
        }
      }
    } catch (error) {
      console.error('Error loading suggestions:', error)
    }
  }

  const loadFileSpecificSuggestions = async (fileId: string) => {
    try {
      const response = await fetch(`/api/ai-assistant/chat?fileId=${fileId}&orgId=${user?.orgId}&type=suggestions`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuggestedQuestions(data.data.suggestions || [])
        }
      }
    } catch (error) {
      console.error('Error loading file suggestions:', error)
    }
  }

  const filteredDocuments = uploadedDocuments.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false)
      }
    }

    if (showAttachmentMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showAttachmentMenu])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !user) return

    setShowRecentSearches(false)

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
      attachments: selectedAttachments.map((a) => a.name),
      fileContext: selectedFileId ? { fileId: selectedFileId, fileName: selectedFileName || 'Unknown' } : undefined
    }

    setMessages((prev) => [...prev, userMessage])
    setAllResponses((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsLoading(true)

    try {
      // Call the enhanced AI assistant API
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          userId: user.id,
          orgId: user.orgId,
          conversationId,
          fileId: selectedFileId,
          fileName: selectedFileName,
          documentIds: selectedAttachments.map(a => a.id),
          contextType: 'General',
          conversationHistory: messages.slice(-10) // Last 10 messages for context
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.success) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: result.data.response,
            timestamp: new Date(),
            sources: result.data.sources || [],
            charts: result.data.charts || [],
            insights: result.data.insights || [],
            reasoning: result.data.reasoning,
            fileContext: result.data.fileContext,
            metadata: result.data.metadata,
            attachments: selectedAttachments.map((a) => a.name)
          }
          
          setMessages((prev) => [...prev, aiMessage])
          setAllResponses((prev) => [...prev, aiMessage])
          
          // Update conversation ID if provided
          if (result.data.conversationId) {
            setConversationId(result.data.conversationId)
          }
        } else {
          throw new Error(result.error || 'AI request failed')
        }
      } else {
        throw new Error('Network error')
      }
    } catch (error) {
      console.error('AI Chat Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      setAllResponses((prev) => [...prev, errorMessage])
    } finally {
      setSelectedAttachments([])
      setIsLoading(false)
    }
  }

  const handleQuickSearch = (search: string) => {
    setInput(search)
    // Auto-submit the quick search
    setTimeout(() => {
      const form = document.querySelector('form') as HTMLFormElement
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      }
    }, 100)
  }

  const handleAttachmentSelect = (doc: UploadedDocument) => {
    if (selectedAttachments.find((a) => a.id === doc.id)) {
      setSelectedAttachments(selectedAttachments.filter((a) => a.id !== doc.id))
    } else if (selectedAttachments.length < 6) {
      setSelectedAttachments([...selectedAttachments, doc])
    }
  }

  const handleFileContextSelect = (doc: UploadedDocument) => {
    if (onFileSelect) {
      onFileSelect(doc.id, doc.name)
    }
    setShowAttachmentMenu(false)
  }

  const handleDownloadResponses = () => {
    const responseText = allResponses
      .map((msg) => {
        let text = `[${msg.type.toUpperCase()}] ${msg.timestamp.toLocaleString()}\n${msg.content}\n`
        
        if (msg.sources && msg.sources.length > 0) {
          text += `\nSources: ${msg.sources.join(', ')}\n`
        }
        
        if (msg.insights && msg.insights.length > 0) {
          text += `\nInsights:\n${msg.insights.map(insight => `- ${insight}`).join('\n')}\n`
        }
        
        return text
      })
      .join("\n---\n\n")

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(responseText))
    element.setAttribute("download", `ai_chat_${new Date().toISOString().split('T')[0]}.txt`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const renderChart = (chart: any) => {
    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(15, 20, 37, 0.8)",
                  border: "1px solid rgba(0, 217, 255, 0.2)",
                }}
              />
              <Bar dataKey="value" fill="#00d9ff" />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="x" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(15, 20, 37, 0.8)",
                  border: "1px solid rgba(0, 217, 255, 0.2)",
                }}
              />
              <Line type="monotone" dataKey="y" stroke="#00d9ff" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chart.data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label
              >
                {chart.data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={chart.config?.colors?.[index] || `hsl(${index * 45}, 70%, 60%)`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )
      default:
        return <div className="text-xs text-muted-foreground">Chart type not supported</div>
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg hover:shadow-xl hover:shadow-cyan-500/50 transition-all duration-300 flex items-center justify-center group animate-float"
        title="Open Enhanced AI Chat"
      >
        <Brain className="w-6 h-6 group-hover:scale-110 transition" />
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 max-h-[700px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-cyan-500/30 animate-slide-in-up"
          style={{ background: "rgba(15, 20, 37, 0.4)", backdropFilter: "blur(64px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/20 to-blue-500/20">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
              <h3 className="font-semibold text-foreground">Enhanced AI Assistant</h3>
              {selectedFileId && (
                <div className="text-xs bg-cyan-500/20 px-2 py-1 rounded border border-cyan-500/50">
                  📄 {selectedFileName}
                </div>
              )}
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {showRecentSearches && messages.length === 1 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Lightbulb className="w-4 h-4" />
                  <p className="text-xs font-medium">Suggested Questions</p>
                </div>
                <div className="space-y-2">
                  {(suggestedQuestions.length > 0 ? suggestedQuestions : recentSearches).slice(0, 6).map((search, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickSearch(search)}
                      className="w-full text-left px-3 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg text-foreground transition border border-white/10"
                    >
                      {search}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2 text-muted-foreground mt-4">
                  <FileText className="w-4 h-4" />
                  <p className="text-xs font-medium">Your Documents</p>
                </div>
                <div className="space-y-2">
                  {uploadedDocuments.slice(0, 4).map((doc) => (
                    <div key={doc.id} className="space-y-1">
                      <button
                        onClick={() => handleFileContextSelect(doc)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition border ${
                          selectedFileId === doc.id
                            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-100"
                            : "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium">{doc.name}</span>
                          <div className="flex items-center space-x-1">
                            {doc.ai_processed && (
                              <Brain className="w-3 h-3 text-cyan-400" title="AI Processed" />
                            )}
                            <span className="text-xs text-muted-foreground">{doc.category}</span>
                          </div>
                        </div>
                      </button>
                      {doc.ai_processed && doc.ai_suggested_questions && doc.ai_suggested_questions.length > 0 && (
                        <div className="ml-3 space-y-1">
                          {doc.ai_suggested_questions.slice(0, 2).map((question, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => {
                                handleFileContextSelect(doc)
                                setTimeout(() => handleQuickSearch(question), 100)
                              }}
                              className="w-full text-left px-2 py-1 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 rounded text-cyan-200 transition border border-cyan-500/30"
                            >
                              💡 {question}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-sm px-4 py-3 rounded-lg ${
                    msg.type === "user"
                      ? "bg-cyan-500/30 text-foreground border border-cyan-500/50"
                      : "bg-white/10 text-muted-foreground border border-white/20"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  
                  {/* File Context Indicator */}
                  {msg.fileContext && (
                    <div className="mt-2 text-xs bg-blue-500/20 px-2 py-1 rounded border border-blue-500/50">
                      📄 Based on: {msg.fileContext.fileName}
                    </div>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 p-2 bg-white/5 rounded border border-white/10">
                      <div className="flex items-center space-x-1 mb-1">
                        <FileText className="w-3 h-3" />
                        <span className="text-xs font-medium">Sources:</span>
                      </div>
                      <ul className="text-xs space-y-1">
                        {msg.sources.map((source, i) => (
                          <li key={i} className="text-cyan-200">• {source}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Charts */}
                  {msg.charts && msg.charts.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {msg.charts.map((chart, i) => (
                        <div key={i} className="bg-white/5 p-3 rounded border border-white/10">
                          <div className="flex items-center space-x-1 mb-2">
                            <BarChart3 className="w-3 h-3" />
                            <span className="text-xs font-medium">{chart.title}</span>
                          </div>
                          {renderChart(chart)}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Insights */}
                  {msg.insights && msg.insights.length > 0 && (
                    <div className="mt-3 p-2 bg-green-500/10 rounded border border-green-500/30">
                      <div className="flex items-center space-x-1 mb-1">
                        <TrendingUp className="w-3 h-3" />
                        <span className="text-xs font-medium text-green-200">Key Insights:</span>
                      </div>
                      <ul className="text-xs space-y-1">
                        {msg.insights.map((insight, i) => (
                          <li key={i} className="text-green-100">💡 {insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metadata */}
                  {msg.metadata && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Confidence: {msg.metadata.confidenceLevel} • Sources: {msg.metadata.sourcesUsed}
                      {msg.metadata.hasVisualizations && " • Charts included"}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-4 py-2 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Selected Attachments */}
          {selectedAttachments.length > 0 && (
            <div className="px-4 py-2 flex flex-wrap gap-2 bg-white/5 border-t border-white/10 max-h-16 overflow-y-auto">
              {selectedAttachments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-1 bg-cyan-500/20 border border-cyan-500/50 px-2 py-1 rounded text-xs"
                >
                  <span className="text-cyan-200 truncate">{doc.name}</span>
                  <button onClick={() => handleAttachmentSelect(doc)} className="text-cyan-400 hover:text-cyan-300">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 space-y-2">
            <div className="flex items-center space-x-2">
              <div className="relative" ref={attachmentMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className="p-2 hover:bg-white/10 rounded-lg transition text-muted-foreground"
                  title="Select documents for analysis"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {showAttachmentMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-card border border-white/20 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    <div className="p-3 border-b border-white/10 sticky top-0 bg-card">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search documents..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      {filteredDocuments.length > 0 ? (
                        filteredDocuments.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => handleAttachmentSelect(doc)}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition border ${
                              selectedAttachments.find((a) => a.id === doc.id)
                                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-100"
                                : "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate font-medium">{doc.name}</span>
                              <div className="flex items-center space-x-1">
                                {doc.ai_processed && (
                                  <Brain className="w-3 h-3 text-cyan-400" title="AI Processed" />
                                )}
                                <span className="text-xs text-muted-foreground ml-2">{doc.category}</span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground p-2">No documents found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={selectedFileId ? "Ask about this file..." : "Ask me anything..."}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/50"
              />
              <button
                type="button"
                onClick={handleDownloadResponses}
                className="p-2 hover:bg-white/10 rounded-lg transition text-muted-foreground"
                title="Download conversation"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading || !user}
                className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 rounded-lg transition disabled:opacity-50 text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Attachments: {selectedAttachments.length}/6</span>
              {selectedFileId && <span>Context: {selectedFileName}</span>}
            </div>
          </form>
        </div>
      )}
    </>
  )
}