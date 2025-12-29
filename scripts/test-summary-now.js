const mysql = require('mysql2/promise');

async function testAISummaryNow() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  });

  try {
    // Get the file we just updated
    const [files] = await connection.execute(`
      SELECT 
        f.id,
        f.name,
        f.description,
        LENGTH(f.description) as desc_length
      FROM files f
      WHERE f.is_deleted = 0 AND LENGTH(f.description) > 50
      ORDER BY f.id DESC
      LIMIT 1
    `);

    if (files.length > 0) {
      const file = files[0];
      console.log(`Found file with sufficient content:`);
      console.log(`- File ID: ${file.id}, Name: ${file.name}`);
      console.log(`- Description length: ${file.desc_length} characters`);
      console.log(`- Description: ${file.description.substring(0, 100)}...`);
      console.log(`\nThis file should now work for AI summary generation!`);
      console.log(`Try clicking the AI Summary button for file ID ${file.id}`);
    } else {
      console.log('No files found with sufficient content');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

testAISummaryNow();