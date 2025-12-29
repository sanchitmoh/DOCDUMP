const mysql = require('mysql2/promise');

async function checkJobStatus() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  });

  try {
    const [jobs] = await connection.execute(`
      SELECT 
        tej.id,
        tej.file_id,
        tej.status,
        tej.extraction_method,
        tej.retry_count,
        tej.error_message,
        tej.error_code,
        tej.created_at,
        tej.started_at,
        tej.completed_at,
        f.name as file_name,
        f.mime_type
      FROM text_extraction_jobs tej
      JOIN files f ON tej.file_id = f.id
      ORDER BY tej.created_at DESC
      LIMIT 10
    `);

    console.log('Recent text extraction jobs:');
    jobs.forEach(job => {
      console.log(`- Job ID: ${job.id}, File: ${job.file_name} (ID: ${job.file_id})`);
      console.log(`  Status: ${job.status}, Method: ${job.extraction_method}`);
      console.log(`  MIME Type: ${job.mime_type}`);
      console.log(`  Retry Count: ${job.retry_count}`);
      if (job.error_message) {
        console.log(`  Error: ${job.error_message}`);
      }
      console.log(`  Created: ${job.created_at}`);
      if (job.started_at) console.log(`  Started: ${job.started_at}`);
      if (job.completed_at) console.log(`  Completed: ${job.completed_at}`);
      console.log('---');
    });

    // Check if any text has been extracted
    const [extractedText] = await connection.execute(`
      SELECT 
        etc.file_id,
        etc.content_type,
        LENGTH(etc.extracted_text) as text_length,
        etc.word_count,
        etc.created_at,
        f.name as file_name
      FROM extracted_text_content etc
      JOIN files f ON etc.file_id = f.id
      ORDER BY etc.created_at DESC
      LIMIT 5
    `);

    console.log('\nExtracted text content:');
    if (extractedText.length === 0) {
      console.log('No extracted text found');
    } else {
      extractedText.forEach(text => {
        console.log(`- File: ${text.file_name} (ID: ${text.file_id})`);
        console.log(`  Type: ${text.content_type}, Length: ${text.text_length} chars`);
        console.log(`  Word Count: ${text.word_count}, Created: ${text.created_at}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkJobStatus();