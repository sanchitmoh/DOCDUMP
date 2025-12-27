import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, updateTokenVersion, verifyPassword } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'
import { z } from 'zod'

// Validation schema
const resetPasswordSchema = z.object({
  resetCode: z.string().min(6, 'Reset code must be 6 digits').max(6),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  tempToken: z.string().min(1, 'Reset token is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = resetPasswordSchema.parse(body)
    const { resetCode, newPassword, tempToken } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`reset_password_${clientIdentifier}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Decode and verify temp token
    let resetData: any
    try {
      const decodedToken = Buffer.from(tempToken, 'base64').toString('utf-8')
      resetData = JSON.parse(decodedToken)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (Date.now() > resetData.expiresAt) {
      return NextResponse.json(
        { error: 'Reset code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Verify reset code
    if (resetCode !== resetData.resetCode) {
      return NextResponse.json(
        { error: 'Invalid reset code' },
        { status: 400 }
      )
    }

    // Get user's current password hash to check if new password is the same
    const table = resetData.userType === 'organization' ? 'organizations' : 'organization_employees'
    const getUserQuery = `SELECT password_hash FROM ${table} WHERE id = ? AND status = 1`
    
    const userResults = await executeQuery<{ password_hash: string }>(getUserQuery, [resetData.userId])
    
    if (userResults.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = userResults[0]

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
    
    await executeSingle(updateQuery, [newPasswordHash, resetData.userId])

    // Update token version to invalidate all existing sessions
    await updateTokenVersion(resetData.userType, resetData.userId)

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    })

  } catch (error) {
    console.error('Reset password error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}