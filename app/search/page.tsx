"use client"

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SearchBar } from '@/components/search/search-bar'
import { AdvancedSearchModal, AdvancedSearchParams } from '@/components/search/advanced-search-modal'
import { SearchResults } from '@/components/search/search-results'
import { Navbar } from '@/components/navbar'
import { useAuth } from '@/context/auth-context'

interface SearchResponse {
  success: boolean
  results: any[]
  total: number
  took: number
  facets?: any
  pagination?: {
    page: number
    page_size: number
    total_pages: number
  }
}

export default function SearchPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showAdvancedModal, setShowAdvancedModal] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [advancedParams, setAdvancedParams] = useState<Partial<AdvancedSearchParams>>({})

  // Initialize from URL params
  useEffect(() => {
    const query = searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1')
    
    // Only update if values actually changed
    if (query !== currentQuery || page !== currentPage) {
      setCurrentQuery(query)
      setCurrentPage(page)
      
      if (query) {
        performSearch(query, page)
      }
    }
  }, [searchParams]) // Remove currentQuery and currentPage from dependencies

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  const performSearch = async (query: string, page: number = 1, params?: Partial<AdvancedSearchParams>) => {
    setIsLoading(true)
    
    try {
      // Build search URL
      const searchUrl = new URL('/api/search', window.location.origin)
      searchUrl.searchParams.set('q', query)
      searchUrl.searchParams.set('page', page.toString())
      searchUrl.searchParams.set('page_size', '20')
      searchUrl.searchParams.set('highlight', 'true')

      // Add advanced parameters if provided
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              value.forEach(v => searchUrl.searchParams.append(key, v))
            } else {
              searchUrl.searchParams.set(key, value.toString())
            }
          }
        })
      }

      const response = await fetch(searchUrl.toString())
      const data = await response.json()

      if (data.success) {
        setSearchResults(data)
        
        // Update URL
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.set('q', query)
        newUrl.searchParams.set('page', page.toString())
        window.history.replaceState({}, '', newUrl.toString())
      } else {
        console.error('Search failed:', data.error)
        setSearchResults({ success: false, results: [], total: 0, took: 0 })
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults({ success: false, results: [], total: 0, took: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBasicSearch = (query: string) => {
    setCurrentQuery(query)
    setCurrentPage(1)
    setAdvancedParams({})
    performSearch(query, 1)
  }

  const handleAdvancedSearch = (params: AdvancedSearchParams) => {
    setCurrentQuery(params.query)
    setCurrentPage(1)
    setAdvancedParams(params)
    performSearch(params.query, 1, params)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    performSearch(currentQuery, page, advancedParams)
  }

  const handleFileView = (fileId: string) => {
    // Open file in new tab or modal
    window.open(`/api/files/${fileId}/view`, '_blank')
  }

  const handleFileDownload = (fileId: string) => {
    // Trigger file download
    window.open(`/api/files/download/${fileId}`, '_blank')
  }

  const handleFacetFilter = (facetType: string, value: string) => {
    // Add facet filter to advanced params
    const newParams = { ...advancedParams }
    
    switch (facetType) {
      case 'department':
        newParams.department = [...(newParams.department || []), value]
        break
      case 'file_type':
        newParams.file_type = [...(newParams.file_type || []), value]
        break
      case 'author':
        newParams.author = [...(newParams.author || []), value]
        break
      case 'tags':
        newParams.tags = [...(newParams.tags || []), value]
        break
    }
    
    setAdvancedParams(newParams)
    performSearch(currentQuery, 1, newParams)
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Search Documents</h1>
          <p className="text-muted-foreground mb-8">
            Search across files, content, departments, tags, and more
          </p>
          
          {/* Search Bar */}
          <div className="flex justify-center">
            <SearchBar
              onSearch={handleBasicSearch}
              onAdvancedSearch={() => setShowAdvancedModal(true)}
              initialValue={currentQuery}
              className="w-full max-w-3xl"
            />
          </div>
        </div>

        {/* Search Results */}
        {(searchResults || isLoading) && (
          <SearchResults
            results={searchResults?.results || []}
            total={searchResults?.total || 0}
            took={searchResults?.took || 0}
            currentPage={currentPage}
            pageSize={20}
            onPageChange={handlePageChange}
            onFileView={handleFileView}
            onFileDownload={handleFileDownload}
            isLoading={isLoading}
            facets={searchResults?.facets}
            onFacetFilter={handleFacetFilter}
          />
        )}

        {/* No initial search state */}
        {!searchResults && !isLoading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Start Your Search</h2>
            <p className="text-muted-foreground">
              Enter keywords, file names, or use advanced search to find documents
            </p>
          </div>
        )}
      </div>

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        onSearch={handleAdvancedSearch}
        initialParams={advancedParams}
      />
    </div>
  )
}