import { NextRequest, NextResponse } from 'next/server'
import { createAIService } from '@/lib/services/ai-service'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const archived = searchParams.get('archived') === 'true'
    const pinned = searchParams.get('pinned') === 'true'

    const aiService = createAIService()
    const conversations = await aiService.getUserConversations(userId, organizationId, {
      limit,
      offset,
      archived: searchParams.has('archived') ? archived : undefined,
      pinned: searchParams.has('pinned') ? pinned : undefined
    })

    return NextResponse.json({
      success: true,
      conversations
    })

  } catch (error) {
    console.error('Get conversations error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversations'
    }, { status: 500 })
  }
}

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
    const { title } = body

    const aiService = createAIService()
    const conversationId = await aiService.createConversation(userId, organizationId, title)

    return NextResponse.json({
      success: true,
      conversationId
    })

  } catch (error) {
    console.error('Create conversation error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create conversation'
    }, { status: 500 })
  }
}