const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    // Read database configuration from .env.local
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const getEnvValue = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
      return match ? match[1].trim() : null;
    };

    const connection = await mysql.createConnection({
      host: getEnvValue('DB_HOST') || 'localhost',
      user: getEnvValue('DB_USER') || 'root',
      password: getEnvValue('DB_PASSWORD') || '',
      database: getEnvValue('DB_NAME') || 'corporate_digital_library'
    });

    console.log('Connected to database');

    // Read and execute the migration SQL
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'add-missing-columns.sql'), 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log('Executed:', statement.substring(0, 50) + '...');
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('Skipped (already exists):', statement.substring(0, 50) + '...');
          } else {
            console.error('Error executing statement:', error.message);
          }
        }
      }
    }

    await connection.end();
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();