"use client"

import { useState, useEffect } from 'react'
import { X, Search, Calendar, FileText, User, Building, Tag, Eye, Folder, Settings } from 'lucide-react'

interface AdvancedSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (searchParams: AdvancedSearchParams) => void
  initialParams?: Partial<AdvancedSearchParams>
}

export interface AdvancedSearchParams {
  query: string
  department: string[]
  file_type: string[]
  author: string[]
  tags: string[]
  visibility: string[]
  date_from?: string
  date_to?: string
  size_min?: number
  size_max?: number
  folder_path?: string
  has_content?: boolean
  ocr_confidence_min?: number
  search_type: 'basic' | 'advanced' | 'fuzzy' | 'exact'
  sort_field: string
  sort_order: 'asc' | 'desc'
}

export function AdvancedSearchModal({ isOpen, onClose, onSearch, initialParams }: AdvancedSearchModalProps) {
  const [searchParams, setSearchParams] = useState<AdvancedSearchParams>({
    query: '',
    department: [],
    file_type: [],
    author: [],
    tags: [],
    visibility: [],
    search_type: 'basic',
    sort_field: 'created_at',
    sort_order: 'desc',
    ...initialParams
  })

  const [facets, setFacets] = useState<{
    departments: Array<{ key: string; count: number }>
    file_types: Array<{ key: string; count: number }>
    authors: Array<{ key: string; count: number }>
    tags: Array<{ key: string; count: number }>
  }>({
    departments: [],
    file_types: [],
    authors: [],
    tags: []
  })

  // Load facets for filters
  useEffect(() => {
    if (isOpen) {
      loadFacets()
    }
  }, [isOpen])

  const loadFacets = async () => {
    try {
      const response = await fetch('/api/search?q=*&page_size=0')
      const data = await response.json()
      
      if (data.success && data.facets) {
        setFacets(data.facets)
      }
    } catch (error) {
      console.error('Failed to load facets:', error)
    }
  }

  const handleSearch = () => {
    onSearch(searchParams)
    onClose()
  }

  const handleReset = () => {
    setSearchParams({
      query: '',
      department: [],
      file_type: [],
      author: [],
      tags: [],
      visibility: [],
      search_type: 'basic',
      sort_field: 'created_at',
      sort_order: 'desc'
    })
  }

  const updateArrayField = (field: keyof AdvancedSearchParams, value: string, checked: boolean) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: checked
        ? [...(prev[field] as string[]), value]
        : (prev[field] as string[]).filter(item => item !== value)
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Advanced Search</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Search Query */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchParams.query}
                onChange={(e) => setSearchParams(prev => ({ ...prev, query: e.target.value }))}
                placeholder="Enter your search terms..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Search Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Search Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'basic', label: 'Basic' },
                { value: 'exact', label: 'Exact Match' },
                { value: 'fuzzy', label: 'Fuzzy' },
                { value: 'advanced', label: 'Advanced Syntax' }
              ].map(type => (
                <label key={type.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="search_type"
                    value={type.value}
                    checked={searchParams.search_type === type.value}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, search_type: e.target.value as any }))}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Departments */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center space-x-2">
                <Building className="h-4 w-4" />
                <span>Departments</span>
              </label>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                {facets.departments.map(dept => (
                  <label key={dept.key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchParams.department.includes(dept.key)}
                      onChange={(e) => updateArrayField('department', dept.key, e.target.checked)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{dept.key}</span>
                    <span className="text-xs text-muted-foreground">({dept.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* File Types */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>File Types</span>
              </label>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                {facets.file_types.map(type => (
                  <label key={type.key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchParams.file_type.includes(type.key)}
                      onChange={(e) => updateArrayField('file_type', type.key, e.target.checked)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{type.key.toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">({type.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Authors */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Authors</span>
              </label>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                {facets.authors.map(author => (
                  <label key={author.key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchParams.author.includes(author.key)}
                      onChange={(e) => updateArrayField('author', author.key, e.target.checked)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{author.key}</span>
                    <span className="text-xs text-muted-foreground">({author.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center space-x-2">
                <Tag className="h-4 w-4" />
                <span>Tags</span>
              </label>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                {facets.tags.slice(0, 20).map(tag => (
                  <label key={tag.key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchParams.tags.includes(tag.key)}
                      onChange={(e) => updateArrayField('tags', tag.key, e.target.checked)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{tag.key}</span>
                    <span className="text-xs text-muted-foreground">({tag.count})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Date Range</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={searchParams.date_from || ''}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, date_from: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={searchParams.date_to || ''}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, date_to: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center space-x-2">
                <Eye className="h-4 w-4" />
                <span>Visibility</span>
              </label>
              <div className="space-y-1">
                {['private', 'org', 'public'].map(vis => (
                  <label key={vis} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchParams.visibility.includes(vis)}
                      onChange={(e) => updateArrayField('visibility', vis, e.target.checked)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground capitalize">{vis}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* File Size */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">File Size (MB)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Min</label>
                  <input
                    type="number"
                    value={searchParams.size_min || ''}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, size_min: e.target.value ? parseInt(e.target.value) * 1024 * 1024 : undefined }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max</label>
                  <input
                    type="number"
                    value={searchParams.size_max ? Math.round(searchParams.size_max / (1024 * 1024)) : ''}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, size_max: e.target.value ? parseInt(e.target.value) * 1024 * 1024 : undefined }))}
                    placeholder="100"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Folder Path */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center space-x-2">
              <Folder className="h-4 w-4" />
              <span>Folder Path</span>
            </label>
            <input
              type="text"
              value={searchParams.folder_path || ''}
              onChange={(e) => setSearchParams(prev => ({ ...prev, folder_path: e.target.value }))}
              placeholder="e.g., /documents/reports"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Sort Options */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Sort By</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={searchParams.sort_field}
                onChange={(e) => setSearchParams(prev => ({ ...prev, sort_field: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="created_at">Date Created</option>
                <option value="updated_at">Date Modified</option>
                <option value="title.keyword">Title</option>
                <option value="author">Author</option>
                <option value="size_bytes">File Size</option>
                <option value="_score">Relevance</option>
              </select>
              <select
                value={searchParams.sort_order}
                onChange={(e) => setSearchParams(prev => ({ ...prev, sort_order: e.target.value as 'asc' | 'desc' }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset All
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}