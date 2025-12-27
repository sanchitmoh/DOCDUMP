import mysql from 'mysql2/promise'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Coprate_Digital_library',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

// Create connection pool
let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig)
  }
  return pool
}

// Execute query with connection pool
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(query, params)
    return rows as T[]
  } catch (error) {
    console.error('Database query error:', error)
    throw new Error('Database operation failed')
  }
}

// Execute single query (for INSERT, UPDATE, DELETE)
export async function executeSingle(
  query: string,
  params: any[] = []
): Promise<mysql.ResultSetHeader> {
  try {
    const pool = getPool()
    const [result] = await pool.execute(query, params)
    return result as mysql.ResultSetHeader
  } catch (error) {
    console.error('Database query error:', error)
    throw new Error('Database operation failed')
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool()
    await pool.execute('SELECT 1')
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

// Close all connections
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}