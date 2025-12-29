const mysql = require('mysql2/promise');

async function testFilesWithText() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  });

  try {
    // Get files with extracted text content
    const [files] = await connection.execute(`
      SELECT 
        f.id,
        f.name,
        f.description,
        LENGTH(f.description) as desc_length,
        etc.extracted_text,
        LENGTH(etc.extracted_text) as text_length,
        etc.word_count
      FROM files f
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      WHERE f.is_deleted = 0 
        AND (LENGTH(f.description) > 50 OR LENGTH(etc.extracted_text) > 50)
      ORDER BY f.id DESC
      LIMIT 5
    `);

    console.log('Files with sufficient content for AI summary:');
    files.forEach(file => {
      console.log(`- File ID: ${file.id}, Name: ${file.name}`);
      
      if (file.desc_length > 50) {
        console.log(`  Description: ${file.desc_length} characters`);
      }
      
      if (file.text_length > 50) {
        console.log(`  Extracted Text: ${file.text_length} characters, ${file.word_count} words`);
      }
      
      const totalContent = (file.description || '').length + (file.extracted_text || '').length;
      console.log(`  Total Content: ${totalContent} characters`);
      console.log(`  ✅ Ready for AI Summary!`);
      console.log('---');
    });

    console.log(`\nYou can now test AI summary generation on any of these files!`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

testFilesWithText();