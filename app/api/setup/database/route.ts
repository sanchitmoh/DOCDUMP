import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase, testConnection } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...')
    
    // Test if database connection works
    const isConnected = await testConnection()
    
    if (isConnected) {
      return NextResponse.json({
        success: true,
        message: 'Database connection successful',
        status: 'connected'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Database connection failed',
        status: 'disconnected'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Database setup error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Database setup failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Initializing database...')
    
    // Initialize database (create if doesn't exist)
    const isInitialized = await initializeDatabase()
    
    if (isInitialized) {
      return NextResponse.json({
        success: true,
        message: 'Database initialized successfully',
        status: 'initialized'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Database initialization failed',
        status: 'failed'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Database initialization error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Database initialization failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }, { status: 500 })
  }
}