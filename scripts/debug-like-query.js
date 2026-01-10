// Debug LIKE query issue
const mysql = require('mysql2/promise')

async function debugLikeQuery() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  })

  try {
    console.log('🔍 Debugging LIKE query issue...\n')

    const userId = 3
    const organizationId = 3
    const query = 'srustimohite'

    // Test 1: Single LIKE condition
    console.log('1. Testing single LIKE condition...')
    try {
      const [results1] = await connection.execute(`
        SELECT f.id, f.name 
        FROM files f 
        WHERE f.organization_id = ? AND f.name LIKE ?
      `, [organizationId, `%${query}%`])
      console.log(`✅ Single LIKE works: ${results1.length} files found`)
    } catch (error) {
      console.log(`❌ Single LIKE failed: ${error.message}`)
    }

    // Test 2: Multiple LIKE conditions with OR
    console.log('\n2. Testing multiple LIKE conditions...')
    try {
      const [results2] = await connection.execute(`
        SELECT f.id, f.name 
        FROM files f 
        WHERE f.organization_id = ? 
        AND (f.name LIKE ? OR f.description LIKE ?)
      `, [organizationId, `%${query}%`, `%${query}%`])
      console.log(`✅ Multiple LIKE works: ${results2.length} files found`)
    } catch (error) {
      console.log(`❌ Multiple LIKE failed: ${error.message}`)
    }

    // Test 3: With extracted_text join and LIKE
    console.log('\n3. Testing with extracted_text join and LIKE...')
    try {
      const [results3] = await connection.execute(`
        SELECT f.id, f.name, etc.extracted_text
        FROM files f 
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        WHERE f.organization_id = ? 
        AND (f.name LIKE ? OR f.description LIKE ? OR etc.extracted_text LIKE ?)
      `, [organizationId, `%${query}%`, `%${query}%`, `%${query}%`])
      console.log(`✅ Extracted text LIKE works: ${results3.length} files found`)
    } catch (error) {
      console.log(`❌ Extracted text LIKE failed: ${error.message}`)
    }

    // Test 4: Count parameters carefully
    console.log('\n4. Testing parameter count...')
    const params = [userId, userId, organizationId, `%${query}%`, `%${query}%`, `%${query}%`, 5, 0]
    console.log('Parameters:', params)
    console.log('Parameter count:', params.length)
    
    // Count placeholders in query
    const sql = `
      SELECT f.id, f.name
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
    
    const placeholderCount = (sql.match(/\?/g) || []).length
    console.log('Placeholder count:', placeholderCount)
    
    if (params.length === placeholderCount) {
      console.log('✅ Parameter count matches placeholders')
      
      try {
        const [results4] = await connection.execute(sql, params)
        console.log(`✅ Full query works: ${results4.length} files found`)
      } catch (error) {
        console.log(`❌ Full query failed: ${error.message}`)
        
        // Try with explicit NULL handling
        console.log('\n5. Testing with explicit NULL handling...')
        const nullSafeParams = params.map(p => p === null ? null : p)
        console.log('NULL-safe parameters:', nullSafeParams)
        
        try {
          const [results5] = await connection.execute(sql, nullSafeParams)
          console.log(`✅ NULL-safe query works: ${results5.length} files found`)
        } catch (error2) {
          console.log(`❌ NULL-safe query failed: ${error2.message}`)
        }
      }
    } else {
      console.log('❌ Parameter count mismatch!')
    }

  } catch (error) {
    console.error('Connection error:', error)
  } finally {
    await connection.end()
  }
}

debugLikeQuery()