"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState, useEffect } from "react"
import { Search, DownloadCloud, Trash2, Star, Share2, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"

interface SavedDocument {
  id: number
  title: string
  author: string
  date: string
  type: string
  size: string
  savedDate: string
  department?: string
}

export default function SavedDocuments() {
  const { isAuthenticated, user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("All")
  const [savedDocs, setSavedDocs] = useState<SavedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<SavedDocument | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchSavedDocuments()
    }
  }, [isAuthenticated])

  const fetchSavedDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/saved-documents', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setSavedDocs(data.savedDocuments || [])
      } else {
        console.error('Failed to fetch saved documents')
      }
    } catch (error) {
      console.error('Error fetching saved documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDocs = savedDocs.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedType === "All" || doc.type === selectedType),
  )

  const removeSavedDocument = async (id: number) => {
    try {
      const response = await fetch('/api/saved-documents', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileId: id })
      })

      if (response.ok) {
        setSavedDocs(savedDocs.filter((doc) => doc.id !== id))
      } else {
        console.error('Failed to remove saved document')
      }
    } catch (error) {
      console.error('Error removing saved document:', error)
    }
  }

  const handleOpenDetails = (doc: SavedDocument) => {
    setSelectedDoc(doc)
    setShowDetailModal(true)
  }

  const handleCopyLink = () => {
    if (selectedDoc) {
      const url = `${window.location.origin}/document/${selectedDoc.id}`
      navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
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
                {["All", "PDF", "DOCX", "PPTX", "XLSX"].map((type) => (
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
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass p-4 rounded-lg animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
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
                        <span>{new Date(doc.date).toLocaleDateString()}</span>
                        <span>Saved: {new Date(doc.savedDate).toLocaleDateString()}</span>
                        <span className="px-2 py-1 bg-primary/20 text-primary rounded">{doc.type}</span>
                        {doc.department && (
                          <span className="px-2 py-1 bg-secondary rounded">{doc.department}</span>
                        )}
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
          )}
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
                <p className="font-semibold text-foreground text-sm">
                  {new Date(selectedDoc.savedDate).toLocaleDateString()}
                </p>
              </div>
              {selectedDoc.department && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Department</p>
                  <p className="font-semibold text-foreground text-sm">{selectedDoc.department}</p>
                </div>
              )}
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <p className="font-semibold text-foreground text-sm">
                  {new Date(selectedDoc.date).toLocaleDateString()}
                </p>
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
              </div>
            </div>

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

      <Footer />
    </div>
  )
}
