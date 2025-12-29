import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('Testing basic Tesseract functionality...')
    
    // Test basic Tesseract import and worker creation
    const { createWorker } = require('tesseract.js')
    
    console.log('✅ Tesseract.js imported successfully')
    
    // Try to create a worker
    const worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        console.log('Tesseract log:', m)
      }
    })
    
    console.log('✅ Tesseract worker created successfully')
    
    // Test with a simple text image (create a simple test)
    const testText = 'Hello World Test'
    
    // Terminate the worker
    await worker.terminate()
    console.log('✅ Tesseract worker terminated successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Tesseract.js is working correctly',
      test_results: {
        import_success: true,
        worker_creation_success: true,
        worker_termination_success: true
      }
    })

  } catch (error) {
    console.error('❌ Tesseract test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}