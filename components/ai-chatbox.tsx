"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, Send, Paperclip, MessageCircle, History, FileText, Search, Download } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

interface Message {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
  attachments?: string[]
  visualization?: {
    type: "pie" | "bar" | "stats"
    data: any
  }
}

interface UploadedDocument {
  id: string
  name: string
  category: string
}

export function AIChatbox() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content:
        "Hello! I'm your DocDump AI Assistant. Ask me anything about your documents or how to use DocDump effectively. You can now attach up to 6 files!",
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const attachmentMenuRef = useRef<HTMLDivElement>(null)

  const recentSearches = [
    "Company Policy 2024",
    "Q4 Financial Report",
    "Employee Handbook",
    "Training Materials",
    "Budget Analysis",
    "Security Protocols",
  ]

  const uploadedDocuments: UploadedDocument[] = [
    { id: "1", name: "Q4_Report.pdf", category: "Finance" },
    { id: "2", name: "Policy_Update.docx", category: "HR" },
    { id: "3", name: "Training_Guide.pptx", category: "Training" },
    { id: "4", name: "Market_Analysis.xlsx", category: "Research" },
    { id: "5", name: "Budget_2024.pdf", category: "Finance" },
    { id: "6", name: "ComplianceDocs.docx", category: "Legal" },
  ]

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
    if (!input.trim()) return

    setShowRecentSearches(false)

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
      attachments: selectedAttachments.map((a) => a.name),
    }

    setMessages((prev) => [...prev, userMessage])
    setAllResponses((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    setTimeout(() => {
      let visualization: Message["visualization"] | undefined

      if (input.toLowerCase().includes("statistics") || input.toLowerCase().includes("chart")) {
        visualization = {
          type: "pie",
          data: [
            { name: "Finance", value: 35, fill: "#00d9ff" },
            { name: "HR", value: 25, fill: "#00f5ff" },
            { name: "Training", value: 20, fill: "#0ae8b8" },
            { name: "Research", value: 20, fill: "#2dd9ff" },
          ],
        }
      } else if (input.toLowerCase().includes("performance") || input.toLowerCase().includes("growth")) {
        visualization = {
          type: "bar",
          data: [
            { month: "Jan", documents: 45, views: 120 },
            { month: "Feb", documents: 52, views: 145 },
            { month: "Mar", documents: 48, views: 130 },
            { month: "Apr", documents: 61, views: 165 },
            { month: "May", documents: 55, views: 150 },
          ],
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: `I understand you're asking: "${input}". ${selectedAttachments.length > 0 ? `I've reviewed your ${selectedAttachments.length} attached document(s): ${selectedAttachments.map((a) => a.name).join(", ")}. ` : ""}Here's my analysis based on the document library.`,
        timestamp: new Date(),
        attachments: selectedAttachments.map((a) => a.name),
        visualization,
      }
      setMessages((prev) => [...prev, aiMessage])
      setAllResponses((prev) => [...prev, aiMessage])
      setSelectedAttachments([])
      setIsLoading(false)
    }, 1500)
  }

  const handleQuickSearch = (search: string) => {
    setShowRecentSearches(false)
    setInput(search)
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: search,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setAllResponses((prev) => [...prev, userMessage])
    setIsLoading(true)

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: `Searching for: "${search}". Let me find the most relevant documents from your library for you.`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
      setAllResponses((prev) => [...prev, aiMessage])
      setIsLoading(false)
    }, 1000)
  }

  const handleAttachmentSelect = (doc: UploadedDocument) => {
    if (selectedAttachments.find((a) => a.id === doc.id)) {
      setSelectedAttachments(selectedAttachments.filter((a) => a.id !== doc.id))
    } else if (selectedAttachments.length < 6) {
      setSelectedAttachments([...selectedAttachments, doc])
    }
  }

  const handleDownloadResponses = () => {
    const responseText = allResponses
      .map((msg) => `[${msg.type.toUpperCase()}] ${msg.timestamp.toLocaleString()}\n${msg.content}\n`)
      .join("\n---\n\n")

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(responseText))
    element.setAttribute("download", "chat_responses.txt")
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg hover:shadow-xl hover:shadow-cyan-500/50 transition-all duration-300 flex items-center justify-center group animate-float"
        title="Open AI Chat"
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-110 transition" />
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 max-h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-cyan-500/30 animate-slide-in-up"
          style={{ background: "rgba(15, 20, 37, 0.4)", backdropFilter: "blur(64px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/20 to-blue-500/20">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
              <h3 className="font-semibold text-foreground">DocDump AI</h3>
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
                  <History className="w-4 h-4" />
                  <p className="text-xs font-medium">Recent Searches</p>
                </div>
                <div className="space-y-2">
                  {recentSearches.map((search, idx) => (
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
                  <p className="text-xs font-medium">Uploaded Documents (6 max)</p>
                </div>
                <div className="space-y-2">
                  {uploadedDocuments.slice(0, 4).map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleAttachmentSelect(doc)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition border ${
                        selectedAttachments.find((a) => a.id === doc.id)
                          ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-100"
                          : "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{doc.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{doc.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.type === "user"
                      ? "bg-cyan-500/30 text-foreground border border-cyan-500/50"
                      : "bg-white/10 text-muted-foreground border border-white/20"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  {msg.visualization && (
                    <div className="mt-3 w-full">
                      {msg.visualization.type === "pie" && (
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <Pie
                              data={msg.visualization.data}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {msg.visualization.data.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                      {msg.visualization.type === "bar" && (
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={msg.visualization.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                            <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                            <Tooltip
                              contentStyle={{
                                background: "rgba(15, 20, 37, 0.8)",
                                border: "1px solid rgba(0, 217, 255, 0.2)",
                              }}
                            />
                            <Bar dataKey="documents" fill="#00d9ff" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
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
                  title="Attach documents (up to 6)"
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
                              <span className="text-xs text-muted-foreground ml-2">{doc.category}</span>
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
                placeholder="Ask me anything..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/50"
              />
              <button
                type="button"
                onClick={handleDownloadResponses}
                className="p-2 hover:bg-white/10 rounded-lg transition text-muted-foreground"
                title="Download all responses"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 rounded-lg transition disabled:opacity-50 text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Attachments: {selectedAttachments.length}/6</p>
          </form>
        </div>
      )}
    </>
  )
}
