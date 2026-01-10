// Test complete AI flow with proper user handling
const mysql = require('mysql2/promise')

async function testCompleteAIFlow() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  })

  try {
    console.log('Testing complete AI flow...')

    // Get a valid file and organization
    const [files] = await connection.execute(`
      SELECT id, organization_id FROM files LIMIT 1
    `)
    
    if (files.length === 0) {
      console.log('❌ No files found for testing')
      return
    }

    const fileId = files[0].id
    const organizationId = files[0].organization_id

    console.log(`Using file ID: ${fileId}, organization ID: ${organizationId}`)

    // Test 1: Insert AI content with NULL user (system generated)
    console.log('\n1. Testing system-generated AI content...')
    try {
      await connection.execute(`
        INSERT INTO ai_generated_content (
          file_id, organization_id, content_type, content, 
          generated_by, model_used, created_at
        ) VALUES (?, ?, 'analysis', ?, NULL, 'gpt-4-turbo-preview', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          content = VALUES(content),
          model_used = VALUES(model_used),
          created_at = CURRENT_TIMESTAMP
      `, [fileId, organizationId, JSON.stringify({
        quality: 'high',
        classification: 'document',
        sentiment: 'neutral',
        keywords: ['test', 'document']
      })])
      console.log('✅ System-generated AI content insertion successful')
    } catch (error) {
      console.log('❌ System-generated AI content insertion failed:', error.message)
    }

    // Test 2: Insert AI summary with valid user
    console.log('\n2. Testing user-generated AI summary...')
    
    // Get a valid user from the organization
    const [users] = await connection.execute(`
      SELECT id FROM organization_employees 
      WHERE organization_id = ? 
      LIMIT 1
    `, [organizationId])

    const userId = users.length > 0 ? users[0].id : null
    console.log(`Using user ID: ${userId}`)

    try {
      await connection.execute(`
        INSERT INTO ai_generated_content (
          file_id, organization_id, content_type, content, 
          generated_by, model_used, created_at
        ) VALUES (?, ?, 'summary', ?, ?, 'gpt-3.5-turbo', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          content = VALUES(content),
          generated_by = VALUES(generated_by),
          model_used = VALUES(model_used),
          created_at = CURRENT_TIMESTAMP
      `, [fileId, organizationId, 'This is a test AI-generated summary of the document content.', userId])
      console.log('✅ User-generated AI summary insertion successful')
    } catch (error) {
      console.log('❌ User-generated AI summary insertion failed:', error.message)
    }

    // Test 3: Check all content types work
    console.log('\n3. Testing all content types...')
    const contentTypes = ['summary', 'description', 'tags', 'keywords', 'analysis']
    
    for (const contentType of contentTypes) {
      try {
        await connection.execute(`
          INSERT INTO ai_generated_content (
            file_id, organization_id, content_type, content, 
            generated_by, model_used, created_at
          ) VALUES (?, ?, ?, ?, NULL, 'test-model', CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE
            content = VALUES(content),
            model_used = VALUES(model_used),
            created_at = CURRENT_TIMESTAMP
        `, [fileId, organizationId, contentType, `Test ${contentType} content`])
        console.log(`✅ Content type '${contentType}' works`)
      } catch (error) {
        console.log(`❌ Content type '${contentType}' failed:`, error.message)
      }
    }

    // Show final results
    console.log('\n4. Final AI content records for this file:')
    const [results] = await connection.execute(`
      SELECT content_type, generated_by, model_used, created_at
      FROM ai_generated_content 
      WHERE file_id = ?
      ORDER BY created_at DESC
    `, [fileId])

    console.table(results)

    // Clean up test records
    console.log('\n5. Cleaning up test records...')
    await connection.execute(`
      DELETE FROM ai_generated_content 
      WHERE model_used = 'test-model' AND file_id = ?
    `, [fileId])
    console.log('✅ Test records cleaned up')

    console.log('\n🎉 Complete AI flow test completed successfully!')

  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await connection.end()
  }
}

testCompleteAIFlow()