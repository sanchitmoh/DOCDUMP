"use client"

import { useState } from 'react'
import { FileText, Download, Eye, Calendar, User, Building, Tag, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'

interface SearchResult {
  file_id: string
  title: string
  content_snippet: string
  author?: string
  department?: string
  file_type: string
  size_bytes: number
  created_at: Date
  score: number
  highlights?: {
    title?: string[]
    content?: string[]
  }
}

interface SearchResultsProps {
  results: SearchResult[]
  total: number
  took: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onFileView: (fileId: string) => void
  onFileDownload: (fileId: string) => void
  isLoading?: boolean
  facets?: {
    departments: Array<{ key: string; count: number }>
    file_types: Array<{ key: string; count: number }>
    authors: Array<{ key: string; count: number }>
    tags: Array<{ key: string; count: number }>
  }
  onFacetFilter?: (facetType: string, value: string) => void
}

export function SearchResults({
  results,
  total,
  took,
  currentPage,
  pageSize,
  onPageChange,
  onFileView,
  onFileDownload,
  isLoading = false,
  facets,
  onFacetFilter
}: SearchResultsProps) {
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({})
  
  const totalPages = Math.ceil(total / pageSize)
  const startResult = (currentPage - 1) * pageSize + 1
  const endResult = Math.min(currentPage * pageSize, total)

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return '📄'
      case 'doc':
      case 'docx':
        return '📝'
      case 'xls':
      case 'xlsx':
        return '📊'
      case 'ppt':
      case 'pptx':
        return '📈'
      case 'txt':
        return '📃'
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️'
      default:
        return '📁'
    }
  }

  const handleFacetClick = (facetType: string, value: string) => {
    if (onFacetFilter) {
      onFacetFilter(facetType, value)
    }
  }

  const renderHighlightedText = (text: string, highlights?: string[]) => {
    if (!highlights || highlights.length === 0) {
      return text
    }

    // Use the first highlight if available
    const highlight = highlights[0]
    return (
      <span dangerouslySetInnerHTML={{ __html: highlight }} />
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Searching...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {total > 0 ? (
            <>
              Showing {startResult}-{endResult} of {total.toLocaleString()} results
              <span className="ml-2">({took}ms)</span>
            </>
          ) : (
            'No results found'
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Facets Sidebar */}
        {facets && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-4">Filter Results</h3>
              
              {/* Departments */}
              {facets.departments.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <Building className="h-4 w-4 mr-1" />
                    Departments
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {facets.departments.slice(0, 10).map(dept => (
                      <button
                        key={dept.key}
                        onClick={() => handleFacetClick('department', dept.key)}
                        className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="truncate">{dept.key}</span>
                        <span className="text-xs bg-secondary px-1 rounded">{dept.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File Types */}
              {facets.file_types.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    File Types
                  </h4>
                  <div className="space-y-1">
                    {facets.file_types.map(type => (
                      <button
                        key={type.key}
                        onClick={() => handleFacetClick('file_type', type.key)}
                        className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="flex items-center">
                          <span className="mr-2">{getFileIcon(type.key)}</span>
                          {type.key.toUpperCase()}
                        </span>
                        <span className="text-xs bg-secondary px-1 rounded">{type.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Authors */}
              {facets.authors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    Authors
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {facets.authors.slice(0, 10).map(author => (
                      <button
                        key={author.key}
                        onClick={() => handleFacetClick('author', author.key)}
                        className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="truncate">{author.key}</span>
                        <span className="text-xs bg-secondary px-1 rounded">{author.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {facets.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <Tag className="h-4 w-4 mr-1" />
                    Tags
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {facets.tags.slice(0, 15).map(tag => (
                      <button
                        key={tag.key}
                        onClick={() => handleFacetClick('tags', tag.key)}
                        className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="truncate">{tag.key}</span>
                        <span className="text-xs bg-secondary px-1 rounded">{tag.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className={facets ? "lg:col-span-3" : "lg:col-span-4"}>
          {results.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
              <p className="text-muted-foreground">Try adjusting your search terms or filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <div
                  key={result.file_id}
                  className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getFileIcon(result.file_type)}</span>
                        <h3 className="text-lg font-medium text-foreground truncate">
                          {result.highlights?.title ? (
                            renderHighlightedText(result.title, result.highlights.title)
                          ) : (
                            result.title
                          )}
                        </h3>
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                          {result.file_type.toUpperCase()}
                        </span>
                      </div>

                      {/* Content Snippet */}
                      <p className="text-muted-foreground mb-3 line-clamp-3">
                        {result.highlights?.content ? (
                          renderHighlightedText(result.content_snippet, result.highlights.content)
                        ) : (
                          result.content_snippet
                        )}
                      </p>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {result.author && (
                          <div className="flex items-center space-x-1">
                            <User className="h-4 w-4" />
                            <span>{result.author}</span>
                          </div>
                        )}
                        {result.department && (
                          <div className="flex items-center space-x-1">
                            <Building className="h-4 w-4" />
                            <span>{result.department}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(result.created_at)}</span>
                        </div>
                        <span>{formatBytes(result.size_bytes)}</span>
                        {result.score > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            Score: {result.score.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => onFileView(result.file_id)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                        title="View file"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onFileDownload(result.file_id)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          pageNum === currentPage
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}