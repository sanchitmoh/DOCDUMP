"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Clock, BookmarkCheck, Upload, Download, Eye, Star, ArrowRight, Search, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const recentlyViewed = [
  { id: 1, title: "Q4 Financial Report", author: "Finance", date: "2024-11-15", views: 120 },
  { id: 2, title: "Company Culture Guide", author: "HR", date: "2024-11-10", views: 89 },
  { id: 3, title: "Engineering Best Practices", author: "Tech", date: "2024-11-08", views: 65 },
]

const savedDocuments = [
  { id: 1, title: "Product Roadmap 2025", author: "Product", date: "2024-11-12" },
  { id: 2, title: "Marketing Strategy Q4", author: "Marketing", date: "2024-11-14" },
]

const contributions = [
  { id: 1, title: "Team Meeting Notes - Nov 2024", date: "2024-11-10", status: "published", views: 45 },
  { id: 2, title: "Project Proposal Draft", date: "2024-11-05", status: "draft", views: 0 },
]

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState({
    searchBy: "all", // all, name, author, department, tags, content
    docType: "all",
    sortBy: "recent",
  })
  const [showFilters, setShowFilters] = useState(false)

  // Mock search function - in real app this would filter from API
  const allDocuments = [
    ...recentlyViewed.map((doc) => ({ ...doc, category: "recently-viewed" })),
    ...savedDocuments.map((doc) => ({ ...doc, category: "saved" })),
    ...contributions.map((doc) => ({ ...doc, category: "contributions" })),
  ]

  const searchResults = searchQuery
    ? allDocuments.filter((doc) => {
        const matchesSearch =
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.author?.toLowerCase().includes(searchQuery.toLowerCase())

        if (filters.searchBy === "name") {
          return doc.title.toLowerCase().includes(searchQuery.toLowerCase())
        } else if (filters.searchBy === "author") {
          return doc.author?.toLowerCase().includes(searchQuery.toLowerCase())
        }
        return matchesSearch
      })
    : []

  const recentlyViewedFiltered = searchQuery
    ? recentlyViewed.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.author.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : recentlyViewed

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar currentPage="dashboard" />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back, John!</h1>
            <p className="text-muted-foreground">Here's what's happening in your library</p>
          </div>

          {/* Advanced Search Bar */}
          <div className="mb-8 glass rounded-lg p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name, description, tags, author, department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium text-sm"
                >
                  Filters
                </button>
              </div>

              {/* Filter Options */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Search By</label>
                    <select
                      value={filters.searchBy}
                      onChange={(e) => setFilters({ ...filters, searchBy: e.target.value })}
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="all">All Fields</option>
                      <option value="name">Name</option>
                      <option value="author">Author</option>
                      <option value="department">Department</option>
                      <option value="tags">Tags</option>
                      <option value="content">Content</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Document Type</label>
                    <select
                      value={filters.docType}
                      onChange={(e) => setFilters({ ...filters, docType: e.target.value })}
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="all">All Types</option>
                      <option value="pdf">PDF</option>
                      <option value="doc">Documents</option>
                      <option value="sheet">Spreadsheets</option>
                      <option value="presentation">Presentations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Sort By</label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="views">Most Views</option>
                      <option value="alphabetical">Alphabetical</option>
                      <option value="popular">Most Popular</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {searchQuery && searchResults.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Search Results{" "}
                  <span className="text-sm text-muted-foreground font-normal">({searchResults.length} found)</span>
                </h2>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-sm text-primary hover:text-accent transition"
                >
                  Clear Search
                </button>
              </div>

              <div className="space-y-3">
                {searchResults.map((doc) => (
                  <Link
                    key={`${doc.category}-${doc.id}`}
                    href={`/document/${doc.id}`}
                    className="glass glow-hover p-4 rounded-lg flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground group-hover:text-primary transition">{doc.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {doc.category === "recently-viewed"
                            ? "Viewed"
                            : doc.category === "saved"
                              ? "Saved"
                              : "Contributed"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.author} • {doc.date}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      {doc.views !== undefined && (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>{doc.views}</span>
                        </>
                      )}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className="mb-8 glass rounded-lg p-8 text-center">
              <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No results found</h3>
              <p className="text-muted-foreground text-sm">
                Try adjusting your search terms or filters to find what you're looking for.
              </p>
            </div>
          )}

          {/* Stats Grid - hide when showing search results */}
          {!searchQuery && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Views</p>
                    <p className="text-2xl font-bold text-foreground">2,847</p>
                  </div>
                  <Eye className="w-8 h-8 text-primary/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Saved Items</p>
                    <p className="text-2xl font-bold text-foreground">12</p>
                  </div>
                  <BookmarkCheck className="w-8 h-8 text-yellow-500/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Contributions</p>
                    <p className="text-2xl font-bold text-foreground">5</p>
                  </div>
                  <Upload className="w-8 h-8 text-green-500/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Downloads</p>
                    <p className="text-2xl font-bold text-foreground">284</p>
                  </div>
                  <Download className="w-8 h-8 text-blue-500/50" />
                </div>
              </div>
            </div>
          )}

          {/* Recently Viewed - hide when showing search results */}
          {!searchQuery && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>Recently Viewed</span>
                </h2>
                {/* Removed "View All" link to browse page */}
              </div>

              <div className="space-y-3">
                {recentlyViewedFiltered.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/document/${doc.id}`}
                    className="glass glow-hover p-4 rounded-lg flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground group-hover:text-primary transition">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.author} • {doc.date}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Eye className="w-4 h-4" />
                      <span>{doc.views}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Two Column Layout - hide when showing search results */}
          {!searchQuery && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Saved Documents */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span>Saved Documents</span>
                  </h2>
                  <Link href="/saved-documents" className="text-primary hover:text-accent transition text-sm">
                    View All
                  </Link>
                </div>

                <div className="space-y-3">
                  {savedDocuments.map((doc) => (
                    <div key={doc.id} className="glass glow-hover p-4 rounded-lg">
                      <h3 className="font-medium text-foreground hover:text-primary transition cursor-pointer">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2">
                        {doc.author} • {doc.date}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your Contributions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
                    <Upload className="w-5 h-5 text-green-500" />
                    <span>Your Contributions</span>
                  </h2>
                  <Link href="/upload" className="text-primary hover:text-accent transition text-sm">
                    Upload New
                  </Link>
                </div>

                <div className="space-y-3">
                  {contributions.map((doc) => (
                    <div key={doc.id} className="glass glow-hover p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">{doc.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{doc.date}</p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            doc.status === "published"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{doc.views} views</p>
                    </div>
                  ))}
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
