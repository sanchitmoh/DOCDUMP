import { Client } from '@elastic/elasticsearch'
import crypto from 'crypto'

export interface ElasticsearchConfig {
  url: string
  username?: string
  password?: string
  apiKey?: string
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
    department?: string
    file_type?: string
    author?: string
    tags?: string[]
    date_range?: {
      from?: string
      to?: string
    }
    size_range?: {
      min?: number
      max?: number
    }
  }
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  pagination?: {
    from: number
    size: number
  }
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
  }
}

export class ElasticsearchService {
  private client: Client
  private indexPrefix: string

  constructor(config: ElasticsearchConfig) {
    const clientConfig: any = {
      node: config.url,
      requestTimeout: 30000,
      pingTimeout: 3000
    }

    // Authentication
    if (config.apiKey) {
      clientConfig.auth = {
        apiKey: config.apiKey
      }
    } else if (config.username && config.password) {
      clientConfig.auth = {
        username: config.username,
        password: config.password
      }
    }

    // Security settings
    if (config.url.startsWith('https://')) {
      clientConfig.tls = {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    }

    this.client = new Client(clientConfig)
    this.indexPrefix = config.indexPrefix || 'corporate'
  }

  /**
   * Get index name for documents
   */
  private getDocumentsIndex(): string {
    return `${this.indexPrefix}_documents`
  }

  /**
   * Health check for Elasticsearch
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      const response = await this.client.cluster.health()
      const healthStatus = response.status || 'unknown'
      
      if (healthStatus === 'green' || healthStatus === 'yellow') {
        return {
          status: 'healthy',
          message: `Elasticsearch cluster is ${healthStatus}`
        }
      } else {
        return {
          status: 'unhealthy',
          message: `Elasticsearch cluster status: ${healthStatus}`
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
      
      if (!exists) {
        await this.client.indices.create({
          index: documentsIndex,
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
        })

        console.log(`Created Elasticsearch index: ${documentsIndex}`)
      }
    } catch (error) {
      console.error('Create index error:', error)
      throw new Error(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Index a document in Elasticsearch
   */
  async indexDocument(content: DocumentContent): Promise<boolean> {
    try {
      // STEP 1: HARD validation before indexing (mandatory)
      const validationError = this.validateDocumentContent(content)
      if (validationError) {
        console.error('Document validation failed:', validationError)
        throw new Error(`Document validation failed: ${validationError}`)
      }

      // Ensure index exists before indexing
      await this.createIndex()
      
      const documentId = this.generateDocumentId(content.file_id, content.organization_id)
      
      // STEP 2: Truncate large content safely (industry standard)
      const processedContent = this.processContentForIndexing(content)
      
      const document = {
        ...processedContent,
        indexed_at: new Date(),
        search_text: this.buildSearchText(processedContent),
      }

      console.log(`Indexing document ${documentId} - Content length: ${document.content.length}, Extracted text length: ${document.extracted_text?.length || 0}`)

      await this.client.index({
        index: this.getDocumentsIndex(),
        id: documentId,
        document: document,
        refresh: 'wait_for'
      })

      console.log(`✅ Document indexed successfully: ${documentId}`)
      return true
    } catch (error) {
      // STEP 3: Log REAL Elasticsearch error (critical)
      console.error('❌ Elasticsearch indexing error for document:', {
        file_id: content.file_id,
        organization_id: content.organization_id,
        title: content.title,
        content_length: content.content?.length || 0,
        extracted_text_length: content.extracted_text?.length || 0
      })
      console.error('Full error details:', error)
      
      // Log the actual Elasticsearch response if available
      if (error && typeof error === 'object' && 'meta' in error) {
        console.error('Elasticsearch meta:', (error as any).meta)
      }
      if (error && typeof error === 'object' && 'body' in error) {
        console.error('Elasticsearch body:', (error as any).body)
      }
      
      return false
    }
  }

  /**
   * Search documents with basic functionality
   */
  async searchDocuments(searchQuery: SearchQuery): Promise<SearchResponse> {
    try {
      const { query, organizationId, pagination } = searchQuery
      
      // Build basic Elasticsearch query
      const esQuery: any = {
        bool: {
          must: [
            { term: { organization_id: organizationId } }
          ]
        }
      }

      // Add text search if provided
      if (query && query.trim() && query !== '*') {
        esQuery.bool.must.push({
          multi_match: {
            query: query,
            fields: ['title^3', 'content^2', 'extracted_text^1.5'],
            fuzziness: 'AUTO'
          }
        })
      } else {
        esQuery.bool.must.push({ match_all: {} })
      }

      // Execute search
      const response = await this.client.search({
        index: this.getDocumentsIndex(),
        query: esQuery,
        from: pagination?.from || 0,
        size: pagination?.size || 20,
        sort: query && query.trim() && query !== '*' ? ['_score'] : [{ created_at: { order: 'desc' } }]
      })

      // Process results
      const results: SearchResult[] = response.hits.hits.map((hit: any) => ({
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
        score: hit._score || 0
      }))

      // Handle total hits properly
      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : response.hits.total?.value || 0

      return {
        results,
        total,
        took: response.took || 0,
        facets: {
          departments: [],
          file_types: [],
          authors: []
        }
      }

    } catch (error) {
      console.error('Elasticsearch search error:', error)
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(fileId: string): Promise<boolean> {
    try {
      const documentId = crypto.createHash('sha256')
        .update(`${fileId}`)
        .digest('hex')

      await this.client.delete({
        index: this.getDocumentsIndex(),
        id: documentId
      })

      console.log(`Document deleted successfully: ${documentId}`)
      return true
    } catch (error) {
      console.error('Elasticsearch delete error:', error)
      return false
    }
  }

  // Private helper methods
  private generateDocumentId(fileId: string, organizationId: string): string {
    return crypto.createHash('sha256')
      .update(`${organizationId}:${fileId}`)
      .digest('hex')
  }

  /**
   * STEP 1: Validate document content before indexing
   */
  private validateDocumentContent(content: DocumentContent): string | null {
    // Required fields validation
    if (!content.file_id || content.file_id.trim() === '') {
      return 'file_id is required and cannot be empty'
    }
    
    if (!content.organization_id || content.organization_id.trim() === '') {
      return 'organization_id is required and cannot be empty'
    }
    
    if (!content.title || content.title.trim() === '') {
      return 'title is required and cannot be empty'
    }
    
    // Data type validation
    if (typeof content.file_id !== 'string') {
      return 'file_id must be a string'
    }
    
    if (typeof content.organization_id !== 'string') {
      return 'organization_id must be a string'
    }
    
    if (typeof content.title !== 'string') {
      return 'title must be a string'
    }
    
    // Size validation
    if (content.size_bytes && (typeof content.size_bytes !== 'number' || content.size_bytes < 0)) {
      return 'size_bytes must be a non-negative number'
    }
    
    // Date validation
    if (content.created_at && !(content.created_at instanceof Date)) {
      return 'created_at must be a Date object'
    }
    
    if (content.updated_at && !(content.updated_at instanceof Date)) {
      return 'updated_at must be a Date object'
    }
    
    // Visibility validation
    if (content.visibility && !['private', 'org', 'public'].includes(content.visibility)) {
      return 'visibility must be one of: private, org, public'
    }
    
    return null // Valid
  }

  /**
   * STEP 2: Process and truncate content safely for indexing
   */
  private processContentForIndexing(content: DocumentContent): DocumentContent {
    const MAX_CONTENT_LENGTH = 50000 // 50KB limit for main content
    const MAX_EXTRACTED_TEXT_LENGTH = 100000 // 100KB limit for extracted text
    const MAX_TITLE_LENGTH = 500
    const MAX_AUTHOR_LENGTH = 200
    const MAX_DEPARTMENT_LENGTH = 100
    
    const processed = { ...content }
    
    // Truncate title
    if (processed.title && processed.title.length > MAX_TITLE_LENGTH) {
      processed.title = processed.title.substring(0, MAX_TITLE_LENGTH - 3) + '...'
      console.warn(`Title truncated for file ${processed.file_id}: ${processed.title.length} -> ${MAX_TITLE_LENGTH}`)
    }
    
    // Truncate and clean content
    if (processed.content) {
      if (processed.content.length > MAX_CONTENT_LENGTH) {
        processed.content = processed.content.substring(0, MAX_CONTENT_LENGTH - 3) + '...'
        console.warn(`Content truncated for file ${processed.file_id}: original length -> ${MAX_CONTENT_LENGTH}`)
      }
      // Remove null bytes and control characters that can break Elasticsearch
      processed.content = processed.content.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    }
    
    // Truncate and clean extracted text
    if (processed.extracted_text) {
      if (processed.extracted_text.length > MAX_EXTRACTED_TEXT_LENGTH) {
        processed.extracted_text = processed.extracted_text.substring(0, MAX_EXTRACTED_TEXT_LENGTH - 3) + '...'
        console.warn(`Extracted text truncated for file ${processed.file_id}: original length -> ${MAX_EXTRACTED_TEXT_LENGTH}`)
      }
      // Remove null bytes and control characters
      processed.extracted_text = processed.extracted_text.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    }
    
    // Truncate author and department
    if (processed.author && processed.author.length > MAX_AUTHOR_LENGTH) {
      processed.author = processed.author.substring(0, MAX_AUTHOR_LENGTH - 3) + '...'
    }
    
    if (processed.department && processed.department.length > MAX_DEPARTMENT_LENGTH) {
      processed.department = processed.department.substring(0, MAX_DEPARTMENT_LENGTH - 3) + '...'
    }
    
    // Ensure arrays are properly formatted
    if (processed.tags && !Array.isArray(processed.tags)) {
      processed.tags = []
    }
    
    // Set defaults for required fields
    processed.content = processed.content || ''
    processed.author = processed.author || ''
    processed.department = processed.department || ''
    processed.tags = processed.tags || []
    processed.file_type = processed.file_type || 'other'
    processed.mime_type = processed.mime_type || 'application/octet-stream'
    processed.size_bytes = processed.size_bytes || 0
    processed.visibility = processed.visibility || 'private'
    processed.folder_path = processed.folder_path || ''
    processed.extracted_text = processed.extracted_text || ''
    
    return processed
  }

  private buildSearchText(content: DocumentContent): string {
    const parts = [
      content.title,
      content.content,
      content.extracted_text,
      content.author,
      content.department,
      ...(content.tags || [])
    ].filter(Boolean)

    return parts.join(' ')
  }

  private generateContentSnippet(content: string, query?: string, maxLength: number = 200): string {
    if (!content) return ''
    
    if (query && query.trim() && query !== '*') {
      // Try to find the query in the content and create a snippet around it
      const queryLower = query.toLowerCase()
      const contentLower = content.toLowerCase()
      const index = contentLower.indexOf(queryLower)
      
      if (index !== -1) {
        const start = Math.max(0, index - 50)
        const end = Math.min(content.length, index + query.length + 150)
        let snippet = content.substring(start, end)
        
        if (start > 0) snippet = '...' + snippet
        if (end < content.length) snippet = snippet + '...'
        
        return snippet
      }
    }
    
    // Default snippet from beginning
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content
  }
}

// Factory function
export function createElasticsearchService(): ElasticsearchService {
  const config: ElasticsearchConfig = {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    apiKey: process.env.ELASTICSEARCH_API_KEY,
    indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'corporate'
  }

  return new ElasticsearchService(config)
}