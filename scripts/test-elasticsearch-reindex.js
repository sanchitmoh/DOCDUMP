const { createElasticsearchService } = require('../lib/search/elasticsearch.ts')
const { executeQuery } = require('../lib/database.ts')

async function testReindexing() {
  try {
    console.log('Testing Elasticsearch reindexing...')
    
    const searchService = createElasticsearchService()
    
    // Test health first
    const health = await searchService.healthCheck()
    console.log('Elasticsearch health:', health)
    
    if (health.status !== 'healthy') {
      console.error('Elasticsearch is not healthy, aborting test')
      return
    }
    
    // Get file 11 data
    const files = await executeQuery(`
      SELECT 
        f.*,
        fo.name as folder_name,
        u.full_name as author_name,
        etc.extracted_text,
        dm.title as doc_title,
        dm.author as doc_author,
        dm.subject as doc_subject,
        dm.keywords as doc_keywords
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN organization_employees u ON f.created_by = u.id
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      LEFT JOIN document_metadata dm ON f.id = dm.file_id
      WHERE f.id = 11 AND f.is_deleted = 0
    `)
    
    if (files.length === 0) {
      console.error('File 11 not found')
      return
    }
    
    const file = files[0]
    console.log('File data:', {
      id: file.id,
      name: file.name,
      organization_id: file.organization_id,
      extracted_text_length: file.extracted_text ? file.extracted_text.length : 0,
      folder_name: file.folder_name
    })
    
    // Create document for indexing
    const document = {
      file_id: file.id.toString(),
      organization_id: file.organization_id.toString(),
      title: file.doc_title || file.name,
      content: file.extracted_text || '',
      author: file.doc_author || file.author_name || '',
      department: file.department || '',
      tags: file.tags ? JSON.parse(file.tags) : [],
      file_type: file.file_type || 'other',
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      created_at: new Date(file.created_at),
      updated_at: new Date(file.updated_at),
      visibility: file.visibility || 'org',
      folder_path: file.folder_name,
      extracted_text: file.extracted_text || ''
    }
    
    console.log('Document to index:', {
      file_id: document.file_id,
      organization_id: document.organization_id,
      title: document.title,
      content_length: document.content.length,
      author: document.author,
      file_type: document.file_type
    })
    
    // Try to index the document
    console.log('Attempting to index document...')
    const result = await searchService.indexDocument(document)
    console.log('Indexing result:', result)
    
    if (result) {
      console.log('✅ Document indexed successfully!')
      
      // Update database status
      await executeQuery(`
        INSERT INTO search_index_status (file_id, organization_id, index_status, indexed_at)
        VALUES (?, ?, 'indexed', NOW())
        ON DUPLICATE KEY UPDATE
          index_status = 'indexed',
          indexed_at = NOW(),
          error_message = NULL
      `, [file.id, file.organization_id])
      
      console.log('✅ Database status updated')
    } else {
      console.log('❌ Document indexing failed')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testReindexing()