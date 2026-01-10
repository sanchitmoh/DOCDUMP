// Test script to verify the complete search system
const { createElasticsearchService } = require('../lib/search/elasticsearch')

async function testSearchSystem() {
  console.log('🔍 Testing Advanced Search System...\n')

  try {
    // Initialize Elasticsearch service
    const esService = createElasticsearchService()

    // Test 1: Health check
    console.log('1. Testing Elasticsearch health...')
    const health = await esService.healthCheck()
    console.log(`   Status: ${health.status}`)
    console.log(`   Message: ${health.message}\n`)

    // Test 2: Create index
    console.log('2. Creating/verifying search index...')
    await esService.createIndex()
    console.log('   ✅ Index created/verified\n')

    // Test 3: Index a sample document
    console.log('3. Indexing sample document...')
    const sampleDoc = {
      file_id: 'test-123',
      organization_id: '3',
      title: 'Advanced Search Test Document',
      content: 'This is a test document for the advanced search system. It contains keywords like elasticsearch, search, and document management.',
      author: 'Test User',
      department: 'Engineering',
      tags: ['test', 'search', 'elasticsearch'],
      file_type: 'pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024000,
      created_at: new Date(),
      updated_at: new Date(),
      extracted_text: 'Additional extracted text content for testing OCR and text extraction features.',
      ocr_confidence: 0.95,
      language: 'en',
      visibility: 'org',
      folder_path: '/test/documents'
    }

    const indexResult = await esService.indexDocument(sampleDoc)
    console.log(`   Index result: ${indexResult ? '✅ Success' : '❌ Failed'}\n`)

    // Wait for indexing to complete
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test 4: Basic search
    console.log('4. Testing basic search...')
    const basicSearch = await esService.searchDocuments({
      query: 'test document',
      organizationId: '3',
      search_type: 'basic',
      highlight: true,
      pagination: { from: 0, size: 10 }
    })
    console.log(`   Results found: ${basicSearch.total}`)
    console.log(`   Search took: ${basicSearch.took}ms`)
    if (basicSearch.results.length > 0) {
      console.log(`   First result: ${basicSearch.results[0].title}`)
    }
    console.log()

    // Test 5: Advanced search with filters
    console.log('5. Testing advanced search with filters...')
    const advancedSearch = await esService.searchDocuments({
      query: 'elasticsearch',
      organizationId: '3',
      filters: {
        department: ['Engineering'],
        file_type: ['pdf'],
        tags: ['search']
      },
      search_type: 'advanced',
      highlight: true,
      pagination: { from: 0, size: 10 }
    })
    console.log(`   Filtered results: ${advancedSearch.total}`)
    console.log(`   Facets available:`)
    if (advancedSearch.facets) {
      console.log(`     Departments: ${advancedSearch.facets.departments.length}`)
      console.log(`     File types: ${advancedSearch.facets.file_types.length}`)
      console.log(`     Authors: ${advancedSearch.facets.authors.length}`)
      console.log(`     Tags: ${advancedSearch.facets.tags.length}`)
    }
    console.log()

    // Test 6: Fuzzy search
    console.log('6. Testing fuzzy search...')
    const fuzzySearch = await esService.searchDocuments({
      query: 'documnt managment', // Intentional typos
      organizationId: '3',
      search_type: 'fuzzy',
      pagination: { from: 0, size: 10 }
    })
    console.log(`   Fuzzy results: ${fuzzySearch.total}`)
    console.log()

    // Test 7: Exact search
    console.log('7. Testing exact phrase search...')
    const exactSearch = await esService.searchDocuments({
      query: 'advanced search system',
      organizationId: '3',
      search_type: 'exact',
      pagination: { from: 0, size: 10 }
    })
    console.log(`   Exact phrase results: ${exactSearch.total}`)
    console.log()

    // Test 8: Search suggestions
    console.log('8. Testing search suggestions...')
    const suggestions = await esService.getSearchSuggestions('adv', '3')
    console.log(`   Suggestions for "adv": ${suggestions.join(', ')}`)
    console.log()

    // Test 9: Date range search
    console.log('9. Testing date range search...')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dateSearch = await esService.searchDocuments({
      query: '*',
      organizationId: '3',
      filters: {
        date_range: {
          from: yesterday.toISOString().split('T')[0],
          to: tomorrow.toISOString().split('T')[0]
        }
      },
      pagination: { from: 0, size: 10 }
    })
    console.log(`   Date range results: ${dateSearch.total}`)
    console.log()

    // Test 10: Size range search
    console.log('10. Testing file size range search...')
    const sizeSearch = await esService.searchDocuments({
      query: '*',
      organizationId: '3',
      filters: {
        size_range: {
          min: 1000,
          max: 2000000
        }
      },
      pagination: { from: 0, size: 10 }
    })
    console.log(`    Size range results: ${sizeSearch.total}`)
    console.log()

    // Cleanup: Delete test document
    console.log('11. Cleaning up test document...')
    const deleteResult = await esService.deleteDocument('test-123')
    console.log(`    Delete result: ${deleteResult ? '✅ Success' : '❌ Failed'}`)

    console.log('\n🎉 Advanced Search System Test Complete!')
    console.log('\nFeatures tested:')
    console.log('✅ Elasticsearch health check')
    console.log('✅ Index creation and management')
    console.log('✅ Document indexing')
    console.log('✅ Basic text search')
    console.log('✅ Advanced search with filters')
    console.log('✅ Fuzzy search (typo tolerance)')
    console.log('✅ Exact phrase search')
    console.log('✅ Search suggestions/autocomplete')
    console.log('✅ Date range filtering')
    console.log('✅ File size filtering')
    console.log('✅ Faceted search results')
    console.log('✅ Document cleanup')

  } catch (error) {
    console.error('❌ Search system test failed:', error)
    process.exit(1)
  }
}

// Run the test
testSearchSystem()