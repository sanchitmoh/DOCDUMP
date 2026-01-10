import mysql from 'mysql2/promise'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'coprate_digital_library',
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
    console.error('Query:', query)
    console.error('Params:', params)
    
    // Provide more specific error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    throw error // Re-throw the original error instead of a generic one
  }
}

// Execute complex query using query() method (for queries that have issues with execute())
export async function executeComplexQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const pool = getPool()
    const [rows] = await pool.query(query, params)
    return rows as T[]
  } catch (error) {
    console.error('Database complex query error:', error)
    console.error('Query:', query)
    console.error('Params:', params)
    
    // Provide more specific error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    throw error // Re-throw the original error instead of a generic one
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
    console.error('Query:', query)
    console.error('Params:', params)
    
    // Provide more specific error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    throw error // Re-throw the original error instead of a generic one
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool()
    await pool.execute('SELECT 1')
    console.log('Database connection successful')
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

// Initialize database (create database if it doesn't exist)
export async function initializeDatabase(): Promise<boolean> {
  try {
    // First try to connect without specifying a database
    const initConfig = {
      ...dbConfig,
      database: undefined, // Don't specify database initially
    }
    
    const initPool = mysql.createPool(initConfig)
    
    // Create database if it doesn't exist
    await initPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``)
    console.log(`Database '${dbConfig.database}' created or already exists`)
    
    await initPool.end()
    
    // Now test the connection with the database
    return await testConnection()
  } catch (error) {
    console.error('Database initialization failed:', error)
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