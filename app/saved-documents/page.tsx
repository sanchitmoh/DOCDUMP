"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { Search, DownloadCloud, Trash2, Star, Share2, Sparkles, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"

const savedDocumentsData = [
  {
    id: 1,
    title: "Product Roadmap 2025",
    author: "Product Team",
    date: "2024-11-12",
    type: "DOCX",
    size: "3.1 MB",
    savedDate: "2024-11-18",
  },
  {
    id: 2,
    title: "Marketing Strategy Q4",
    author: "Marketing",
    date: "2024-11-14",
    type: "PPTX",
    size: "4.2 MB",
    savedDate: "2024-11-17",
  },
  {
    id: 5,
    title: "Q4 Financial Report",
    author: "Finance Team",
    date: "2024-11-15",
    type: "PDF",
    size: "2.4 MB",
    savedDate: "2024-11-16",
  },
  {
    id: 8,
    title: "Engineering Best Practices",
    author: "Tech Team",
    date: "2024-11-08",
    type: "PDF",
    size: "2.1 MB",
    savedDate: "2024-11-15",
  },
]

export default function SavedDocuments() {
  const { isAuthenticated, user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("All")
  const [savedDocs, setSavedDocs] = useState(savedDocumentsData)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const filteredDocs = savedDocs.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedType === "All" || doc.type === selectedType),
  )

  const removeSavedDocument = (id: number) => {
    setSavedDocs(savedDocs.filter((doc) => doc.id !== id))
  }

  const handleOpenDetails = (doc: any) => {
    setSelectedDoc(doc)
    setShowDetailModal(true)
  }

  const generateAISummary = async () => {
    setGeneratingSummary(true)
    // Simulate AI generation
    setTimeout(() => {
      setAiSummary(
        `Summary of "${selectedDoc.title}":\n\nThis is a comprehensive ${selectedDoc.type} document that contains important information about ${selectedDoc.title.toLowerCase()}. The document includes key sections covering strategy, implementation, timeline, and expected outcomes. It provides detailed insights and recommendations for organizational decision-making.`,
      )
      setGeneratingSummary(false)
      setShowSummaryModal(true)
    }, 1500)
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/document/${selectedDoc.id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const getFilePreview = (fileType: string) => {
    const previews: Record<string, string> = {
      PDF: "📄 PDF Preview",
      DOCX: "📝 Document Preview",
      XLSX: "📊 Spreadsheet Preview",
      PPTX: "🎯 Presentation Preview",
    }
    return previews[fileType] || "📄 File Preview"
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please login to view your saved documents</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Saved Documents</h1>
            <p className="text-muted-foreground">Your collection of bookmarked documents ({savedDocs.length})</p>
          </div>

          {/* Filters */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search saved documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {["All", "PDF", "DOCX", "PPTX"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      selectedType === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Document List */}
          <div className="space-y-3">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="glass glow-hover p-4 rounded-lg flex items-center justify-between hover:border-primary/50 transition"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground hover:text-primary transition cursor-pointer">
                      {doc.title}
                    </h3>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                      <span>{doc.author}</span>
                      <span>{doc.date}</span>
                      <span>Saved: {doc.savedDate}</span>
                      <span className="px-2 py-1 bg-primary/20 text-primary rounded">{doc.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 ml-4">
                    <span className="text-xs text-muted-foreground hidden md:inline">{doc.size}</span>
                    <button
                      onClick={() => handleOpenDetails(doc)}
                      className="p-2 hover:bg-secondary rounded-lg transition"
                      title="View Details"
                    >
                      <Share2 className="w-5 h-5 text-muted-foreground hover:text-primary" />
                    </button>
                    <button className="p-2 hover:bg-secondary rounded-lg transition">
                      <DownloadCloud className="w-5 h-5 text-muted-foreground hover:text-primary" />
                    </button>
                    <button
                      onClick={() => removeSavedDocument(doc.id)}
                      className="p-2 hover:bg-secondary rounded-lg transition"
                    >
                      <Trash2 className="w-5 h-5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No saved documents found</p>
                <p className="text-sm text-muted-foreground mt-1">Start saving documents from the library</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Document Detail Modal */}
      {showDetailModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{selectedDoc.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDoc.type} • {selectedDoc.size}
                </p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-secondary rounded">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Author</p>
                <p className="font-semibold text-foreground text-sm">{selectedDoc.author}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Saved</p>
                <p className="font-semibold text-foreground text-sm">{selectedDoc.savedDate}</p>
              </div>
            </div>

            {/* Share Section in Detail Modal */}
            <div className="mb-6 pb-6 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Share Document</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Share Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={`${window.location.origin}/document/${selectedDoc.id}`}
                      readOnly
                      className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
                        copiedLink ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary hover:bg-primary/30"
                      }`}
                    >
                      {copiedLink ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Share Via</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg font-medium transition text-sm">
                      📧 Email
                    </button>
                    <button className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 rounded-lg font-medium transition text-sm">
                      👥 Teams
                    </button>
                    <button className="flex items-center justify-center gap-2 px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg font-medium transition text-sm">
                      𝕏 Twitter
                    </button>
                    <button className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg font-medium transition text-sm">
                      🔗 LinkedIn
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={generateAISummary}
              disabled={generatingSummary}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition mb-4 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generatingSummary ? "Generating..." : "Generate AI Summary"}
            </button>

            <div className="flex gap-2 pt-4 border-t border-border">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {showSummaryModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> AI Summary
              </h2>
              <button onClick={() => setShowSummaryModal(false)} className="p-1 hover:bg-secondary rounded">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <p className="text-sm text-foreground whitespace-pre-line">{aiSummary}</p>
            </div>
            <button
              onClick={() => setShowSummaryModal(false)}
              className="w-full px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
