import { NextRequest, NextResponse } from 'next/server'
import { createAIService } from '@/lib/services/ai-service'
import { createTextExtractionService } from '@/lib/services/text-extraction'
import { verifyToken } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { userId, organizationId } = decoded
    const body = await request.json()
    const { 
      type, 
      content, 
      fileId, 
      context = {}, 
      options = {} 
    } = body

    if (!type) {
      return NextResponse.json({ error: 'Generation type is required' }, { status: 400 })
    }

    if (!content && !fileId) {
      return NextResponse.json({ 
        error: 'Either content or fileId is required' 
      }, { status: 400 })
    }

    const aiService = createAIService()
    let generationContent = content

    // If fileId is provided, get file content
    if (fileId) {
      // Verify file access
      const files = await executeQuery(`
        SELECT f.*, etc.extracted_text
        FROM files f
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        WHERE f.id = ? AND f.organization_id = ?
      `, [fileId, organizationId])

      if (files.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      const file = files[0]
      
      // Check file access permissions
      // TODO: Add proper permission checking here
      
      // Use extracted text if available, otherwise use file name and description
      generationContent = file.extracted_text || 
                         `File: ${file.name}\nDescription: ${file.description || 'No description'}`
      
      // Add file context
      context.fileName = file.name
      context.fileType = file.file_type
      context.department = file.department
    }

    // Get organization context
    const organizations = await executeQuery(`
      SELECT name FROM organizations WHERE id = ?
    `, [organizationId])
    
    if (organizations.length > 0) {
      context.organization = organizations[0].name
    }

    // Get existing tags for tag generation
    if (type === 'tags') {
      const existingTags = await executeQuery(`
        SELECT DISTINCT tag FROM file_tags ft
        JOIN files f ON ft.file_id = f.id
        WHERE f.organization_id = ?
        ORDER BY tag
      `, [organizationId])
      
      context.existingTags = existingTags.map(row => row.tag)
    }

    // Generate AI content
    const result = await aiService.generateContent({
      type,
      content: generationContent,
      context,
      options
    })

    // If this was for a specific file, update the file with AI-generated content
    if (fileId && (type === 'description' || type === 'tags')) {
      try {
        if (type === 'description') {
          await executeSingle(`
            UPDATE files SET ai_description = ? WHERE id = ?
          `, [result.result, fileId])
        } else if (type === 'tags' && Array.isArray(result.result)) {
          // Update file tags
          await executeSingle(`
            UPDATE files SET tags = ? WHERE id = ?
          `, [JSON.stringify(result.result), fileId])

          // Update normalized tags table
          await executeSingle(`
            DELETE FROM file_tags WHERE file_id = ?
          `, [fileId])

          if (result.result.length > 0) {
            const tagValues = result.result.map((tag: string) => [fileId, tag])
            const placeholders = tagValues.map(() => '(?, ?)').join(', ')
            const flatValues = tagValues.flat()

            await executeSingle(`
              INSERT INTO file_tags (file_id, tag) VALUES ${placeholders}
            `, flatValues)
          }
        }
      } catch (error) {
        console.warn('Failed to update file with AI content:', error)
      }
    }

    // Log AI usage for analytics
    await executeSingle(`
      INSERT INTO file_audit_logs (
        organization_id, file_id, employee_id, action, detail
      ) VALUES (?, ?, ?, 'ai_generation', ?)
    `, [
      organizationId,
      fileId || null,
      userId,
      JSON.stringify({
        type,
        tokens_used: result.tokens_used,
        cost_cents: result.cost_cents,
        model_used: result.model_used,
        cached: result.cached
      })
    ])

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('AI generation error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed'
    }, { status: 500 })
  }
}