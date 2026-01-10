"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
  Star,
  Download,
  Share2,
  Eye,
  Calendar,
  User,
  FileText,
  Tag,
  Sparkles,
  Clock,
  BookOpen,
  Loader,
  X,
  Mail,
  LinkIcon,
  Facebook,
  Linkedin,
  Twitter,
} from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"

interface DocumentDetails {
  id: string
  title: string
  description: string
  author: string
  date: string
  views: number
  downloads: number
  type: string
  size: string
  category: string
  tags: string[]
  visibility: string
  isActive: boolean
  aiDescription?: string
  uploader: {
    name: string
    department: string
    email: string
    avatar: string
    timePosted: string
    organization: string
  }
  mimeType: string
  createdAt: string
  updatedAt: string
}

interface RelatedDocument {
  id: string
  title: string
  author: string
  date: string
  department: string
}

// Document Preview Component
function DocumentPreview({ document }: { document: DocumentDetails }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generatePreviewUrl()
  }, [document])

  const generatePreviewUrl = async () => {
    try {
      setLoading(true)
      setPreviewError(null)

      // For different file types, we'll use different preview methods
      const mimeType = document.mimeType?.toLowerCase() || ''
      const fileType = document.type?.toLowerCase() || ''

      if (mimeType.includes('pdf')) {
        // For PDFs, we can use the browser's built-in PDF viewer
        const response = await fetch(`/api/files/download/${document.id}`, {
          credentials: 'include'
        })
        
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
        } else {
          setPreviewError('Failed to load PDF preview')
        }
      } else if (mimeType.includes('image/')) {
        // For images, show them directly
        const response = await fetch(`/api/files/download/${document.id}`, {
          credentials: 'include'
        })
        
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
        } else {
          setPreviewError('Failed to load image preview')
        }
      } else if (mimeType.includes('text/') || fileType === 'txt') {
        // For text files, show content directly
        const response = await fetch(`/api/files/download/${document.id}`, {
          credentials: 'include'
        })
        
        if (response.ok) {
          const text = await response.text()
          setPreviewUrl(`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`)
        } else {
          setPreviewError('Failed to load text preview')
        }
      } else {
        // For other file types, show a message that preview is not available
        setPreviewError('Preview not available for this file type')
      }
    } catch (error) {
      console.error('Preview error:', error)
      setPreviewError('Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg p-8 text-center flex items-center justify-center min-h-80">
        <div>
          <Loader className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading preview...</p>
        </div>
      </div>
    )
  }

  if (previewError) {
    return (
      <div className="bg-card rounded-lg p-8 text-center flex items-center justify-center min-h-80">
        <div>
          <FileText className="w-16 h-16 text-primary/50 mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">{document.type} Document</p>
          <p className="text-sm text-muted-foreground mb-4">{previewError}</p>
          <button
            onClick={() => window.open(`/api/files/download/${document.id}`, '_blank')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
          >
            Open File
          </button>
        </div>
      </div>
    )
  }

  const mimeType = document.mimeType?.toLowerCase() || ''

  if (mimeType.includes('pdf')) {
    return (
      <div className="bg-card rounded-lg overflow-hidden min-h-80">
        <iframe
          src={previewUrl || ''}
          className="w-full h-96 border-0"
          title={`Preview of ${document.title}`}
        />
        <div className="p-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            PDF Preview • <button 
              onClick={() => window.open(previewUrl || '', '_blank')}
              className="text-primary hover:underline"
            >
              Open in new tab
            </button>
          </p>
        </div>
      </div>
    )
  }

  if (mimeType.includes('image/')) {
    return (
      <div className="bg-card rounded-lg overflow-hidden">
        <div className="flex items-center justify-center p-4">
          <img
            src={previewUrl || ''}
            alt={document.title}
            className="max-w-full max-h-96 object-contain rounded"
          />
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            Image Preview • {document.size}
          </p>
        </div>
      </div>
    )
  }

  if (mimeType.includes('text/')) {
    return (
      <div className="bg-card rounded-lg overflow-hidden">
        <iframe
          src={previewUrl || ''}
          className="w-full h-96 border-0 bg-white"
          title={`Preview of ${document.title}`}
        />
        <div className="p-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            Text Preview • {document.size}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg p-8 text-center flex items-center justify-center min-h-80">
      <div>
        <FileText className="w-16 h-16 text-primary/50 mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">{document.type} Document</p>
        <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type</p>
        <button
          onClick={() => window.open(`/api/files/download/${document.id}`, '_blank')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
        >
          Download File
        </button>
      </div>
    </div>
  )
}

export default function DocumentViewer({ params }: { params: Promise<{ id: string }> }) {
  const { isAuthenticated } = useAuth()
  const [document, setDocument] = useState<DocumentDetails | null>(null)
  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [showAISummary, setShowAISummary] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [documentId, setDocumentId] = useState<string | null>(null)

  // Resolve params Promise
  useEffect(() => {
    params.then(({ id }) => {
      setDocumentId(id)
    })
  }, [params])

  useEffect(() => {
    if (isAuthenticated && documentId) {
      fetchDocumentDetails()
    }
  }, [isAuthenticated, documentId])

  const fetchDocumentDetails = async () => {
    if (!documentId) return
    
    try {
      setLoading(true)
      setError(null)
      
      console.log('Fetching document details for ID:', documentId)
      
      const response = await fetch(`/api/files/${documentId}/details`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDocument(data.document)
          setRelatedDocuments(data.relatedDocuments || [])
          
          // Set AI summary if available
          if (data.document.aiDescription) {
            setAiSummary(data.document.aiDescription)
            setShowAISummary(true)
          }
        } else {
          setError(data.error || 'Failed to load document')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load document')
      }
    } catch (error) {
      console.error('Error fetching document details:', error)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSummary = async () => {
    if (!document || !documentId) return
    
    setLoadingSummary(true)
    try {
      const response = await fetch(`/api/files/${documentId}/ai-summary`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.summary) {
          setAiSummary(data.summary)
          setShowAISummary(true)
        } else {
          alert('Failed to generate summary: ' + (data.error || 'Unknown error'))
        }
      } else {
        const errorData = await response.json()
        alert('Failed to generate summary: ' + (errorData.error || 'Unknown error'))
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to generate summary. Please try again.")
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleCopyLink = () => {
    if (!documentId) return
    const url = `${window.location.origin}/document/${documentId}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDownload = async (format: string) => {
    if (!document) return
    
    try {
      const response = await fetch(`/api/files/download/${document.id}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = window.document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = document.title
        window.document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        setShowDownloadModal(false)
      } else {
        alert('Failed to download file')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download file')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please login to view this document</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
            >
              Login
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading document...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error || 'Document not found'}</p>
            <Link
              href="/library"
              className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
            >
              Back to Library
            </Link>
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
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <FileText className="w-6 h-6 text-primary" />
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                    {document.category}
                  </span>
                  {document.aiDescription && (
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm font-medium flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>AI-Enhanced</span>
                    </span>
                  )}
                </div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  {document.title}
                </h1>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => setIsSaved(!isSaved)}
                  className={`p-3 rounded-lg transition ${
                    isSaved
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title="Save document"
                >
                  <Star className="w-5 h-5" fill={isSaved ? "currentColor" : "none"} />
                </button>

                <button
                  onClick={() => setShowShareModal(true)}
                  className="p-3 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition"
                  title="Share document"
                >
                  <Share2 className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowDownloadModal(true)}
                  className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 transition rounded-lg text-white font-medium flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <div className="glass rounded-lg p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1 flex items-center space-x-1">
                  <User className="w-4 h-4" />
                  <span>Author</span>
                </p>
                <p className="font-medium text-foreground">{document.author}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1 flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Published</span>
                </p>
                <p className="font-medium text-foreground">{new Date(document.date).toLocaleDateString()}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1 flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>Views</span>
                </p>
                <p className="font-medium text-foreground">{document.views.toLocaleString()}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1 flex items-center space-x-1">
                  <FileText className="w-4 h-4" />
                  <span>Size</span>
                </p>
                <p className="font-medium text-foreground">{document.size}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1 flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>Type</span>
                </p>
                <p className="font-medium text-foreground">{document.type}</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-lg p-6 mb-8 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-lg font-semibold text-primary">
                  {document.uploader.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{document.uploader.name}</p>
                  <p className="text-sm text-muted-foreground">{document.uploader.department} Department</p>
                  <p className="text-xs text-muted-foreground">{document.uploader.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition text-sm font-medium"
              >
                View Profile
              </button>
            </div>
          </div>

          {/* AI Summary Section */}
          <div
            className="rounded-lg p-6 mb-8 border-l-4 border-cyan-500"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(64px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderLeft: "4px solid rgb(6, 182, 212)",
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">AI-Generated Summary</h2>
              </div>
              <div className="flex gap-2">
                {!aiSummary && (
                  <button
                    onClick={handleGenerateSummary}
                    disabled={loadingSummary}
                    className="text-sm px-3 py-1 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded transition disabled:opacity-50 flex items-center gap-1"
                  >
                    {loadingSummary && <Loader className="w-4 h-4 animate-spin" />}
                    {loadingSummary ? "Generating..." : "Generate Summary"}
                  </button>
                )}
                {aiSummary && (
                  <button
                    onClick={() => setShowAISummary(!showAISummary)}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition"
                  >
                    {showAISummary ? "Hide" : "Show"}
                  </button>
                )}
              </div>
            </div>

            {showAISummary && aiSummary && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-muted-foreground leading-relaxed">{aiSummary}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="glass rounded-lg p-8 mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Description</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">{document.description}</p>

            {/* Tags */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground flex items-center space-x-2">
                <Tag className="w-4 h-4" />
                <span>Tags</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag) => (
                  <button
                    key={tag}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Document Preview Area */}
          <div className="glass rounded-lg p-8 mb-8 min-h-96">
            {document ? (
              <DocumentPreview document={document} />
            ) : (
              <div className="bg-card rounded-lg p-8 text-center flex items-center justify-center min-h-80">
                <div>
                  <FileText className="w-16 h-16 text-primary/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">Loading document...</p>
                </div>
              </div>
            )}
          </div>

          {/* Related Documents */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Related Documents</h2>
            {relatedDocuments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {relatedDocuments.slice(0, 3).map((doc) => (
                  <Link key={doc.id} href={`/document/${doc.id}`}>
                    <div className="glass glow-hover p-4 rounded-lg cursor-pointer group">
                      <FileText className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition" />
                      <h3 className="font-medium text-foreground group-hover:text-primary transition line-clamp-2">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2">
                        {doc.author} • {new Date(doc.date).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No related documents found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Employee Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-2xl">
                  {document.uploader.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">{document.uploader.name}</p>
                  <p className="text-sm text-cyan-400">{document.uploader.department} Department</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-foreground font-medium">{document.uploader.email}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Time Posted</p>
                <p className="text-foreground font-medium">{new Date(document.uploader.timePosted).toLocaleString()}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Organization</p>
                <p className="text-foreground font-medium">{document.uploader.organization}</p>
              </div>

              <button className="w-full mt-6 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition font-medium">
                Connect with Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Share Document</h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-card/50 transition text-foreground"
              >
                <LinkIcon className="w-5 h-5" />
                <span className="flex-1 text-left">{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>

              <button className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-card/50 transition text-foreground">
                <Mail className="w-5 h-5" />
                <span className="flex-1 text-left">Share via Email</span>
              </button>

              <button className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-card/50 transition text-blue-400">
                <Facebook className="w-5 h-5" />
                <span className="flex-1 text-left">Share on Facebook</span>
              </button>

              <button className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-card/50 transition text-blue-600">
                <Linkedin className="w-5 h-5" />
                <span className="flex-1 text-left">Share on LinkedIn</span>
              </button>

              <button className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-card/50 transition text-cyan-400">
                <Twitter className="w-5 h-5" />
                <span className="flex-1 text-left">Share on Twitter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Download Document</h2>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleDownload("PDF")}
                className="w-full p-3 border border-border rounded-lg hover:bg-cyan-500/10 hover:border-cyan-500 transition text-foreground text-left font-medium flex items-center justify-between group"
              >
                <span>Download as PDF</span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition">
                  Default
                </span>
              </button>

              <button
                onClick={() => handleDownload("DOCX")}
                className="w-full p-3 border border-border rounded-lg hover:bg-blue-500/10 hover:border-blue-500 transition text-foreground text-left font-medium"
              >
                <span>Download as DOCX</span>
              </button>

              <button
                onClick={() => handleDownload("TXT")}
                className="w-full p-3 border border-border rounded-lg hover:bg-green-500/10 hover:border-green-500 transition text-foreground text-left font-medium"
              >
                <span>Download as TXT</span>
              </button>

              <button
                onClick={() => handleDownload("XLSX")}
                className="w-full p-3 border border-border rounded-lg hover:bg-emerald-500/10 hover:border-emerald-500 transition text-foreground text-left font-medium"
              >
                <span>Download as XLSX</span>
              </button>

              <button
                onClick={() => handleDownload("PPT")}
                className="w-full p-3 border border-border rounded-lg hover:bg-orange-500/10 hover:border-orange-500 transition text-foreground text-left font-medium"
              >
                <span>Download as PPT</span>
              </button>

              <button
                onClick={() => handleDownload("ZIP")}
                className="w-full p-3 border border-border rounded-lg hover:bg-purple-500/10 hover:border-purple-500 transition text-foreground text-left font-medium"
              >
                <span>Download as ZIP (All Formats)</span>
              </button>

              <button
                onClick={() => handleDownload("JSON")}
                className="w-full p-3 border border-border rounded-lg hover:bg-pink-500/10 hover:border-pink-500 transition text-foreground text-left font-medium"
              >
                <span>Download as JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
