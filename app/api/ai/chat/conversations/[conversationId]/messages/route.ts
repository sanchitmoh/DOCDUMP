import { NextRequest, NextResponse } from 'next/server'
import { createAIService } from '@/lib/services/ai-service'
import { verifyToken } from '@/lib/auth'
import { executeQuery } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
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
    const conversationId = parseInt(params.conversationId)
    const body = await request.json()
    const { message, attachedFileIds = [] } = body

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Verify conversation access
    const conversations = await executeQuery(`
      SELECT * FROM chat_conversations 
      WHERE id = ? AND user_id = ? AND organization_id = ?
    `, [conversationId, userId, organizationId])

    if (conversations.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const aiService = createAIService()

    // Send user message
    const userMessage = await aiService.sendMessage(
      conversationId,
      message.trim(),
      'user',
      attachedFileIds
    )

    // Prepare context for AI response
    const context: any = {}

    // Get organization info
    const organizations = await executeQuery(`
      SELECT name, description FROM organizations WHERE id = ?
    `, [organizationId])
    
    if (organizations.length > 0) {
      context.organizationInfo = organizations[0]
    }

    // Get conversation history (last 10 messages for context)
    context.conversationHistory = await aiService.getConversationHistory(conversationId, 10)

    // Get attached file contents if any
    if (attachedFileIds.length > 0) {
      const files = await executeQuery(`
        SELECT f.name, f.description, etc.extracted_text
        FROM files f
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        WHERE f.id IN (${attachedFileIds.map(() => '?').join(',')}) AND f.organization_id = ?
      `, [...attachedFileIds, organizationId])

      context.fileContents = files.map(file => 
        `File: ${file.name}\n${file.description ? `Description: ${file.description}\n` : ''}${file.extracted_text || 'No text content available'}`
      )
    }

    // Generate AI response
    const aiMessage = await aiService.generateChatResponse(
      conversationId,
      message.trim(),
      context
    )

    return NextResponse.json({
      success: true,
      userMessage,
      aiMessage
    })

  } catch (error) {
    console.error('Send message error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    }, { status: 500 })
  }
}