"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { Search, Eye, Edit2, Trash2, Upload, BarChart3, Save, FileText } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import Link from "next/link"

const contributionsData = [
  {
    id: 1,
    title: "Team Meeting Notes - Nov 2024",
    date: "2024-11-10",
    status: "published",
    views: 45,
    downloads: 12,
    department: "Engineering",
    type: "PDF",
    tags: ["meeting", "notes", "team"],
  },
  {
    id: 2,
    title: "Project Proposal Draft",
    date: "2024-11-05",
    status: "draft",
    views: 0,
    downloads: 0,
    department: "Product",
    type: "DOCX",
    tags: ["proposal", "draft"],
  },
  {
    id: 3,
    title: "Q4 Performance Summary",
    date: "2024-11-12",
    status: "published",
    views: 89,
    downloads: 23,
    department: "HR",
    type: "PPTX",
    tags: ["performance", "summary", "Q4"],
  },
  {
    id: 4,
    title: "Budget Allocation Plan 2025",
    date: "2024-11-08",
    status: "published",
    views: 156,
    downloads: 42,
    department: "Finance",
    type: "PDF",
    tags: ["budget", "allocation", "2025"],
  },
  {
    id: 5,
    title: "API Documentation v2.0",
    date: "2024-11-14",
    status: "published",
    views: 234,
    downloads: 67,
    department: "Engineering",
    type: "DOCX",
    tags: ["API", "documentation", "v2.0"],
  },
]

export default function YourContributions() {
  const { isAuthenticated, userType, userEmail } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("All")
  const [contributions, setContributions] = useState(contributionsData)
  const [editingDoc, setEditingDoc] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    tags: "",
    department: "",
    status: "published",
  })

  const filteredContributions = contributions.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (filterStatus === "All" || doc.status === filterStatus),
  )

  const deleteContribution = (id: number) => {
    setContributions(contributions.filter((doc) => doc.id !== id))
  }

  const handleEditClick = (doc: any) => {
    setEditingDoc(doc)
    setEditFormData({
      title: doc.title,
      description: doc.title,
      tags: doc.tags?.join(", ") || "",
      department: doc.department,
      status: doc.status,
    })
  }

  const handleSaveEdit = () => {
    if (editingDoc && editFormData.title.trim()) {
      setContributions(
        contributions.map((doc) =>
          doc.id === editingDoc.id
            ? {
                ...doc,
                title: editFormData.title,
                tags: editFormData.tags.split(",").map((t) => t.trim()),
                department: editFormData.department,
                status: editFormData.status,
              }
            : doc,
        ),
      )
      setEditingDoc(null)
    }
  }

  const totalViews = contributions.reduce((sum, doc) => sum + doc.views, 0)
  const totalDownloads = contributions.reduce((sum, doc) => sum + doc.downloads, 0)
  const publishedCount = contributions.filter((doc) => doc.status === "published").length

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please login to view your contributions</p>
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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Your Contributions</h1>
            <p className="text-muted-foreground">
              {userType === "organization"
                ? "Documents uploaded by your organization"
                : `Documents you have contributed as ${userEmail}`}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Contributions</p>
                  <p className="text-2xl font-bold text-foreground">{contributions.length}</p>
                </div>
                <Upload className="w-8 h-8 text-primary/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Published</p>
                  <p className="text-2xl font-bold text-foreground">{publishedCount}</p>
                </div>
                <span className="text-xl text-green-500/50">✓</span>
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Views</p>
                  <p className="text-2xl font-bold text-foreground">{totalViews}</p>
                </div>
                <Eye className="w-8 h-8 text-blue-500/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Downloads</p>
                  <p className="text-2xl font-bold text-foreground">{totalDownloads}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-cyan-500/50" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search your contributions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {["All", "published", "draft"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
                      filterStatus === status
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contributions List */}
          <div className="space-y-3">
            {filteredContributions.length > 0 ? (
              filteredContributions.map((doc) => (
                <div key={doc.id} className="glass glow-hover p-4 rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-foreground hover:text-primary transition cursor-pointer">
                          {doc.title}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            doc.status === "published"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2 flex-wrap">
                        <span>{doc.date}</span>
                        <span className="px-2 py-1 bg-primary/10 text-primary/80 rounded">{doc.department}</span>
                        <span className="px-2 py-1 bg-secondary rounded">{doc.type}</span>
                        <span className="px-2 py-1 bg-accent rounded">
                          {doc.tags?.map((tag: string) => (
                            <span key={tag} className="mr-1">
                              #{tag}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm">
                      <div className="text-right hidden md:block">
                        <p className="text-muted-foreground text-xs">Views</p>
                        <p className="font-semibold text-foreground">{doc.views}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-muted-foreground text-xs">Downloads</p>
                        <p className="font-semibold text-foreground">{doc.downloads}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => handleEditClick(doc)}
                      className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-primary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteContribution(doc.id)}
                      className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/document/${doc.id}`}
                      className="ml-auto text-sm text-primary hover:text-accent transition font-medium"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Upload className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No contributions found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start uploading documents to share with your organization
                </p>
                <Link
                  href="/upload"
                  className="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
                >
                  Upload Document
                </Link>
              </div>
            )}
          </div>

          {/* Edit Form Modal */}
          {editingDoc && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-2 mb-6">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Edit Document</h2>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Title</label>
                    <input
                      type="text"
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                      placeholder="Document title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none"
                      placeholder="Enter document description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Tags</label>
                    <input
                      type="text"
                      value={editFormData.tags}
                      onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                      placeholder="Enter tags separated by commas"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Department</label>
                      <select
                        value={editFormData.department}
                        onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
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
                      <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                      <select
                        value={editFormData.status}
                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                        className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                  <button
                    onClick={() => setEditingDoc(null)}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 transition rounded-lg text-foreground font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
