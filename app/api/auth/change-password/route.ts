import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, verifyPassword, hashPassword, updateTokenVersion } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'
import { z } from 'zod'

// Validation schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = changePasswordSchema.parse(body)
    const { currentPassword, newPassword } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`change_password_${clientIdentifier}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many password change attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify token
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get user's current password hash
    const table = payload.type === 'organization' ? 'organizations' : 'organization_employees'
    const getUserQuery = `SELECT password_hash FROM ${table} WHERE id = ? AND status = 1`
    
    const userResults = await executeQuery<{ password_hash: string }>(getUserQuery, [payload.id])
    
    if (userResults.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = userResults[0]

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Check if new password is the same as current password
    const isSamePassword = await verifyPassword(newPassword, user.password_hash)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password cannot be the same as your current password' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password in database
    const updateQuery = `
      UPDATE ${table} 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 1
    `
    
    await executeSingle(updateQuery, [newPasswordHash, payload.id])

    // Update token version to invalidate all existing sessions
    await updateTokenVersion(payload.type, payload.id)

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    })

  } catch (error) {
    console.error('Change password error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}