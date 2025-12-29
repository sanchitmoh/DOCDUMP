const mysql = require('mysql2/promise');

async function testPDFExtraction() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  });

  try {
    // Reset a failed PDF job to pending so it can be retried
    const [result] = await connection.execute(`
      UPDATE text_extraction_jobs 
      SET status = 'pending', retry_count = 0, error_message = NULL, error_code = NULL
      WHERE status = 'failed' AND extraction_method = 'pdfplumber'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (result.affectedRows > 0) {
      console.log('Reset 1 failed PDF job to pending status');
      console.log('The background processor should pick it up within 5 seconds');
      
      // Wait a bit and check the status
      setTimeout(async () => {
        try {
          const [jobs] = await connection.execute(`
            SELECT id, file_id, status, error_message, completed_at
            FROM text_extraction_jobs 
            WHERE extraction_method = 'pdfplumber'
            ORDER BY updated_at DESC 
            LIMIT 1
          `);
          
          if (jobs.length > 0) {
            const job = jobs[0];
            console.log(`\nJob status update:`);
            console.log(`- Job ID: ${job.id}, File ID: ${job.file_id}`);
            console.log(`- Status: ${job.status}`);
            if (job.error_message) {
              console.log(`- Error: ${job.error_message}`);
            }
            if (job.completed_at) {
              console.log(`- Completed: ${job.completed_at}`);
            }
          }
          
          await connection.end();
        } catch (error) {
          console.error('Error checking status:', error);
          await connection.end();
        }
      }, 10000); // Wait 10 seconds
      
    } else {
      console.log('No failed PDF jobs found to retry');
      await connection.end();
    }

  } catch (error) {
    console.error('Error:', error);
    await connection.end();
  }
}

testPDFExtraction();