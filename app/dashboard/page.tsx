"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Clock, BookmarkCheck, Upload, Download, Eye, Star, ArrowRight, Search, X, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"

interface DashboardStats {
  viewCount: number
  savedDocuments: number
  contributions: number
  downloadCount: number
}

interface RecentDocument {
  id: number
  title: string
  author: string
  date: string
  views: number
  department?: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null)
  const [filters, setFilters] = useState({
    searchBy: "all",
    docType: "all",
    sortBy: "recent",
  })
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    viewCount: 0,
    savedDocuments: 0,
    contributions: 0,
    downloadCount: 0
  })
  const [recentlyViewed, setRecentlyViewed] = useState<RecentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchResults, setSearchResults] = useState<RecentDocument[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchTotal, setSearchTotal] = useState(0)

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  useEffect(() => {
    // Debounce search to avoid too many API calls
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }

    if (searchQuery && user) {
      const timer = setTimeout(() => {
        performSearch()
      }, 500) // Wait 500ms after user stops typing
      setSearchDebounceTimer(timer)
    } else {
      setSearchResults([])
      setSearchTotal(0)
    }

    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
      }
    }
  }, [searchQuery, user])

  const performSearch = async () => {
    if (!searchQuery.trim()) return

    try {
      setSearchLoading(true)
      
      const searchUrl = new URL('/api/search', window.location.origin)
      searchUrl.searchParams.set('q', searchQuery)
      searchUrl.searchParams.set('page', '1')
      searchUrl.searchParams.set('page_size', '10')
      searchUrl.searchParams.set('highlight', 'false')
      searchUrl.searchParams.set('search_type', 'basic')

      const response = await fetch(searchUrl.toString(), {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.results) {
          // Transform search results to match RecentDocument interface
          const transformedResults = data.results.map((result: any) => ({
            id: parseInt(result.file_id) || 0,
            title: result.title || 'Untitled',
            author: result.author || 'Unknown',
            date: result.created_at || new Date().toISOString(),
            views: 0, // Search results don't include view count
            department: result.department || ''
          }))
          setSearchResults(transformedResults)
          setSearchTotal(data.total || 0)
        } else {
          setSearchResults([])
          setSearchTotal(0)
        }
      } else {
        console.error('Search failed:', response.status)
        setSearchResults([])
        setSearchTotal(0)
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      setSearchTotal(0)
    } finally {
      setSearchLoading(false)
    }
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch stats and recent documents in parallel
      const [statsResponse, recentResponse] = await Promise.all([
        fetch('/api/dashboard/stats', {
          credentials: 'include'
        }),
        fetch('/api/dashboard/recent', {
          credentials: 'include'
        })
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      if (recentResponse.ok) {
        const recentData = await recentResponse.json()
        setRecentlyViewed(recentData.recentlyViewed || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const displayedSearchResults = searchResults
  const recentlyViewedFiltered = recentlyViewed

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar currentPage="dashboard" />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please login to view your dashboard</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar currentPage="dashboard" />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome Back, {user.name || user.email}!
            </h1>
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

          {searchQuery && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Search Results{" "}
                  {searchLoading ? (
                    <span className="text-sm text-muted-foreground font-normal">
                      <Loader2 className="w-4 h-4 inline animate-spin" />
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground font-normal">({searchTotal} found)</span>
                  )}
                </h2>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-sm text-primary hover:text-accent transition"
                >
                  Clear Search
                </button>
              </div>

              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Searching...</span>
                </div>
              ) : displayedSearchResults.length > 0 ? (
                <div className="space-y-3">
                  {displayedSearchResults.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/document/${doc.id}`}
                      className="glass glow-hover p-4 rounded-lg flex items-center justify-between group"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground group-hover:text-primary transition">{doc.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {doc.author} • {new Date(doc.date).toLocaleDateString()}
                          {doc.department && ` • ${doc.department}`}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        <span>{doc.views}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                      </div>
                    </Link>
                  ))}
                  {searchTotal > 10 && (
                    <div className="text-center pt-4">
                      <Link
                        href={`/search?q=${encodeURIComponent(searchQuery)}`}
                        className="text-sm text-primary hover:text-accent transition inline-flex items-center gap-1"
                      >
                        View all {searchTotal} results
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass rounded-lg p-8 text-center">
                  <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">No results found</h3>
                  <p className="text-muted-foreground text-sm">
                    Try adjusting your search terms to find what you're looking for.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stats Grid - hide when showing search results */}
          {!searchQuery && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Views</p>
                    <p className="text-2xl font-bold text-foreground">
                      {loading ? "..." : (stats.viewCount || 0).toLocaleString()}
                    </p>
                  </div>
                  <Eye className="w-8 h-8 text-primary/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Saved Items</p>
                    <p className="text-2xl font-bold text-foreground">
                      {loading ? "..." : (stats.savedDocuments || 0)}
                    </p>
                  </div>
                  <BookmarkCheck className="w-8 h-8 text-yellow-500/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Contributions</p>
                    <p className="text-2xl font-bold text-foreground">
                      {loading ? "..." : (stats.contributions || 0)}
                    </p>
                  </div>
                  <Upload className="w-8 h-8 text-green-500/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Downloads</p>
                    <p className="text-2xl font-bold text-foreground">
                      {loading ? "..." : (stats.downloadCount || 0).toLocaleString()}
                    </p>
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
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="glass p-4 rounded-lg animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : recentlyViewedFiltered.length > 0 ? (
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
                          {doc.author} • {new Date(doc.date).toLocaleDateString()}
                          {doc.department && ` • ${doc.department}`}
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
              ) : (
                <div className="glass rounded-lg p-8 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No recently viewed documents</p>
                  <p className="text-sm text-muted-foreground mt-1">Start exploring the library to see your recent activity</p>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          {!searchQuery && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Quick Links */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span>Quick Actions</span>
                  </h2>
                </div>

                <div className="space-y-3">
                  <Link href="/saved-documents" className="glass glow-hover p-4 rounded-lg block">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">Saved Documents</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          View your bookmarked documents ({stats.savedDocuments || 0})
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>

                  <Link href="/your-contributions" className="glass glow-hover p-4 rounded-lg block">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">Your Contributions</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Manage your uploaded documents ({stats.contributions || 0})
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>

                  <Link href="/library" className="glass glow-hover p-4 rounded-lg block">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">Browse Library</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Explore all available documents
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                </div>
              </div>

              {/* Upload Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
                    <Upload className="w-5 h-5 text-green-500" />
                    <span>Contribute</span>
                  </h2>
                </div>

                <div className="glass rounded-lg p-6 text-center">
                  <Upload className="w-12 h-12 text-green-500/50 mx-auto mb-4" />
                  <h3 className="font-medium text-foreground mb-2">Share Knowledge</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload documents to share with your organization
                  </p>
                  <Link
                    href="/upload"
                    className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
                  >
                    Upload Document
                  </Link>
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
