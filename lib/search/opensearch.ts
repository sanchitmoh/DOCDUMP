import { Client } from '@opensearch-project/opensearch'
import crypto from 'crypto'

export interface OpenSearchConfig {
  url: string
  username?: string
  password?: string
  indexPrefix?: string
}

export interface DocumentContent {
  file_id: string
  organization_id: string
  title: string
  content: string
  author?: string
  department?: string
  tags?: string[]
  file_type: string
  mime_type: string
  size_bytes: number
  created_at: Date
  updated_at: Date
  extracted_text?: string
  ocr_confidence?: number
  language?: string
  visibility: 'private' | 'org' | 'public'
  folder_path?: string
}

export interface SearchQuery {
  query: string
  organizationId: string
  filters?: {
    department?: string[]
    file_type?: string[]
    author?: string[]
    tags?: string[]
    date_range?: {
      from?: string
      to?: string
    }
    size_range?: {
      min?: number
      max?: number
    }
    visibility?: string[]
    folder_path?: string
    has_content?: boolean
    ocr_confidence_min?: number
  }
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  pagination?: {
    from: number
    size: number
  }
  search_type?: 'basic' | 'advanced' | 'fuzzy' | 'exact'
  highlight?: boolean
}

export interface SearchResult {
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

export interface SearchResponse {
  results: SearchResult[]
  total: number
  took: number
  facets?: {
    departments: Array<{ key: string; count: number }>
    file_types: Array<{ key: string; count: number }>
    authors: Array<{ key: string; count: number }>
    tags: Array<{ key: string; count: number }>
    visibility: Array<{ key: string; count: number }>
  }
  suggestions?: string[]
  query_info?: {
    parsed_query: string
    search_type: string
    filters_applied: number
  }
}

export class OpenSearchService {
  private client: Client
  private indexPrefix: string

  constructor(config: OpenSearchConfig) {
    const clientConfig: any = {
      node: config.url,
      requestTimeout: 30000,
      pingTimeout: 3000,
    }

    // Authentication
    if (config.username && config.password) {
      clientConfig.auth = {
        username: config.username,
        password: config.password
      }
    }

    // Security settings
    if (config.url.startsWith('https://')) {
      clientConfig.ssl = {
        rejectUnauthorized: false
      }
    }

    this.client = new Client(clientConfig)
    this.indexPrefix = config.indexPrefix || 'corporate'
    
    console.log('📊 OpenSearch client initialized:', {
      node: config.url,
      isBonsai: config.url.includes('bonsaisearch.net')
    })
  }

  /**
   * Get index name for documents
   */
  private getDocumentsIndex(): string {
    return `${this.indexPrefix}_documents`
  }

  /**
   * Health check for OpenSearch
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      const response = await this.client.cluster.health()
      const healthStatus = response.body.status || 'unknown'
      
      if (healthStatus === 'green' || healthStatus === 'yellow') {
        return {
          status: 'healthy',
          message: `OpenSearch cluster is ${healthStatus}`
        }
      } else {
        return {
          status: 'unhealthy',
          message: `OpenSearch cluster status: ${healthStatus}`
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed'
      }
    }
  }

  /**
   * Create index with proper mappings
   */
  async createIndex(): Promise<void> {
    try {
      const documentsIndex = this.getDocumentsIndex()
      
      // Check if index exists
      const exists = await this.client.indices.exists({ index: documentsIndex })
      
      if (!exists.body) {
        await this.client.indices.create({
          index: documentsIndex,
          body: {
            mappings: {
              properties: {
                file_id: { type: 'keyword' },
                organization_id: { type: 'keyword' },
                title: { 
                  type: 'text', 
                  analyzer: 'standard',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                content: { type: 'text', analyzer: 'standard' },
                author: { type: 'keyword' },
                department: { type: 'keyword' },
                tags: { type: 'keyword' },
                file_type: { type: 'keyword' },
                mime_type: { type: 'keyword' },
                size_bytes: { type: 'long' },
                created_at: { type: 'date' },
                updated_at: { type: 'date' },
                indexed_at: { type: 'date' },
                extracted_text: { type: 'text', analyzer: 'standard' },
                ocr_confidence: { type: 'float' },
                language: { type: 'keyword' },
                visibility: { type: 'keyword' },
                folder_path: { type: 'text' },
                search_text: { type: 'text', analyzer: 'standard' }
              }
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1
            }
          }
        })

        console.log(`Created OpenSearch index: ${documentsIndex}`)
      }
    } catch (error) {
      console.error('Create index error:', error)
      throw new Error(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Index a document in OpenSearch
   */
  async indexDocument(content: DocumentContent): Promise<boolean> {
    try {
      // Validation
      const validationError = this.validateDocumentContent(content)
      if (validationError) {
        console.log(`❌ OpenSearch indexing error: ${validationError}`)
        throw new Error(`Document validation failed: ${validationError}`)
      }

      // Ensure index exists
      await this.createIndex()
      
      const documentId = this.generateDocumentId(content.file_id, content.organization_id)
      
      // Process content
      const processedContent = this.processContentForIndexing(content)
      
      const document = {
        ...processedContent,
        indexed_at: new Date(),
        search_text: this.buildSearchText(processedContent),
      }

      console.log(`Indexing document ${documentId} - Content: ${document.content.length}B, Extracted: ${document.extracted_text?.length || 0}B`)

      await this.client.index({
        index: this.getDocumentsIndex(),
        id: documentId,
        body: document,
        refresh: 'wait_for'
      })

      console.log(`✅ Document indexed successfully: ${documentId}`)
      return true
    } catch (error) {
      console.error('❌ OpenSearch indexing error:', error)
      return false
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(searchQuery: SearchQuery): Promise<SearchResponse> {
    try {
      const { query, organizationId, filters, pagination, search_type, highlight } = searchQuery
      
      // Build query
      const esQuery: any = {
        bool: {
          must: [
            { term: { organization_id: organizationId } }
          ],
          filter: [],
          should: [],
          must_not: []
        }
      }

      // Add text search
      if (query && query.trim() && query !== '*') {
        const searchFields = ['title^3', 'content^2', 'extracted_text^1.5', 'author^1.2', 'department^1.1', 'tags^1.1']
        
        switch (search_type) {
          case 'exact':
            esQuery.bool.must.push({
              multi_match: {
                query: query,
                fields: searchFields,
                type: 'phrase'
              }
            })
            break
          case 'fuzzy':
            esQuery.bool.must.push({
              multi_match: {
                query: query,
                fields: searchFields,
                fuzziness: 'AUTO'
              }
            })
            break
          default:
            esQuery.bool.must.push({
              multi_match: {
                query: query,
                fields: searchFields,
                type: 'best_fields',
                fuzziness: 'AUTO',
                operator: 'and'
              }
            })
        }
      } else {
        esQuery.bool.must.push({ match_all: {} })
      }

      // Apply filters
      if (filters) {
        if (filters.department?.length) {
          esQuery.bool.filter.push({ terms: { department: filters.department } })
        }
        if (filters.file_type?.length) {
          esQuery.bool.filter.push({ terms: { file_type: filters.file_type } })
        }
        if (filters.author?.length) {
          esQuery.bool.filter.push({ terms: { author: filters.author } })
        }
        if (filters.tags?.length) {
          esQuery.bool.filter.push({ terms: { tags: filters.tags } })
        }
        if (filters.visibility?.length) {
          esQuery.bool.filter.push({ terms: { visibility: filters.visibility } })
        }
        if (filters.date_range) {
          const dateFilter: any = { range: { created_at: {} } }
          if (filters.date_range.from) dateFilter.range.created_at.gte = filters.date_range.from
          if (filters.date_range.to) dateFilter.range.created_at.lte = filters.date_range.to
          esQuery.bool.filter.push(dateFilter)
        }
      }

      // Build aggregations
      const aggregations = {
        departments: { terms: { field: 'department', size: 50 } },
        file_types: { terms: { field: 'file_type', size: 20 } },
        authors: { terms: { field: 'author', size: 50 } },
        tags: { terms: { field: 'tags', size: 100 } },
        visibility: { terms: { field: 'visibility', size: 10 } }
      }

      // Highlight config
      const highlightConfig = highlight ? {
        fields: {
          title: { fragment_size: 150, number_of_fragments: 1 },
          content: { fragment_size: 150, number_of_fragments: 3 },
          extracted_text: { fragment_size: 150, number_of_fragments: 2 }
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>']
      } : undefined

      // Sort
      let sortConfig: any[]
      if (searchQuery.sort) {
        sortConfig = [{ [searchQuery.sort.field]: { order: searchQuery.sort.order } }]
      } else if (query && query.trim() && query !== '*') {
        sortConfig = ['_score', { created_at: { order: 'desc' } }]
      } else {
        sortConfig = [{ created_at: { order: 'desc' } }]
      }

      // Execute search
      const response = await this.client.search({
        index: this.getDocumentsIndex(),
        body: {
          query: esQuery,
          aggregations,
          highlight: highlightConfig,
          from: pagination?.from || 0,
          size: pagination?.size || 20,
          sort: sortConfig,
          track_total_hits: true
        }
      })

      // Process results
      const results: SearchResult[] = response.body.hits.hits.map((hit: any) => ({
        file_id: hit._source.file_id,
        title: hit._source.title,
        content_snippet: this.generateContentSnippet(
          hit._source.content || hit._source.extracted_text || '',
          query
        ),
        author: hit._source.author,
        department: hit._source.department,
        file_type: hit._source.file_type,
        size_bytes: hit._source.size_bytes,
        created_at: new Date(hit._source.created_at),
        score: hit._score || 0,
        highlights: hit.highlight ? {
          title: hit.highlight.title,
          content: hit.highlight.content || hit.highlight.extracted_text
        } : undefined
      }))

      // Process facets
      const aggs = response.body.aggregations
      const facets = {
        departments: aggs?.departments?.buckets?.map((b: any) => ({ key: b.key, count: b.doc_count })) || [],
        file_types: aggs?.file_types?.buckets?.map((b: any) => ({ key: b.key, count: b.doc_count })) || [],
        authors: aggs?.authors?.buckets?.map((b: any) => ({ key: b.key, count: b.doc_count })) || [],
        tags: aggs?.tags?.buckets?.map((b: any) => ({ key: b.key, count: b.doc_count })) || [],
        visibility: aggs?.visibility?.buckets?.map((b: any) => ({ key: b.key, count: b.doc_count })) || []
      }

      const total = typeof response.body.hits.total === 'number' 
        ? response.body.hits.total 
        : response.body.hits.total?.value || 0

      return {
        results,
        total,
        took: response.body.took || 0,
        facets,
        query_info: {
          parsed_query: query || '*',
          search_type: search_type || 'basic',
          filters_applied: this.countAppliedFilters(filters)
        }
      }

    } catch (error) {
      console.error('OpenSearch search error:', error)
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partialQuery: string, organizationId: string): Promise<string[]> {
    try {
      if (!partialQuery || partialQuery.length < 2) {
        return []
      }

      // OpenSearch doesn't support completion suggester the same way as Elasticsearch
      // Use a simple prefix search on titles instead
      const response = await this.client.search({
        index: this.getDocumentsIndex(),
        body: {
          query: {
            bool: {
              must: [
                { term: { organization_id: organizationId } },
                {
                  multi_match: {
                    query: partialQuery,
                    fields: ['title^3', 'tags^2'],
                    type: 'phrase_prefix'
                  }
                }
              ]
            }
          },
          size: 10,
          _source: ['title']
        }
      })

      const suggestions = response.body.hits.hits.map((hit: any) => hit._source.title)
      // Remove duplicates
      return [...new Set(suggestions)]
    } catch (error) {
      console.error('Search suggestions error:', error)
      return []
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(fileId: string, organizationId: string): Promise<boolean> {
    try {
      const documentId = this.generateDocumentId(fileId, organizationId)

      await this.client.delete({
        index: this.getDocumentsIndex(),
        id: documentId
      })

      console.log(`Document deleted: ${documentId}`)
      return true
    } catch (error) {
      console.error('OpenSearch delete error:', error)
      return false
    }
  }

  // Helper methods
  private generateDocumentId(fileId: string, organizationId: string): string {
    return crypto.createHash('sha256')
      .update(`${organizationId}:${fileId}`)
      .digest('hex')
  }

  private validateDocumentContent(content: DocumentContent): string | null {
    if (!content.file_id?.trim()) return 'file_id is required'
    if (!content.organization_id?.trim()) return 'organization_id is required'
    if (!content.title?.trim()) return 'title is required'
    return null
  }

  private processContentForIndexing(content: DocumentContent): DocumentContent {
    const MAX_CONTENT = 50000
    const MAX_EXTRACTED = 100000
    
    const processed = { ...content }
    
    if (processed.content?.length > MAX_CONTENT) {
      processed.content = processed.content.substring(0, MAX_CONTENT - 3) + '...'
    }
    
    if (processed.extracted_text?.length > MAX_EXTRACTED) {
      processed.extracted_text = processed.extracted_text.substring(0, MAX_EXTRACTED - 3) + '...'
    }
    
    // Clean content
    if (processed.content) {
      processed.content = processed.content.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    }
    if (processed.extracted_text) {
      processed.extracted_text = processed.extracted_text.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    }
    
    // Defaults
    processed.content = processed.content || ''
    processed.author = processed.author || ''
    processed.department = processed.department || ''
    processed.tags = processed.tags || []
    processed.visibility = processed.visibility || 'private'
    processed.extracted_text = processed.extracted_text || ''
    
    return processed
  }

  private buildSearchText(content: DocumentContent): string {
    return [
      content.title,
      content.content,
      content.extracted_text,
      content.author,
      content.department,
      ...(content.tags || [])
    ].filter(Boolean).join(' ')
  }

  private generateContentSnippet(content: string, query?: string, maxLength: number = 200): string {
    if (!content) return ''
    
    if (query && query.trim() && query !== '*') {
      const index = content.toLowerCase().indexOf(query.toLowerCase())
      if (index !== -1) {
        const start = Math.max(0, index - 50)
        const end = Math.min(content.length, index + query.length + 150)
        let snippet = content.substring(start, end)
        if (start > 0) snippet = '...' + snippet
        if (end < content.length) snippet = snippet + '...'
        return snippet
      }
    }
    
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content
  }

  private countAppliedFilters(filters?: SearchQuery['filters']): number {
    if (!filters) return 0
    let count = 0
    if (filters.department?.length) count++
    if (filters.file_type?.length) count++
    if (filters.author?.length) count++
    if (filters.tags?.length) count++
    if (filters.visibility?.length) count++
    if (filters.date_range?.from || filters.date_range?.to) count++
    return count
  }
}

// Factory function
export function createOpenSearchService(): OpenSearchService {
  const config: OpenSearchConfig = {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'corporate'
  }

  return new OpenSearchService(config)
}
