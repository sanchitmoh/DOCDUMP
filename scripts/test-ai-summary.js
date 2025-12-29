const mysql = require('mysql2/promise');

async function testAISummary() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  });

  try {
    // Get a file to test with
    const [files] = await connection.execute(`
      SELECT 
        f.id,
        f.name,
        f.file_type,
        f.description,
        f.ai_description,
        etc.extracted_text,
        LENGTH(etc.extracted_text) as text_length
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      WHERE f.is_deleted = 0
      ORDER BY f.id DESC
      LIMIT 5
    `);

    console.log('Available files for AI summary testing:');
    files.forEach(file => {
      console.log(`- File ID: ${file.id}, Name: ${file.name}`);
      console.log(`  Type: ${file.file_type}`);
      console.log(`  Description: ${file.description ? file.description.substring(0, 100) + '...' : 'None'}`);
      console.log(`  AI Description: ${file.ai_description ? file.ai_description.substring(0, 100) + '...' : 'None'}`);
      console.log(`  Extracted Text Length: ${file.text_length || 0} characters`);
      
      const content = file.extracted_text || file.description || file.ai_description;
      const hasEnoughContent = content && content.trim().length >= 50;
      console.log(`  Has enough content for summary: ${hasEnoughContent}`);
      console.log('---');
    });

    // Check if ai_generated_content table exists and has data
    const [summaries] = await connection.execute(`
      SELECT file_id, content_type, LENGTH(content) as content_length, created_at
      FROM ai_generated_content
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\nExisting AI generated content:');
    if (summaries.length === 0) {
      console.log('No AI generated content found');
    } else {
      summaries.forEach(summary => {
        console.log(`- File ID: ${summary.file_id}, Type: ${summary.content_type}, Length: ${summary.content_length}, Created: ${summary.created_at}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

testAISummary();