"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EnhancedFileItem } from "@/components/enhanced-file-item"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { useFileContext } from "@/context/file-context"
import { useToast } from "@/hooks/use-toast"
import { useToastContext } from "@/context/toast-context"
import {
  Folder,
  File,
  Plus,
  Trash2,
  Upload,
  ChevronRight,
  Home,
  Search,
  X,
  Eye,
  Share2,
  Download,
  Tag,
  Mail,
  MapPin,
  Clock,
  Loader2,
  AlertCircle,
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
}

interface FolderItem {
  id: number
  name: string
  parent_id: number | null
  description?: string
  department?: string
  created_at: string
  created_by: number
  files_count?: number
  subfolder_count?: number
  total_size_bytes?: number
}

export default function Library() {
  const { user, isAuthenticated } = useAuth()
  const { setSelectedFile: setAISelectedFile } = useFileContext()
  const { addToast } = useToast()
  const { showToast } = useToastContext()
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderDescription, setNewFolderDescription] = useState("")
  const [newFolderDepartment, setNewFolderDepartment] = useState("")
  const [breadcrumb, setBreadcrumb] = useState<FolderItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileItem | null>(null)
  const [showAISummaryModal, setShowAISummaryModal] = useState(false)
  const [aiSummary, setAiSummary] = useState<string>('')
  const [loadingAISummary, setLoadingAISummary] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState<string>('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFormData, setUploadFormData] = useState({
    title: "",
    description: "",
    tags: "",
    department: "",
    visibility: "private",
  })

  // Download function
  const handleDownload = async (format?: string) => {
    if (!selectedFile) return

    try {
      const response = await fetch(`/api/files/download/${selectedFile.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Download failed')
      }

      // Get the blob from response
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedFile.name
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setShowDownloadModal(false)
      showToast('File downloaded successfully', 'success')
    } catch (error) {
      console.error('Download error:', error)
      showToast('Failed to download file', 'error')
    }
  }
  const [uploading, setUploading] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [departments, setDepartments] = useState<Array<{id: number, name: string, code: string}>>([])
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  // Fetch folders and files
  const fetchData = async () => {
    if (!isAuthenticated || !user) return

    try {
      setLoading(true)
      setError(null)

      // Fetch folders
      const foldersResponse = await fetch(`/api/folders?parentId=${currentFolderId || ''}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!foldersResponse.ok) {
        throw new Error(`Failed to fetch folders: ${foldersResponse.statusText}`)
      }

      const foldersData = await foldersResponse.json()
      if (!foldersData.success) {
        throw new Error(foldersData.error || 'Failed to fetch folders')
      }

      setFolders(foldersData.folders || [])

      // Fetch files in current folder
      if (currentFolderId || searchQuery) {
        const filesUrl = searchQuery 
          ? `/api/files?search=${encodeURIComponent(searchQuery)}`
          : `/api/files?folderId=${currentFolderId}`

        const filesResponse = await fetch(filesUrl, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!filesResponse.ok) {
          throw new Error(`Failed to fetch files: ${filesResponse.statusText}`)
        }

        const filesData = await filesResponse.json()
        if (!filesData.success) {
          throw new Error(filesData.error || 'Failed to fetch files')
        }

        setFiles(filesData.files || [])
      } else {
        setFiles([])
      }

    } catch (err) {
      console.error('Error fetching data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
      setError(errorMessage)
      
      // Show toast for authentication errors
      if (errorMessage.includes('authentication') || errorMessage.includes('401')) {
        showToast('Please log in to access the library', 'error')
      } else {
        showToast(errorMessage, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchDepartments()
    fetchRecentFiles()
  }, [isAuthenticated, user, currentFolderId, searchQuery])

  const fetchDepartments = async () => {
    if (!isAuthenticated || !user) return

    try {
      const response = await fetch('/api/departments', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDepartments(data.departments || [])
        }
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchRecentFiles = async () => {
    if (!isAuthenticated || !user) return

    try {
      setLoadingRecent(true)
      const response = await fetch('/api/files/recent?limit=5', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setRecentFiles(data.files || [])
        } else {
          console.error('Recent files API error:', data.error)
          setRecentFiles([]) // Set empty array on error
        }
      } else {
        console.error('Recent files fetch failed:', response.status, response.statusText)
        setRecentFiles([]) // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching recent files:', error)
      setRecentFiles([]) // Set empty array on error
    } finally {
      setLoadingRecent(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return

    try {
      setCreatingFolder(true)

      const response = await fetch('/api/folders', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderName,
          parentId: currentFolderId,
          description: newFolderDescription,
          department: newFolderDepartment || user.department || ''
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create folder: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to create folder')
      }

      // Refresh data
      await fetchData()
      
      // Reset form
      setNewFolderName("")
      setNewFolderDescription("")
      setNewFolderDepartment("")
      setShowNewFolderModal(false)
      
      showToast('✅ Folder created successfully!', 'success')

    } catch (err) {
      console.error('Error creating folder:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create folder'
      setError(errorMessage)
      showToast(`❌ ${errorMessage}`, 'error')
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleUploadFile = async () => {
    if (!uploadFile || !user) return

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('folderId', (currentFolderId || '').toString())
      formData.append('description', uploadFormData.description)
      formData.append('tags', uploadFormData.tags)
      formData.append('visibility', uploadFormData.visibility)
      formData.append('department', uploadFormData.department || user.department || '')

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload file')
      }

      // Refresh data
      await fetchData()
      
      // Reset form
      setUploadFile(null)
      setUploadFormData({
        title: "",
        description: "",
        tags: "",
        department: "",
        visibility: "private",
      })
      setShowUploadModal(false)
      
      showToast('✅ File uploaded successfully!', 'success')

    } catch (err) {
      console.error('Error uploading file:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file'
      setError(errorMessage)
      showToast(`❌ ${errorMessage}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleOpenFolder = (folderId: number) => {
    const folder = folders.find((f) => f.id === folderId)
    if (folder) {
      setCurrentFolderId(folderId)
      setBreadcrumb([...breadcrumb, folder])
      setSearchQuery("")
    }
  }

  const handleGoBack = () => {
    if (breadcrumb.length > 0) {
      const newBreadcrumb = breadcrumb.slice(0, -1)
      setBreadcrumb(newBreadcrumb)
      setCurrentFolderId(newBreadcrumb.length > 0 ? newBreadcrumb[newBreadcrumb.length - 1].id : null)
      setSearchQuery("")
    }
  }

  const handleDeleteFolder = async (folderId: number) => {
    if (!user || !confirm('Are you sure you want to delete this folder?')) return

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete folder: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete folder')
      }

      // Refresh data
      await fetchData()
      
      showToast('✅ Folder deleted successfully!', 'success')

    } catch (err) {
      console.error('Error deleting folder:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete folder'
      setError(errorMessage)
      showToast(`❌ ${errorMessage}`, 'error')
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    if (!user || !confirm('Are you sure you want to delete this file?')) return

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete file')
      }

      // Refresh data
      await fetchData()
      
      showToast('✅ File deleted successfully!', 'success')

    } catch (err) {
      console.error('Error deleting file:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete file'
      setError(errorMessage)
      showToast(`❌ ${errorMessage}`, 'error')
    }
  }



  const handleCopyLink = () => {
    if (selectedFile) {
      const url = `${window.location.origin}/document/${selectedFile.id}`
      navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const handlePreviewFile = (file: FileItem) => {
    setSelectedFileForPreview(file)
    setShowPreviewModal(true)
  }

  const handleFileClick = async (file: FileItem) => {
    setSelectedFile(file)
    setShowDetailModal(true)
    
    // Track file view
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'view' })
      })
      
      if (response.ok) {
        // Update local file data with new view count
        setFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === file.id 
              ? { ...f, view_count: (f.view_count || 0) + 1 }
              : f
          )
        )
      }
    } catch (error) {
      console.error('Error tracking file view:', error)
    }
  }

  const handleGenerateAISummary = async () => {
    if (!selectedFile) return
    
    setLoadingAISummary(true)
    setAiSummaryError('')
    
    // Show initial toast
    showToast("🤖 Generating AI summary...", "info", 5000)
    
    try {
      // First try to get existing summary
      const existingResponse = await fetch(`/api/files/${selectedFile.id}/ai-summary`)
      
      if (existingResponse.ok) {
        const data = await existingResponse.json()
        if (data.success && data.summary) {
          setAiSummary(data.summary)
          setShowAISummaryModal(true)
          showToast("✅ AI summary loaded successfully!", "success", 4000)
          return
        }
      }
      
      // Generate new summary
      const generateResponse = await fetch(`/api/files/${selectedFile.id}/ai-summary`, {
        method: 'POST'
      })
      
      if (generateResponse.ok) {
        const data = await generateResponse.json()
        if (data.success && data.summary) {
          setAiSummary(data.summary)
          setShowAISummaryModal(true)
          showToast("🎉 AI summary generated successfully!", "success", 5000)
        } else {
          throw new Error(data.error || 'Failed to generate summary')
        }
      } else {
        const errorData = await generateResponse.json()
        throw new Error(errorData.error || 'Failed to generate summary')
      }
    } catch (error) {
      console.error('Error with AI summary:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary'
      setAiSummaryError(errorMessage)
      showToast(`❌ AI summary failed: ${errorMessage}`, "error", 6000)
    } finally {
      setLoadingAISummary(false)
    }
  }

  const handleAIChat = (fileId: string, fileName: string) => {
    setAISelectedFile(fileId, fileName)
    // Show a toast to indicate the file has been selected for AI chat
    showToast(`🤖 AI Chat ready for: ${fileName}`, "success", 3000)
  }

  const getFileIcon = (fileType: string) => {
    const iconColor: Record<string, string> = {
      pdf: "text-red-400",
      document: "text-blue-400",
      spreadsheet: "text-green-400",
      presentation: "text-orange-400",
      text: "text-gray-400",
      image: "text-purple-400",
      video: "text-pink-400",
      audio: "text-yellow-400",
      other: "text-amber-400",
    }
    return iconColor[fileType] || "text-gray-400"
  }

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to access the library</p>
      </div>
    )
  }

  const hasResults = folders.length > 0 || files.length > 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">Document Library</h1>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-500">{error}</span>
                <button 
                  onClick={() => setError(null)}
                  className="ml-auto text-red-500 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
              <button
                onClick={() => {
                  setCurrentFolderId(null)
                  setBreadcrumb([])
                  setSearchQuery("")
                }}
                className="hover:text-foreground transition flex items-center gap-1"
              >
                <Home className="w-4 h-4" /> Root
              </button>
              {breadcrumb.map((folder, index) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  <button
                    onClick={() => {
                      const newBreadcrumb = breadcrumb.slice(0, index + 1)
                      setBreadcrumb(newBreadcrumb)
                      setCurrentFolderId(newBreadcrumb[newBreadcrumb.length - 1].id)
                      setSearchQuery("")
                    }}
                    className="hover:text-foreground transition"
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-6 flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search folders and files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewFolderModal(true)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                New Folder
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                disabled={loading || !currentFolderId}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          )}

          {/* Content */}
          {!loading && (
            <>
              {searchQuery ? (
                <>
                  {hasResults ? (
                    <div className="space-y-8">
                      {folders.length > 0 && (
                        <div>
                          <h2 className="text-lg font-semibold text-foreground mb-4">Folders ({folders.length})</h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {folders.map((folder) => (
                              <div
                                key={folder.id}
                                className="glass rounded-lg p-4 hover:bg-secondary/50 transition cursor-pointer group relative"
                              >
                                <div onClick={() => handleOpenFolder(folder.id)} className="flex items-center gap-3">
                                  <Folder className="w-8 h-8 text-yellow-400" />
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-foreground truncate">{folder.name}</h3>
                                    <p className="text-xs text-muted-foreground">{folder.files_count || 0} items</p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteFolder(folder.id)
                                  }}
                                  className="absolute right-2 top-2 p-1 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/20 rounded"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {files.length > 0 && (
                        <div>
                          <h2 className="text-lg font-semibold text-foreground mb-4">Files ({files.length})</h2>
                          <div className="space-y-3">
                            {files.map((file) => (
                              <EnhancedFileItem
                                key={file.id}
                                file={file}
                                onPreview={handlePreviewFile}
                                onDownload={(file) => {
                                  setSelectedFile(file)
                                  setShowDownloadModal(true)
                                }}
                                onShare={(file) => {
                                  setSelectedFile(file)
                                  setShowShareModal(true)
                                }}
                                onAIChat={handleAIChat}
                                onViewDetails={handleFileClick}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass rounded-lg p-8 text-center">
                      <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-1">No results found</h3>
                      <p className="text-muted-foreground">No folders or files match "{searchQuery}"</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {folders.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-lg font-semibold text-foreground mb-4">Folders</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {folders.map((folder) => (
                          <div
                            key={folder.id}
                            className="glass rounded-lg p-4 hover:bg-secondary/50 transition cursor-pointer group relative"
                          >
                            <div onClick={() => handleOpenFolder(folder.id)} className="flex items-center gap-3">
                              <Folder className="w-8 h-8 text-yellow-400" />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-foreground truncate">{folder.name}</h3>
                                <p className="text-xs text-muted-foreground">{folder.file_count || 0} items</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteFolder(folder.id)
                              }}
                              className="absolute right-2 top-2 p-1 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/20 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-4">Files</h2>
                      <div className="space-y-3">
                        {files.map((file) => (
                          <EnhancedFileItem
                            key={file.id}
                            file={file}
                            onPreview={handlePreviewFile}
                            onDownload={(file) => {
                              setSelectedFile(file)
                              setShowDownloadModal(true)
                            }}
                            onShare={(file) => {
                              setSelectedFile(file)
                              setShowShareModal(true)
                            }}
                            onAIChat={handleAIChat}
                            onViewDetails={handleFileClick}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {folders.length === 0 && files.length === 0 && (
                    <div className="glass rounded-lg p-8 text-center">
                      <Folder className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-1">No items yet</h3>
                      <p className="text-muted-foreground">Create a folder or upload a file to get started</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* New Folder Modal */}
          {showNewFolderModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-semibold text-foreground mb-4">Create New Folder</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                    autoFocus
                    onKeyPress={(e) => e.key === "Enter" && !creatingFolder && handleCreateFolder()}
                  />
                  <textarea
                    value={newFolderDescription}
                    onChange={(e) => setNewFolderDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={3}
                    className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none"
                  />
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Department</label>
                    <select
                      value={newFolderDepartment}
                      onChange={(e) => setNewFolderDepartment(e.target.value)}
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="">Select Department (Optional)</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name} {dept.code && `(${dept.code})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium disabled:opacity-50"
                  >
                    {creatingFolder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewFolderModal(false)
                      setNewFolderName("")
                      setNewFolderDescription("")
                      setNewFolderDepartment("")
                    }}
                    disabled={creatingFolder}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload File Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-2 mb-6">
                  <Upload className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Upload File</h2>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Select File</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition">
                      <input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.mp4,.mp3,.zip"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                        {uploadFile ? (
                          <div>
                            <p className="text-sm text-foreground font-medium">{uploadFile.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-muted-foreground">Click to select file</p>
                            <p className="text-xs text-muted-foreground mt-1">Max size: 50 MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                    <textarea
                      value={uploadFormData.description}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none"
                      placeholder="Describe the document content"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Tags</label>
                    <input
                      type="text"
                      value={uploadFormData.tags}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, tags: e.target.value })}
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                      placeholder="Enter tags separated by commas"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Department</label>
                      <select
                        value={uploadFormData.department}
                        onChange={(e) => setUploadFormData({ ...uploadFormData, department: e.target.value })}
                        className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.name}>
                            {dept.name} {dept.code && `(${dept.code})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Visibility</label>
                      <select
                        value={uploadFormData.visibility}
                        onChange={(e) => setUploadFormData({ ...uploadFormData, visibility: e.target.value })}
                        className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="private">Private</option>
                        <option value="org">Organization</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleUploadFile}
                    disabled={!uploadFile || uploading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadModal(false)
                      setUploadFile(null)
                      setUploadFormData({
                        title: "",
                        description: "",
                        tags: "",
                        department: "",
                        visibility: "private",
                      })
                    }}
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {showDetailModal && selectedFile && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{selectedFile.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedFile.file_type?.toUpperCase() || 'FILE'} • {formatFileSize(selectedFile.size_bytes)}
                    </p>
                  </div>
                  <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-secondary rounded">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Views</p>
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <Eye className="w-4 h-4" /> {selectedFile.view_count || 0}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Downloads</p>
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <Download className="w-4 h-4" /> {selectedFile.download_count || 0}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Uploaded</p>
                    <p className="font-semibold text-foreground text-sm">{formatDate(selectedFile.created_at)}</p>
                  </div>
                </div>

                {/* Uploader Info */}
                {selectedFile.uploaded_by_name && (
                  <div className="glass rounded-lg p-4 mb-6 border-l-4 border-primary">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">👤</div>
                      <div>
                        <p className="font-semibold text-foreground">{selectedFile.uploaded_by_name}</p>
                        <p className="text-xs text-muted-foreground">{selectedFile.department || 'Unknown Department'}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {new Date(selectedFile.created_at).toLocaleString()}
                      </p>
                      {selectedFile.folder_name && (
                        <p className="flex items-center gap-2">
                          <Folder className="w-4 h-4" /> {selectedFile.folder_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedFile.description && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-foreground mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground">{selectedFile.description}</p>
                  </div>
                )}

                {/* Tags */}
                {selectedFile.tags && selectedFile.tags.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4" /> Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedFile.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Info */}
                <div className="mb-6">
                  <h3 className="font-semibold text-foreground mb-2">File Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Original Name:</p>
                      <p className="text-foreground">{selectedFile.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">MIME Type:</p>
                      <p className="text-foreground">{selectedFile.mime_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Visibility:</p>
                      <p className="text-foreground capitalize">{selectedFile.visibility}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Downloads:</p>
                      <p className="text-foreground">{selectedFile.download_count || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <button
                    onClick={handleGenerateAISummary}
                    disabled={loadingAISummary}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 rounded-lg hover:from-purple-500/30 hover:to-blue-500/30 transition text-sm disabled:opacity-50"
                  >
                    {loadingAISummary ? (
                      <>
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Summary
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowShareModal(true)
                      setShowDetailModal(false)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button
                    onClick={() => {
                      setShowDownloadModal(true)
                      setShowDetailModal(false)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>

                {/* AI Summary Error */}
                {aiSummaryError && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{aiSummaryError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {showShareModal && selectedFile && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-semibold text-foreground mb-4">Share Document</h2>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={`${window.location.origin}/document/${selectedFile.id}`}
                    readOnly
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="w-full px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium text-sm"
                  >
                    {copiedLink ? "Copied!" : "Copy Link"}
                  </button>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full mt-4 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {showDownloadModal && selectedFile && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-semibold text-foreground mb-4">Download File</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Click below to download: <span className="font-medium text-foreground">{selectedFile.name}</span>
                </p>
                <div className="space-y-2 mb-4">
                  <button
                    onClick={() => handleDownload()}
                    className="w-full px-4 py-3 rounded-lg transition text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Download className="w-4 h-4 inline mr-2" />
                    Download Original File
                  </button>
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="w-full px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showPreviewModal && selectedFileForPreview && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{selectedFileForPreview.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">Preview • {selectedFileForPreview.file_type}</p>
                  </div>
                  <button onClick={() => setShowPreviewModal(false)} className="p-1 hover:bg-secondary rounded">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Preview Content */}
                <div className="bg-white/5 rounded-lg p-12 text-center min-h-96 flex items-center justify-center">
                  <div>
                    <File className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {selectedFileForPreview.description || "File preview would display here"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                      handleFileClick(selectedFileForPreview)
                    }}
                    className="flex-1 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showAISummaryModal && selectedFile && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI Summary
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">{selectedFile.name}</p>
                  </div>
                  <button onClick={() => setShowAISummaryModal(false)} className="p-1 hover:bg-secondary rounded">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* AI Summary Content */}
                <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-6 border border-purple-500/20">
                  <div className="prose prose-sm max-w-none text-foreground">
                    {aiSummary ? (
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {aiSummary}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground">Generating AI summary...</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      if (aiSummary) {
                        navigator.clipboard.writeText(aiSummary)
                        showToast("📋 AI summary copied to clipboard!", "success", 3000)
                      }
                    }}
                    disabled={!aiSummary}
                    className="flex-1 px-4 py-2 bg-primary/20 text-primary hover:bg-primary/30 transition rounded-lg font-medium disabled:opacity-50"
                  >
                    Copy Summary
                  </button>
                  <button
                    onClick={() => setShowAISummaryModal(false)}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent Viewed Files - Only show in root folder */}
          {!searchQuery && !currentFolderId && recentFiles.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recently Added
              </h2>
              <div className="space-y-3">
                {recentFiles.map((file) => (
                  <EnhancedFileItem
                    key={file.id}
                    file={file}
                    onPreview={handlePreviewFile}
                    onDownload={(file) => {
                      setSelectedFile(file)
                      setShowDownloadModal(true)
                    }}
                    onShare={(file) => {
                      setSelectedFile(file)
                      setShowShareModal(true)
                    }}
                    onAIChat={handleAIChat}
                    onViewDetails={handleFileClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}