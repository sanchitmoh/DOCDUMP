'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  User, 
  Folder, 
  Tag, 
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { useToastContext } from '@/context/toast-context'

interface FileDetailsModalProps {
  fileId: number
  isOpen: boolean
  onClose: () => void
}

interface FileDetails {
  id: number
  name: string
  description?: string
  ai_description?: string
  file_type: string
  mime_type: string
  size_bytes: number
  size_hr: string
  visibility: string
  view_count: number
  download_count: number
  created_at: string
  updated_at: string
  creator_name?: string
  folder_name?: string
  tags?: string[]
  allow_download: boolean
}

interface AISummary {
  summary: string
  file: {
    id: number
    name: string
    file_type: string
    mime_type: string
  }
}

export function FileDetailsModal({ fileId, isOpen, onClose }: FileDetailsModalProps) {
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToastContext()

  useEffect(() => {
    if (isOpen && fileId) {
      fetchFileDetails()
    }
  }, [isOpen, fileId])

  const fetchFileDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/files/${fileId}`)
      const data = await response.json()
      
      if (data.success) {
        setFileDetails(data.file)
        
        // Track view
        await fetch(`/api/files/${fileId}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'view' })
        })
      } else {
        setError(data.error || 'Failed to load file details')
      }
    } catch (err) {
      setError('Failed to load file details')
    } finally {
      setLoading(false)
    }
  }

  const generateAISummary = async () => {
    setAiLoading(true)
    showToast("🤖 Generating AI summary...", "info", 5000)
    
    try {
      const response = await fetch(`/api/files/${fileId}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (data.success && data.summary) {
        setAiSummary(data.summary)
        showToast("🎉 AI summary generated successfully!", "success", 5000)
      } else {
        const errorMsg = data.error || 'Failed to generate AI summary'
        setError(errorMsg)
        showToast(`❌ AI summary failed: ${errorMsg}`, "error", 6000)
      }
    } catch (err) {
      const errorMsg = 'Failed to generate AI summary'
      setError(errorMsg)
      showToast(`❌ ${errorMsg}`, "error", 6000)
    } finally {
      setAiLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      showToast("📥 Starting download...", "info", 3000)
      
      // Track download
      await fetch(`/api/files/${fileId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download' })
      })
      
      // Trigger download
      window.open(`/api/files/download/${fileId}`, '_blank')
      
      // Update view count in UI
      if (fileDetails) {
        setFileDetails({
          ...fileDetails,
          download_count: (fileDetails.download_count || 0) + 1
        })
      }
      
      showToast("✅ Download started successfully!", "success", 4000)
    } catch (err) {
      setError('Failed to download file')
      showToast("❌ Download failed", "error", 5000)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">File Details</h2>
              <p className="text-gray-600">View file information and generate AI insights</p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading file details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {fileDetails && (
            <div className="space-y-6">
              {/* File Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    File Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Original Name</label>
                      <p className="text-lg font-semibold">{fileDetails.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">MIME Type</label>
                      <p className="text-sm text-gray-900">{fileDetails.mime_type}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">File Size</label>
                      <p className="text-sm text-gray-900">{formatFileSize(fileDetails.size_bytes)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Visibility</label>
                      <Badge variant={fileDetails.visibility === 'public' ? 'default' : 'secondary'}>
                        {fileDetails.visibility}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <Eye className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm">Views: {fileDetails.view_count || 0}</span>
                    </div>
                    <div className="flex items-center">
                      <Download className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm">Downloads: {fileDetails.download_count || 0}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm">Created: {formatDate(fileDetails.created_at)}</span>
                    </div>
                  </div>

                  {fileDetails.creator_name && (
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm">Uploaded by: {fileDetails.creator_name}</span>
                    </div>
                  )}

                  {fileDetails.folder_name && (
                    <div className="flex items-center">
                      <Folder className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm">Folder: {fileDetails.folder_name}</span>
                    </div>
                  )}

                  {fileDetails.tags && fileDetails.tags.length > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <Tag className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-sm font-medium">Tags:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fileDetails.tags.map((tag, index) => (
                          <Badge key={index} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              {(fileDetails.description || fileDetails.ai_description) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fileDetails.description && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">User Description:</h4>
                        <p className="text-gray-700">{fileDetails.description}</p>
                      </div>
                    )}
                    {fileDetails.ai_description && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center">
                          <Sparkles className="h-4 w-4 mr-1" />
                          AI Description:
                        </h4>
                        <p className="text-gray-700">{fileDetails.ai_description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Sparkles className="h-5 w-5 mr-2" />
                      AI-Generated Document Summary
                    </div>
                    <Button 
                      onClick={generateAISummary} 
                      disabled={aiLoading}
                      size="sm"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Summary
                        </>
                      )}
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Get an AI-powered summary of the document content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {aiSummary ? (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-gray-800 whitespace-pre-wrap">{aiSummary}</p>
                      </div>
                      <Button 
                        onClick={() => {
                          navigator.clipboard.writeText(aiSummary)
                          showToast("📋 AI summary copied to clipboard!", "success", 3000)
                        }}
                        variant="outline" 
                        size="sm"
                        className="w-full"
                      >
                        Copy Summary
                      </Button>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">
                      Click "Generate Summary" to create an AI-powered summary of this document.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                {fileDetails.allow_download && (
                  <Button onClick={handleDownload} className="flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                )}
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}