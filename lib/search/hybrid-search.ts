import { SearchService } from './index'
import { SearchQuery, SearchResponse, SearchResult } from './opensearch'
import { executeQuery } from '@/lib/database'

/**
 * Hybrid search service that combines Elasticsearch/OpenSearch with database fallback
 * - First searches indexed documents in Elasticsearch
 * - Then searches non-indexed documents in the database
 * - Merges and deduplicates results
 */
export class HybridSearchService {
  constructor(private searchService: SearchService) {}

  /**
   * Perform hybrid search across indexed and non-indexed documents
   */
  async searchDocuments(searchQuery: SearchQuery): Promise<SearchResponse> {
    try {
      // Step 1: Search Elasticsearch/OpenSearch for indexed documents
      const elasticResults = await this.searchService.searchDocuments(searchQuery)

      // Step 2: Search database for non-indexed documents
      const dbResults = await this.searchDatabaseDocuments(searchQuery)

      // Step 3: Merge results, avoiding duplicates
      const mergedResults = this.mergeResults(elasticResults.results, dbResults)

      // Step 4: Apply pagination to merged results
      const paginatedResults = this.paginateResults(
        mergedResults,
        searchQuery.pagination?.from || 0,
        searchQuery.pagination?.size || 20
      )

      return {
        results: paginatedResults,
        total: mergedResults.length,
        took: elasticResults.took,
        facets: elasticResults.facets,
        query_info: {
          ...elasticResults.query_info,
          hybrid_search: true,
          elastic_count: elasticResults.results.length,
          db_count: dbResults.length
        }
      }
    } catch (error) {
      console.error('Hybrid search error:', error)
      // Fallback to database-only search if Elasticsearch fails
      return this.fallbackDatabaseSearch(searchQuery)
    }
  }

  /**
   * Search database for documents that aren't indexed in Elasticsearch
   */
  private async searchDatabaseDocuments(searchQuery: SearchQuery): Promise<SearchResult[]> {
    try {
      const { query, organizationId, filters, pagination } = searchQuery
      
      // Build SQL query
      let sql = `
        SELECT DISTINCT
          f.id as file_id,
          f.name as title,
          f.created_at,
          f.size_bytes,
          f.file_type,
          f.mime_type,
          COALESCE(oe.full_name, o.name) as author,
          d.name as department,
          COALESCE(etc.extracted_text, '') as content
        FROM files f
        LEFT JOIN organization_employees oe ON f.created_by = oe.id
        LEFT JOIN organizations o ON f.organization_id = o.id
        LEFT JOIN departments d ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci 
          AND d.organization_id = f.organization_id
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN search_index_status sis ON f.id = sis.file_id
        WHERE f.organization_id = ?
          AND f.is_deleted = 0
          AND f.is_active = 1
          AND (sis.index_status IS NULL OR sis.index_status != 'indexed')
      `

      const params: any[] = [organizationId]

      // Add search query filter
      if (query && query.trim() && query !== '*') {
        sql += ` AND (
          f.name LIKE ? OR
          f.tags LIKE ? OR
          f.ai_description LIKE ? OR
          etc.extracted_text LIKE ?
        )`
        const searchPattern = `%${query}%`
        params.push(searchPattern, searchPattern, searchPattern, searchPattern)
      }

      // Add filters
      if (filters?.department && filters.department.length > 0) {
        sql += ` AND d.name IN (${filters.department.map(() => '?').join(',')})`
        params.push(...filters.department)
      }

      if (filters?.file_type && filters.file_type.length > 0) {
        sql += ` AND f.file_type IN (${filters.file_type.map(() => '?').join(',')})`
        params.push(...filters.file_type)
      }

      if (filters?.author && filters.author.length > 0) {
        sql += ` AND oe.full_name IN (${filters.author.map(() => '?').join(',')})`
        params.push(...filters.author)
      }

      if (filters?.visibility && filters.visibility.length > 0) {
        sql += ` AND f.visibility IN (${filters.visibility.map(() => '?').join(',')})`
        params.push(...filters.visibility)
      }

      if (filters?.date_range?.from) {
        sql += ` AND f.created_at >= ?`
        params.push(filters.date_range.from)
      }

      if (filters?.date_range?.to) {
        sql += ` AND f.created_at <= ?`
        params.push(filters.date_range.to)
      }

      if (filters?.size_range?.min !== undefined) {
        sql += ` AND f.size_bytes >= ?`
        params.push(filters.size_range.min)
      }

      if (filters?.size_range?.max !== undefined) {
        sql += ` AND f.size_bytes <= ?`
        params.push(filters.size_range.max)
      }

      // Add sorting
      sql += ` ORDER BY f.created_at DESC`

      // Add limit (fetch more than needed for merging)
      sql += ` LIMIT 100`

      const results = await executeQuery(sql, params)

      // Transform to SearchResult format
      return results.map((row: any) => ({
        file_id: row.file_id,
        title: row.title,
        content_snippet: this.generateSnippet(row.content || '', query),
        author: row.author,
        department: row.department,
        file_type: row.file_type,
        size_bytes: row.size_bytes,
        created_at: new Date(row.created_at),
        score: this.calculateRelevanceScore(row, query),
        highlights: undefined
      }))
    } catch (error) {
      console.error('Database search error:', error)
      return []
    }
  }

  /**
   * Fallback to database-only search if Elasticsearch is unavailable
   */
  private async fallbackDatabaseSearch(searchQuery: SearchQuery): Promise<SearchResponse> {
    try {
      const dbResults = await this.searchDatabaseDocuments(searchQuery)
      
      const from = searchQuery.pagination?.from || 0
      const size = searchQuery.pagination?.size || 20
      const paginatedResults = dbResults.slice(from, from + size)

      return {
        results: paginatedResults,
        total: dbResults.length,
        took: 0,
        query_info: {
          parsed_query: searchQuery.query || '*',
          search_type: 'database_fallback',
          filters_applied: 0
        }
      }
    } catch (error) {
      console.error('Fallback database search error:', error)
      return {
        results: [],
        total: 0,
        took: 0
      }
    }
  }

  /**
   * Merge Elasticsearch and database results, removing duplicates
   */
  private mergeResults(elasticResults: SearchResult[], dbResults: SearchResult[]): SearchResult[] {
    const seenIds = new Set<string>()
    const merged: SearchResult[] = []

    // Add Elasticsearch results first (they have better scoring)
    for (const result of elasticResults) {
      if (!seenIds.has(result.file_id)) {
        seenIds.add(result.file_id)
        merged.push(result)
      }
    }

    // Add database results that aren't already included
    for (const result of dbResults) {
      if (!seenIds.has(result.file_id)) {
        seenIds.add(result.file_id)
        merged.push(result)
      }
    }

    // Sort by score (Elasticsearch results will naturally rank higher)
    return merged.sort((a, b) => b.score - a.score)
  }

  /**
   * Paginate merged results
   */
  private paginateResults(results: SearchResult[], from: number, size: number): SearchResult[] {
    return results.slice(from, from + size)
  }

  /**
   * Calculate relevance score for database results
   */
  private calculateRelevanceScore(row: any, query?: string): number {
    if (!query || query === '*') return 0.5

    let score = 0
    const queryLower = query.toLowerCase()

    // Title match (highest weight)
    if (row.title?.toLowerCase().includes(queryLower)) {
      score += 3
    }

    // Content match
    if (row.content?.toLowerCase().includes(queryLower)) {
      score += 2
    }

    // Author match
    if (row.author?.toLowerCase().includes(queryLower)) {
      score += 1
    }

    // Department match
    if (row.department?.toLowerCase().includes(queryLower)) {
      score += 1
    }

    // Normalize score to 0-1 range (but keep it lower than Elasticsearch scores)
    return Math.min(score / 10, 0.7)
  }

  /**
   * Generate content snippet
   */
  private generateSnippet(content: string, query?: string, maxLength: number = 200): string {
    if (!content) return ''

    if (query && query.trim() && query !== '*') {
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

    return content.length > maxLength
      ? content.substring(0, maxLength) + '...'
      : content
  }

  /**
   * Delegate other methods to the underlying search service
   */
  async getSearchSuggestions(partialQuery: string, organizationId: string): Promise<string[]> {
    return this.searchService.getSearchSuggestions(partialQuery, organizationId)
  }

  async healthCheck() {
    return this.searchService.healthCheck()
  }

  async createIndex() {
    return this.searchService.createIndex()
  }

  async indexDocument(content: any) {
    return this.searchService.indexDocument(content)
  }

  async deleteDocument(fileId: string, organizationId: string) {
    return this.searchService.deleteDocument(fileId, organizationId)
  }
}
