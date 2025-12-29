const mysql = require('mysql2/promise');

async function checkContent() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: 'admin',
    database: 'coprate_digital_library'
  });

  try {
    // Check if any files have longer descriptions
    const [files] = await connection.execute(`
      SELECT 
        f.id,
        f.name,
        f.description,
        LENGTH(f.description) as desc_length,
        f.ai_description,
        LENGTH(f.ai_description) as ai_desc_length
      FROM files f
      WHERE f.is_deleted = 0 
        AND (LENGTH(f.description) > 50 OR LENGTH(f.ai_description) > 50)
      LIMIT 5
    `);

    console.log('Files with sufficient description content:');
    if (files.length === 0) {
      console.log('No files found with descriptions longer than 50 characters');
      
      // Let's create a test file with a longer description
      console.log('\nLet\'s update a file with a longer description for testing...');
      
      const testDescription = `This is a comprehensive test document that contains detailed information about various business processes, procedures, and guidelines. The document covers multiple aspects of organizational operations including workflow management, quality assurance protocols, and performance metrics. It serves as a valuable resource for employees and stakeholders to understand the company's operational framework and strategic objectives.`;
      
      await connection.execute(`
        UPDATE files 
        SET description = ? 
        WHERE id = (SELECT id FROM (SELECT id FROM files WHERE is_deleted = 0 ORDER BY id DESC LIMIT 1) as temp)
      `, [testDescription]);
      
      console.log('Updated the most recent file with a longer description for AI summary testing.');
      
    } else {
      files.forEach(file => {
        console.log(`- File ID: ${file.id}, Name: ${file.name}`);
        console.log(`  Description (${file.desc_length} chars): ${file.description}`);
        if (file.ai_description) {
          console.log(`  AI Description (${file.ai_desc_length} chars): ${file.ai_description}`);
        }
        console.log('---');
      });
    }

    // Check text extraction status
    const [textJobs] = await connection.execute(`
      SELECT 
        tej.file_id,
        tej.status,
        tej.created_at,
        f.name
      FROM text_extraction_jobs tej
      JOIN files f ON tej.file_id = f.id
      ORDER BY tej.created_at DESC
      LIMIT 5
    `);

    console.log('\nText extraction jobs:');
    if (textJobs.length === 0) {
      console.log('No text extraction jobs found');
    } else {
      textJobs.forEach(job => {
        console.log(`- File: ${job.name} (ID: ${job.file_id}), Status: ${job.status}, Created: ${job.created_at}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkContent();