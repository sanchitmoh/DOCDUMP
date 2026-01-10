// Test script to verify database schema fix
const mysql = require('mysql2/promise');

async function testDatabaseFix() {
  console.log('🧪 Testing Database Schema Fix...\n');
  
  try {
    // Create connection (adjust credentials as needed)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Coprate_Digital_library'
    });
    
    console.log('✅ Database connection established');
    
    // Test 1: Check if files table exists and has correct columns
    console.log('\n1. Testing files table structure...');
    const [filesColumns] = await connection.execute(
      'DESCRIBE files'
    );
    
    const fileColumnNames = filesColumns.map(col => col.Field);
    console.log('✅ Files table columns:', fileColumnNames.slice(0, 10).join(', '), '...');
    
    // Test 2: Check if extracted_text_content table exists
    console.log('\n2. Testing extracted_text_content table...');
    const [extractedColumns] = await connection.execute(
      'DESCRIBE extracted_text_content'
    );
    
    const extractedColumnNames = extractedColumns.map(col => col.Field);
    console.log('✅ Extracted text table columns:', extractedColumnNames.join(', '));
    
    // Test 3: Test the corrected query
    console.log('\n3. Testing corrected file query...');
    const [fileResults] = await connection.execute(
      'SELECT name, storage_key, local_path, mime_type FROM files WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [14]
    );
    
    if (fileResults.length > 0) {
      console.log('✅ File query successful');
      console.log('   File name:', fileResults[0].name);
      console.log('   MIME type:', fileResults[0].mime_type);
    } else {
      console.log('⚠️  No file found with ID 14');
    }
    
    // Test 4: Test extracted text query
    console.log('\n4. Testing extracted text query...');
    const [extractedResults] = await connection.execute(
      'SELECT extracted_text FROM extracted_text_content WHERE file_id = ? LIMIT 1',
      [14]
    );
    
    if (extractedResults.length > 0) {
      console.log('✅ Extracted text query successful');
      console.log('   Text length:', extractedResults[0].extracted_text?.length || 0, 'characters');
    } else {
      console.log('⚠️  No extracted text found for file ID 14');
    }
    
    // Test 5: Count total files and extracted text records
    console.log('\n5. Database statistics...');
    const [fileCount] = await connection.execute('SELECT COUNT(*) as count FROM files WHERE is_deleted = 0');
    const [extractedCount] = await connection.execute('SELECT COUNT(*) as count FROM extracted_text_content');
    
    console.log('✅ Total active files:', fileCount[0].count);
    console.log('✅ Total extracted text records:', extractedCount[0].count);
    
    await connection.end();
    console.log('\n🎉 Database schema test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error.message);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('💡 Table does not exist. Check database setup.');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.log('💡 Column does not exist. Check database schema.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Cannot connect to database. Check connection settings.');
    }
  }
}

// Run the test
testDatabaseFix();