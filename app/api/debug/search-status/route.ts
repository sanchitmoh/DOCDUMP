import { NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database'

export async function GET() {
  try {
    // Get detailed search index status
    const statusDetails = await executeQuery(`
      SELECT 
        sis.*,
        f.name as file_name,
        f.file_type,
        LENGTH(etc.extracted_text) as text_length
      FROM search_index_status sis
      JOIN files f ON sis.file_id = f.id
      LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
      ORDER BY sis.updated_at DESC
      LIMIT 20
    `)

    return NextResponse.json({
      success: true,
      search_index_status: statusDetails
    })

  } catch (error) {
    console.error('Debug search status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}