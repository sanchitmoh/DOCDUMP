/**
 * Smart search service factory
 * Automatically detects if using Bonsai (OpenSearch) or native Elasticsearch
 * Uses hybrid search to combine indexed and non-indexed documents
 */

import { createOpenSearchService, OpenSearchService } from './opensearch'
import { createElasticsearchService, ElasticsearchService } from './elasticsearch'
import { HybridSearchService } from './hybrid-search'

export type SearchService = OpenSearchService | ElasticsearchService | HybridSearchService

/**
 * Create the appropriate search service based on configuration
 * - Uses OpenSearch client for Bonsai URLs
 * - Uses Elasticsearch client for native Elasticsearch
 * - Wraps in HybridSearchService for database fallback
 */
export function createSearchService(): SearchService {
  const elasticsearchUrl = process.env.ELASTICSEARCH_URL || ''
  const useHybridSearch = process.env.USE_HYBRID_SEARCH !== 'false' // Default to true
  
  // Detect if using Bonsai (which is OpenSearch-based)
  const isBonsai = elasticsearchUrl.includes('bonsaisearch.net')
  
  let baseService: OpenSearchService | ElasticsearchService
  
  if (isBonsai) {
    console.log('🔍 Using OpenSearch client for Bonsai')
    baseService = createOpenSearchService()
  } else {
    console.log('🔍 Using Elasticsearch client')
    baseService = createElasticsearchService()
  }

  // Wrap in hybrid search if enabled
  if (useHybridSearch) {
    console.log('🔄 Hybrid search enabled (Elasticsearch + Database)')
    return new HybridSearchService(baseService)
  }

  return baseService
}

// Re-export types for convenience
export type {
  DocumentContent,
  SearchQuery,
  SearchResult,
  SearchResponse
} from './opensearch'
