// Debug MySQL parameter issue
const mysql = require('mysql2/promise')

async function debugMySQLIssue() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  })

  try {
    console.log('🔍 Debugging MySQL parameter issue...\n')

    // Test with simple query first
    console.log('1. Testing simple parameterized query...')
    try {
      const [results] = await connection.execute(
        'SELECT COUNT(*) as count FROM files WHERE organization_id = ?',
        [3]
      )
      console.log(`✅ Simple query works: ${results[0].count} files`)
    } catch (error) {
      console.log(`❌ Simple query failed: ${error.message}`)
    }

    // Test building query step by step
    console.log('\n2. Building query step by step...')
    
    let sql = 'SELECT f.id, f.name FROM files f'
    let params = []
    
    console.log('Base query:', sql)
    
    // Add first join
    sql += ' LEFT JOIN organization_employees u ON f.created_by = u.id'
    console.log('After first join:', sql)
    
    // Add permission join with parameter
    sql += ' LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?'
    params.push(3)
    console.log('After permission join:', sql)
    console.log('Params so far:', params)
    
    try {
      const [results1] = await connection.execute(sql + ' WHERE f.organization_id = ? LIMIT 5', [...params, 3])
      console.log(`✅ Query with 1 permission join works: ${results1.length} files`)
    } catch (error) {
      console.log(`❌ Query with 1 permission join failed: ${error.message}`)
    }
    
    // Add second permission join
    sql += ' LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?'
    params.push(3)
    
    // But we need folders join first!
    sql = 'SELECT f.id, f.name FROM files f'
    sql += ' LEFT JOIN organization_employees u ON f.created_by = u.id'
    sql += ' LEFT JOIN folders fo ON f.folder_id = fo.id'
    sql += ' LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?'
    sql += ' LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?'
    
    console.log('\nCorrected query with folders:', sql)
    console.log('Params:', params)
    
    try {
      const [results2] = await connection.execute(sql + ' WHERE f.organization_id = ? LIMIT 5', [...params, 3])
      console.log(`✅ Query with 2 permission joins works: ${results2.length} files`)
    } catch (error) {
      console.log(`❌ Query with 2 permission joins failed: ${error.message}`)
    }

    // Test the exact problematic query with different parameter approach
    console.log('\n3. Testing exact problematic query...')
    
    const problematicSQL = `
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
    
    // Try with different parameter types
    const testParams = [
      3,                    // fp.employee_id
      3,                    // fop.employee_id  
      3,                    // f.organization_id
      '%srustimohite%',     // f.name LIKE
      '%srustimohite%',     // f.description LIKE
      '%srustimohite%',     // etc.extracted_text LIKE
      5,                    // LIMIT
      0                     // OFFSET
    ]
    
    console.log('Test parameters:', testParams)
    console.log('Parameter types:', testParams.map(p => typeof p))
    
    try {
      const [results3] = await connection.execute(problematicSQL, testParams)
      console.log(`✅ Problematic query works: ${results3.length} files`)
    } catch (error) {
      console.log(`❌ Problematic query failed: ${error.message}`)
      
      // Try with query() instead of execute()
      console.log('\n4. Trying with query() instead of execute()...')
      try {
        const [results4] = await connection.query(problematicSQL, testParams)
        console.log(`✅ Query() method works: ${results4.length} files`)
      } catch (error2) {
        console.log(`❌ Query() method failed: ${error2.message}`)
      }
    }

  } catch (error) {
    console.error('Connection error:', error)
  } finally {
    await connection.end()
  }
}

debugMySQLIssue()