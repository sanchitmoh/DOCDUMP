// Test script to verify AI content fixes
const mysql = require('mysql2/promise')

async function testAIContentFix() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  })

  try {
    console.log('Testing AI content fixes...')

    // Test 1: Insert with 'analysis' content type
    console.log('\n1. Testing analysis content type insertion...')
    try {
      await connection.execute(`
        INSERT INTO ai_generated_content (
          file_id, organization_id, content_type, content, 
          generated_by, model_used, created_at
        ) VALUES (?, ?, 'analysis', ?, ?, 'test-model', CURRENT_TIMESTAMP)
      `, [1, 3, 'Test analysis content', null])
      console.log('✅ Analysis content type insertion successful')
    } catch (error) {
      console.log('❌ Analysis content type insertion failed:', error.message)
    }

    // Test 2: Insert with valid user ID
    console.log('\n2. Testing valid user ID insertion...')
    try {
      await connection.execute(`
        INSERT INTO ai_generated_content (
          file_id, organization_id, content_type, content, 
          generated_by, model_used, created_at
        ) VALUES (?, ?, 'summary', ?, ?, 'test-model', CURRENT_TIMESTAMP)
      `, [2, 3, 'Test summary content', 1])
      console.log('✅ Valid user ID insertion successful')
    } catch (error) {
      console.log('❌ Valid user ID insertion failed:', error.message)
    }

    // Test 3: Insert with NULL user ID (should work)
    console.log('\n3. Testing NULL user ID insertion...')
    try {
      await connection.execute(`
        INSERT INTO ai_generated_content (
          file_id, organization_id, content_type, content, 
          generated_by, model_used, created_at
        ) VALUES (?, ?, 'keywords', ?, ?, 'test-model', CURRENT_TIMESTAMP)
      `, [3, 3, 'Test keywords content', null])
      console.log('✅ NULL user ID insertion successful')
    } catch (error) {
      console.log('❌ NULL user ID insertion failed:', error.message)
    }

    // Test 4: Try invalid user ID (should fail)
    console.log('\n4. Testing invalid user ID insertion (should fail)...')
    try {
      await connection.execute(`
        INSERT INTO ai_generated_content (
          file_id, organization_id, content_type, content, 
          generated_by, model_used, created_at
        ) VALUES (?, ?, 'tags', ?, ?, 'test-model', CURRENT_TIMESTAMP)
      `, [4, 3, 'Test tags content', 999])
      console.log('❌ Invalid user ID insertion should have failed but succeeded')
    } catch (error) {
      console.log('✅ Invalid user ID insertion correctly failed:', error.message)
    }

    // Clean up test records
    console.log('\n5. Cleaning up test records...')
    await connection.execute(`
      DELETE FROM ai_generated_content 
      WHERE model_used = 'test-model'
    `)
    console.log('✅ Test records cleaned up')

    console.log('\n🎉 All tests completed!')

  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await connection.end()
  }
}

testAIContentFix()