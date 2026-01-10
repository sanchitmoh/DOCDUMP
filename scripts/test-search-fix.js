// Test the search fix
const mysql = require('mysql2/promise')

async function testSearchFix() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  })

  try {
    console.log('🔍 Testing search fix...\n')

    const userId = 3
    const organizationId = 3
    const query = 'srustimohite'
    
    // Test the exact query that was failing
    const queryParams = [
      userId, // for fp.employee_id
      userId, // for fop.employee_id  
      organizationId, // for f.organization_id
      `%${query}%`, // for f.name LIKE
      `%${query}%`, // for f.description LIKE
      `%${query}%`, // for etc.extracted_text LIKE
      50, // LIMIT
      0   // OFFSET
    ]

    console.log('Testing with query() method...')
    const [results] = await connection.query(`
      SELECT 
        f.*,
        u.full_name as creator_name,
        fo.name as folder_name,
        fp.permission as file_permission,
        fop.permission as folder_permission,
        etc.extracted_text,
        dm.page_count,
        dm.word_count
      FROM files f
      LEFT JOIN organization_employees u ON f.created_by = u.id
      LEFT JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
      LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      LEFT JOIN document_metadata dm ON f.id = dm.file_id
      WHERE f.organization_id = ? AND f.is_deleted = 0 
      AND (f.name LIKE ? OR f.description LIKE ? OR etc.extracted_text LIKE ?)
      ORDER BY f.name ASC
      LIMIT ? OFFSET ?
    `, queryParams)

    console.log(`✅ Search query works with query() method!`)
    console.log(`Found ${results.length} results`)
    
    if (results.length > 0) {
      console.log('Sample results:')
      results.slice(0, 3).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name} (${file.file_type})`)
      })
    }

    // Test count query
    console.log('\nTesting count query...')
    const countParams = [organizationId, `%${query}%`, `%${query}%`, `%${query}%`]
    
    const [countResults] = await connection.query(`
      SELECT COUNT(DISTINCT f.id) as total
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      WHERE f.organization_id = ? AND f.is_deleted = 0 
      AND (f.name LIKE ? OR f.description LIKE ? OR etc.extracted_text LIKE ?)
    `, countParams)

    console.log(`✅ Count query works!`)
    console.log(`Total matching files: ${countResults[0].total}`)

    // Test with a more common search term
    console.log('\nTesting with common search term "doc"...')
    const commonQuery = 'doc'
    const commonParams = [
      userId, userId, organizationId, 
      `%${commonQuery}%`, `%${commonQuery}%`, `%${commonQuery}%`, 
      10, 0
    ]

    const [commonResults] = await connection.query(`
      SELECT f.id, f.name, f.file_type
      FROM files f
      LEFT JOIN organization_employees u ON f.created_by = u.id
      LEFT JOIN folders fo ON f.folder_id = fo.id
      LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
      LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      LEFT JOIN document_metadata dm ON f.id = dm.file_id
      WHERE f.organization_id = ? AND f.is_deleted = 0 
      AND (f.name LIKE ? OR f.description LIKE ? OR etc.extracted_text LIKE ?)
      ORDER BY f.name ASC
      LIMIT ? OFFSET ?
    `, commonParams)

    console.log(`✅ Common search works!`)
    console.log(`Found ${commonResults.length} results for "${commonQuery}"`)
    
    if (commonResults.length > 0) {
      console.log('Sample results:')
      commonResults.slice(0, 5).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name} (${file.file_type})`)
      })
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await connection.end()
  }
}

testSearchFix()