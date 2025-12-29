const mysql = require('mysql2/promise');

async function monitorUploads() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'coprate_digital_library'
  });

  try {
    console.log('Monitoring for new file uploads and text extraction jobs...');
    console.log('Upload a new file and watch this monitor for automatic processing');
    console.log('Press Ctrl+C to stop monitoring\n');

    let lastFileId = 0;
    let lastJobId = 0;

    // Get current max IDs
    const [files] = await connection.execute('SELECT MAX(id) as max_id FROM files');
    const [jobs] = await connection.execute('SELECT MAX(id) as max_id FROM text_extraction_jobs');
    
    lastFileId = files[0].max_id || 0;
    lastJobId = jobs[0].max_id || 0;

    console.log(`Starting monitoring from File ID: ${lastFileId}, Job ID: ${lastJobId}\n`);

    // Monitor every 2 seconds
    setInterval(async () => {
      try {
        // Check for new files
        const [newFiles] = await connection.execute(`
          SELECT id, name, file_type, created_at 
          FROM files 
          WHERE id > ? 
          ORDER BY id ASC
        `, [lastFileId]);

        if (newFiles.length > 0) {
          newFiles.forEach(file => {
            console.log(`🆕 New file uploaded: ${file.name} (ID: ${file.id}, Type: ${file.file_type})`);
            lastFileId = Math.max(lastFileId, file.id);
          });
        }

        // Check for new text extraction jobs
        const [newJobs] = await connection.execute(`
          SELECT tej.id, tej.file_id, tej.status, tej.extraction_method, tej.created_at, f.name
          FROM text_extraction_jobs tej
          JOIN files f ON tej.file_id = f.id
          WHERE tej.id > ?
          ORDER BY tej.id ASC
        `, [lastJobId]);

        if (newJobs.length > 0) {
          newJobs.forEach(job => {
            console.log(`⚙️  Text extraction job created: Job ${job.id} for ${job.name} (Method: ${job.extraction_method}, Status: ${job.status})`);
            lastJobId = Math.max(lastJobId, job.id);
          });
        }

        // Check for job status updates
        const [updatedJobs] = await connection.execute(`
          SELECT tej.id, tej.file_id, tej.status, tej.extraction_method, tej.updated_at, f.name
          FROM text_extraction_jobs tej
          JOIN files f ON tej.file_id = f.id
          WHERE tej.updated_at > DATE_SUB(NOW(), INTERVAL 5 SECOND)
            AND tej.status IN ('processing', 'completed', 'failed')
          ORDER BY tej.updated_at DESC
        `);

        if (updatedJobs.length > 0) {
          updatedJobs.forEach(job => {
            const statusEmoji = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '🔄';
            console.log(`${statusEmoji} Job ${job.id} status: ${job.status} (${job.name})`);
          });
        }

      } catch (error) {
        console.error('Monitor error:', error.message);
      }
    }, 2000);

  } catch (error) {
    console.error('Error:', error);
    await connection.end();
  }
}

monitorUploads();