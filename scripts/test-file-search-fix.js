// Test script to verify file search fix
const mysql = require('mysql2/promise')

async function testFileSearch() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  })

  try {
    console.log('Testing file search query...')

    // Test the exact query structure from the searchFiles method
    const userId = 3
    const organizationId = 3
    const query = 'srustimohite'
    
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

    console.log('Query parameters:', queryParams)

    const sql = `
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
    `

    console.log('Executing query...')
    const [results] = await connection.execute(sql, queryParams)
    
    console.log(`✅ Query executed successfully!`)
    console.log(`Found ${results.length} results`)
    
    if (results.length > 0) {
      console.log('First result:', {
        id: results[0].id,
        name: results[0].name,
        file_type: results[0].file_type
      })
    }

    // Test count query
    console.log('\nTesting count query...')
    const countParams = [organizationId, `%${query}%`, `%${query}%`, `%${query}%`]
    
    const countSql = `
      SELECT COUNT(DISTINCT f.id) as total
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      WHERE f.organization_id = ? AND f.is_deleted = 0 
      AND (f.name LIKE ? OR f.description LIKE ? OR etc.extracted_text LIKE ?)
    `

    const [countResults] = await connection.execute(countSql, countParams)
    console.log(`✅ Count query executed successfully!`)
    console.log(`Total results: ${countResults[0].total}`)

  } catch (error) {
    console.error('❌ Query failed:', error.message)
    console.error('Error code:', error.code)
  } finally {
    await connection.end()
  }
}

testFileSearch()