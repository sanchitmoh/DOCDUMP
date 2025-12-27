import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, updateTokenVersion } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value

    if (token) {
      // Verify and invalidate token
      const payload = verifyToken(token)
      if (payload) {
        // Update token version to invalidate all existing tokens
        await updateTokenVersion(payload.type, payload.id)
      }
    }

    // Clear authentication cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    // Still clear the cookie even if there's an error
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  }
}