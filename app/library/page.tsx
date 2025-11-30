"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
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
} from "lucide-react"

interface FileItem {
  id: string
  name: string
  type: string
  size: string
  uploadDate: string
  folderId: string
  uploader?: {
    name: string
    department: string
    email: string
    location: string
    timePosted: string
  }
  tags?: string[]
  description?: string
  views?: number
}

interface FolderItem {
  id: string
  name: string
  parentId: string | null
  fileCount: number
  createdDate: string
}

export default function Library() {
  const [folders, setFolders] = useState<FolderItem[]>([
    { id: "1", name: "Company Policies", parentId: null, fileCount: 5, createdDate: "2024-11-01" },
    { id: "2", name: "HR Documents", parentId: null, fileCount: 8, createdDate: "2024-11-05" },
  ])

  const [files, setFiles] = useState<FileItem[]>([
    {
      id: "1",
      name: "Policy Guide.pdf",
      type: "PDF",
      size: "2.4 MB",
      uploadDate: "2024-11-15",
      folderId: "1",
      uploader: {
        name: "John Doe",
        department: "Legal",
        email: "john@company.com",
        location: "New York, USA",
        timePosted: "2024-11-15 10:30 AM",
      },
      tags: ["policy", "guidelines"],
      description: "Company policy guidelines and procedures",
      views: 156,
    },
    {
      id: "2",
      name: "Employee Handbook.docx",
      type: "DOCX",
      size: "1.8 MB",
      uploadDate: "2024-11-10",
      folderId: "2",
      uploader: {
        name: "Jane Smith",
        department: "HR",
        email: "jane@company.com",
        location: "Boston, USA",
        timePosted: "2024-11-10 09:15 AM",
      },
      tags: ["handbook", "hr", "onboarding"],
      description: "Employee handbook with company policies and benefits",
      views: 320,
    },
  ])

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [breadcrumb, setBreadcrumb] = useState<FolderItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileItem | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFormData, setUploadFormData] = useState({
    fileName: "",
    title: "",
    description: "",
    tags: "",
    department: "",
    fileType: "PDF",
  })

  const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null
  const currentFiles = files.filter((f) => f.folderId === currentFolderId)
  const subFolders = folders.filter((f) => f.parentId === currentFolderId)

  const filteredFolders = subFolders.filter((folder) => folder.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredFiles = currentFiles.filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    const newFolder: FolderItem = {
      id: Date.now().toString(),
      name: newFolderName,
      parentId: currentFolderId,
      fileCount: 0,
      createdDate: new Date().toISOString().split("T")[0],
    }
    setFolders([...folders, newFolder])
    setNewFolderName("")
    setShowNewFolderModal(false)
  }

  const handleOpenFolder = (folderId: string) => {
    setCurrentFolderId(folderId)
    const folder = folders.find((f) => f.id === folderId)
    if (folder) {
      setBreadcrumb([...breadcrumb, folder])
    }
    setSearchQuery("")
  }

  const handleGoBack = () => {
    if (breadcrumb.length > 0) {
      const newBreadcrumb = breadcrumb.slice(0, -1)
      setBreadcrumb(newBreadcrumb)
      setCurrentFolderId(newBreadcrumb.length > 0 ? newBreadcrumb[newBreadcrumb.length - 1].id : null)
    }
    setSearchQuery("")
  }

  const handleDeleteFolder = (folderId: string) => {
    setFolders(folders.filter((f) => f.id !== folderId))
    setFiles(files.filter((f) => f.folderId !== folderId))
  }

  const handleDeleteFile = (fileId: string) => {
    setFiles(files.filter((f) => f.id !== fileId))
  }

  const handleOpenFileDetails = (file: FileItem) => {
    setSelectedFile(file)
    setShowDetailModal(true)
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

  const getFileIcon = (fileType: string) => {
    const iconColor: Record<string, string> = {
      PDF: "text-red-400",
      DOCX: "text-blue-400",
      XLSX: "text-green-400",
      PPTX: "text-orange-400",
      TXT: "text-gray-400",
      PNG: "text-purple-400",
      JPG: "text-purple-400",
      MP4: "text-pink-400",
      MP3: "text-yellow-400",
      ZIP: "text-amber-400",
    }
    return iconColor[fileType] || "text-gray-400"
  }

  const getFilePreview = (fileType: string) => {
    const previews: Record<string, string> = {
      PDF: "📄 PDF Preview",
      DOCX: "📝 Document Preview",
      XLSX: "📊 Spreadsheet Preview",
      PPTX: "🎯 Presentation Preview",
      TXT: "📋 Text File Preview",
      PNG: "🖼️ Image Preview",
      JPG: "🖼️ Image Preview",
      MP4: "🎬 Video Preview",
      MP3: "🎵 Audio Preview",
      ZIP: "📦 Archive Preview",
    }
    return previews[fileType] || "📄 File Preview"
  }

  const hasResults = filteredFolders.length > 0 || filteredFiles.length > 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">Document Library</h1>

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
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium"
              >
                <Plus className="w-4 h-4" />
                New Folder
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>
          </div>

          {/* New Folder Modal */}
          {showNewFolderModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-semibold text-foreground mb-4">Create New Folder</h2>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground mb-4 focus:outline-none focus:border-primary"
                  autoFocus
                  onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateFolder}
                    className="flex-1 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewFolderModal(false)}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
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
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition cursor-pointer">
                      <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Drag and drop or click to select file</p>
                      <p className="text-xs text-muted-foreground mt-1">Max size: 50 MB</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">File Title</label>
                    <input
                      type="text"
                      value={uploadFormData.title}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                      placeholder="Enter document title"
                    />
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
                        <option value="Engineering">Engineering</option>
                        <option value="Product">Product</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="Marketing">Marketing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">File Type</label>
                      <select
                        value={uploadFormData.fileType}
                        onChange={(e) => setUploadFormData({ ...uploadFormData, fileType: e.target.value })}
                        className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="PDF">PDF</option>
                        <option value="DOCX">DOCX</option>
                        <option value="XLSX">XLSX</option>
                        <option value="PPTX">PPTX</option>
                        <option value="TXT">TXT</option>
                        <option value="PNG">PNG</option>
                        <option value="JPG">JPG</option>
                        <option value="MP4">MP4</option>
                        <option value="MP3">MP3</option>
                        <option value="ZIP">ZIP</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowUploadModal(false)
                      setUploadFormData({
                        fileName: "",
                        title: "",
                        description: "",
                        tags: "",
                        department: "",
                        fileType: "PDF",
                      })
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium"
                  >
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
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
                      {selectedFile.type} • {selectedFile.size}
                    </p>
                  </div>
                  <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-secondary rounded">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Views</p>
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <Eye className="w-4 h-4" /> {selectedFile.views || 0}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Uploaded</p>
                    <p className="font-semibold text-foreground text-sm">{selectedFile.uploadDate}</p>
                  </div>
                </div>

                {/* Uploader Info */}
                {selectedFile.uploader && (
                  <div className="glass rounded-lg p-4 mb-6 border-l-4 border-primary">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">👤</div>
                      <div>
                        <p className="font-semibold text-foreground">{selectedFile.uploader.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedFile.uploader.department}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Mail className="w-4 h-4" /> {selectedFile.uploader.email}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> {selectedFile.uploader.location}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {selectedFile.uploader.timePosted}
                      </p>
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

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-border">
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
                <h2 className="text-xl font-semibold text-foreground mb-4">Download Format</h2>
                <div className="space-y-2 mb-4">
                  {["PDF", "DOCX", "XLSX", "PPT", "TXT"].map((format) => (
                    <button
                      key={format}
                      className={`w-full px-4 py-2 rounded-lg transition text-sm font-medium ${
                        format === selectedFile.type
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/80 text-foreground"
                      }`}
                    >
                      {format} {format === selectedFile.type && "(Original)"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="w-full px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
                >
                  Close
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
                    <p className="text-sm text-muted-foreground mt-1">Preview • {selectedFileForPreview.type}</p>
                  </div>
                  <button onClick={() => setShowPreviewModal(false)} className="p-1 hover:bg-secondary rounded">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Preview Content */}
                <div className="bg-white/5 rounded-lg p-12 text-center min-h-96 flex items-center justify-center">
                  <div>
                    <p className="text-3xl mb-4">{getFilePreview(selectedFileForPreview.type)}</p>
                    <p className="text-muted-foreground">
                      {selectedFileForPreview.description || "File preview would display here"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                      handleOpenFileDetails(selectedFileForPreview)
                      setShowDetailModal(true)
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

          {searchQuery ? (
            <>
              {hasResults ? (
                <div className="space-y-8">
                  {filteredFolders.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-4">Folders ({filteredFolders.length})</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredFolders.map((folder) => (
                          <div
                            key={folder.id}
                            className="glass rounded-lg p-4 hover:bg-secondary/50 transition cursor-pointer group relative"
                          >
                            <div onClick={() => handleOpenFolder(folder.id)} className="flex items-center gap-3">
                              <Folder className="w-8 h-8 text-yellow-400" />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-foreground truncate">{folder.name}</h3>
                                <p className="text-xs text-muted-foreground">{folder.fileCount} items</p>
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

                  {filteredFiles.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-4">Files ({filteredFiles.length})</h2>
                      <div className="space-y-2">
                        {filteredFiles.map((file) => (
                          <div
                            key={file.id}
                            className="glass rounded-lg p-4 flex items-center justify-between group hover:bg-secondary/50 transition cursor-pointer"
                            onClick={() => handleOpenFileDetails(file)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <File className={`w-5 h-5 flex-shrink-0 ${getFileIcon(file.type)}`} />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-foreground truncate">{file.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {file.size} • {file.uploadDate}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">{file.type}</span>
                            </div>
                          </div>
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
              {subFolders.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Folders</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {subFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="glass rounded-lg p-4 hover:bg-secondary/50 transition cursor-pointer group relative"
                      >
                        <div onClick={() => handleOpenFolder(folder.id)} className="flex items-center gap-3">
                          <Folder className="w-8 h-8 text-yellow-400" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">{folder.name}</h3>
                            <p className="text-xs text-muted-foreground">{folder.fileCount} items</p>
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

              {currentFiles.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Files</h2>
                  <div className="space-y-2">
                    {currentFiles.map((file) => (
                      <div
                        key={file.id}
                        className="glass rounded-lg p-4 flex items-center justify-between group hover:bg-secondary/50 transition cursor-pointer"
                        onClick={() => handleOpenFileDetails(file)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className={`w-5 h-5 flex-shrink-0 ${getFileIcon(file.type)}`} />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">{file.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {file.size} • {file.uploadDate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">{file.type}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteFile(file.id)
                            }}
                            className="p-1 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/20 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handlePreviewFile(file)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                          >
                            <Eye className="w-4 h-4" /> Preview
                          </button>
                          <button
                            onClick={() => handleOpenFileDetails(file)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition text-sm"
                          >
                            <Share2 className="w-4 h-4" /> Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subFolders.length === 0 && currentFiles.length === 0 && (
                <div className="glass rounded-lg p-8 text-center">
                  <Folder className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">No items yet</h3>
                  <p className="text-muted-foreground">Create a folder or upload a file to get started</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
