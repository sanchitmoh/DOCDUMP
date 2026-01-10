// Debug search query step by step
const mysql = require('mysql2/promise')

async function debugSearchQuery() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  })

  try {
    console.log('🔍 Debugging search query step by step...\n')

    const userId = 3
    const organizationId = 3
    const query = 'srustimohite'

    // Test 1: Simple files query
    console.log('1. Testing basic files query...')
    try {
      const [results1] = await connection.execute(`
        SELECT f.id, f.name, f.file_type 
        FROM files f 
        WHERE f.organization_id = ? AND f.is_deleted = 0 
        LIMIT 5
      `, [organizationId])
      console.log(`✅ Basic query works: ${results1.length} files found`)
    } catch (error) {
      console.log(`❌ Basic query failed: ${error.message}`)
    }

    // Test 2: With search condition
    console.log('\n2. Testing with search condition...')
    try {
      const [results2] = await connection.execute(`
        SELECT f.id, f.name, f.file_type 
        FROM files f 
        WHERE f.organization_id = ? AND f.is_deleted = 0 
        AND f.name LIKE ?
        LIMIT 5
      `, [organizationId, `%${query}%`])
      console.log(`✅ Search query works: ${results2.length} files found`)
    } catch (error) {
      console.log(`❌ Search query failed: ${error.message}`)
    }

    // Test 3: With extracted_text_content join
    console.log('\n3. Testing with extracted_text_content join...')
    try {
      const [results3] = await connection.execute(`
        SELECT f.id, f.name, f.file_type, etc.extracted_text
        FROM files f 
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        WHERE f.organization_id = ? AND f.is_deleted = 0 
        LIMIT 5
      `, [organizationId])
      console.log(`✅ Extracted text join works: ${results3.length} files found`)
    } catch (error) {
      console.log(`❌ Extracted text join failed: ${error.message}`)
    }

    // Test 4: With all joins but no permissions
    console.log('\n4. Testing with all joins (no permissions)...')
    try {
      const [results4] = await connection.execute(`
        SELECT 
          f.id, f.name, f.file_type,
          u.full_name as creator_name,
          fo.name as folder_name,
          etc.extracted_text,
          dm.page_count
        FROM files f
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        WHERE f.organization_id = ? AND f.is_deleted = 0 
        LIMIT 5
      `, [organizationId])
      console.log(`✅ All joins (no permissions) work: ${results4.length} files found`)
    } catch (error) {
      console.log(`❌ All joins (no permissions) failed: ${error.message}`)
    }

    // Test 5: With permission joins
    console.log('\n5. Testing with permission joins...')
    try {
      const [results5] = await connection.execute(`
        SELECT 
          f.id, f.name, f.file_type,
          u.full_name as creator_name,
          fo.name as folder_name,
          fp.permission as file_permission,
          fop.permission as folder_permission,
          etc.extracted_text,
          dm.page_count
        FROM files f
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
        LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        WHERE f.organization_id = ? AND f.is_deleted = 0 
        LIMIT 5
      `, [userId, userId, organizationId])
      console.log(`✅ Permission joins work: ${results5.length} files found`)
    } catch (error) {
      console.log(`❌ Permission joins failed: ${error.message}`)
    }

    // Test 6: Full query with search
    console.log('\n6. Testing full query with search...')
    try {
      const [results6] = await connection.execute(`
        SELECT 
          f.id, f.name, f.file_type,
          u.full_name as creator_name,
          fo.name as folder_name,
          fp.permission as file_permission,
          fop.permission as folder_permission,
          etc.extracted_text,
          dm.page_count
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
      `, [userId, userId, organizationId, `%${query}%`, `%${query}%`, `%${query}%`, 5, 0])
      console.log(`✅ Full query works: ${results6.length} files found`)
      
      if (results6.length > 0) {
        console.log('Sample result:', {
          id: results6[0].id,
          name: results6[0].name,
          creator: results6[0].creator_name
        })
      }
    } catch (error) {
      console.log(`❌ Full query failed: ${error.message}`)
      console.log('Error details:', error)
    }

  } catch (error) {
    console.error('Connection error:', error)
  } finally {
    await connection.end()
  }
}

debugSearchQuery()