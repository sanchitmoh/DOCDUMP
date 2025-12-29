import { NextRequest, NextResponse } from 'next/server'
import { createAIService } from '@/lib/services/ai-service'
import { verifyToken } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'

export async function GET(
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

    // Verify conversation access
    const conversations = await executeQuery(`
      SELECT * FROM chat_conversations 
      WHERE id = ? AND user_id = ? AND organization_id = ?
    `, [conversationId, userId, organizationId])

    if (conversations.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const aiService = createAIService()
    const messages = await aiService.getConversationHistory(conversationId, limit)

    return NextResponse.json({
      success: true,
      conversation: conversations[0],
      messages
    })

  } catch (error) {
    console.error('Get conversation error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation'
    }, { status: 500 })
  }
}

export async function PATCH(
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

    // Verify conversation access
    const conversations = await executeQuery(`
      SELECT * FROM chat_conversations 
      WHERE id = ? AND user_id = ? AND organization_id = ?
    `, [conversationId, userId, organizationId])

    if (conversations.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.title !== undefined) {
      updates.push('title = ?')
      values.push(body.title)
    }

    if (body.is_pinned !== undefined) {
      updates.push('is_pinned = ?')
      values.push(body.is_pinned ? 1 : 0)
    }

    if (body.is_archived !== undefined) {
      updates.push('is_archived = ?')
      values.push(body.is_archived ? 1 : 0)
      
      if (body.is_archived) {
        updates.push('archived_at = NOW()')
      } else {
        updates.push('archived_at = NULL')
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    values.push(conversationId)

    await executeSingle(`
      UPDATE chat_conversations 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values)

    return NextResponse.json({
      success: true,
      message: 'Conversation updated successfully'
    })

  } catch (error) {
    console.error('Update conversation error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update conversation'
    }, { status: 500 })
  }
}

export async function DELETE(
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

    // Verify conversation access
    const conversations = await executeQuery(`
      SELECT * FROM chat_conversations 
      WHERE id = ? AND user_id = ? AND organization_id = ?
    `, [conversationId, userId, organizationId])

    if (conversations.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Delete conversation and related data (cascade should handle this)
    await executeSingle(`
      DELETE FROM chat_conversations WHERE id = ?
    `, [conversationId])

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    })

  } catch (error) {
    console.error('Delete conversation error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete conversation'
    }, { status: 500 })
  }
}