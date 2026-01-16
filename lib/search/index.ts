/**
 * Smart search service factory
 * Automatically detects if using Bonsai (OpenSearch) or native Elasticsearch
 */

import { createOpenSearchService, OpenSearchService } from './opensearch'
import { createElasticsearchService, ElasticsearchService } from './elasticsearch'

export type SearchService = OpenSearchService | ElasticsearchService

/**
 * Create the appropriate search service based on configuration
 * - Uses OpenSearch client for Bonsai URLs
 * - Uses Elasticsearch client for native Elasticsearch
 */
export function createSearchService(): SearchService {
  const elasticsearchUrl = process.env.ELASTICSEARCH_URL || ''
  
  // Detect if using Bonsai (which is OpenSearch-based)
  const isBonsai = elasticsearchUrl.includes('bonsaisearch.net')
  
  if (isBonsai) {
    console.log('🔍 Using OpenSearch client for Bonsai')
    return createOpenSearchService()
  } else {
    console.log('🔍 Using Elasticsearch client')
    return createElasticsearchService()
  }
}

// Re-export types for convenience
export type {
  DocumentContent,
  SearchQuery,
  SearchResult,
  SearchResponse
} from './opensearch'
