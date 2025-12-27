import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database'
import { generateOTP, sendPasswordResetEmail } from '@/lib/email'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'
import { z } from 'zod'

// Validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  userType: z.enum(['organization', 'employee'], {
    errorMap: () => ({ message: 'User type must be either organization or employee' })
  }),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = forgotPasswordSchema.parse(body)
    const { email, userType } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`forgot_password_${clientIdentifier}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Check if user exists
    let userQuery: string
    let userParams: any[]

    if (userType === 'organization') {
      userQuery = 'SELECT id, admin_full_name as full_name, admin_email as email FROM organizations WHERE admin_email = ? AND status = 1'
      userParams = [email]
    } else {
      userQuery = 'SELECT id, full_name, email FROM organization_employees WHERE email = ? AND status = 1'
      userParams = [email]
    }

    const userResults = await executeQuery<{ id: number; full_name: string; email: string }>(userQuery, userParams)

    // Always return success to prevent email enumeration attacks
    // But only send email if user actually exists
    if (userResults.length > 0) {
      const user = userResults[0]
      
      // Generate reset code
      const resetCode = generateOTP()
      
      // Send password reset email
      const emailSent = await sendPasswordResetEmail(user.email, resetCode, user.full_name)
      
      if (emailSent) {
        // Store reset code temporarily (in production, use Redis or database)
        const resetData = {
          userId: user.id,
          userType,
          email: user.email,
          resetCode,
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        }

        // In production, store this in Redis or database
        // For now, we'll encode it in a temporary token
        const tempToken = Buffer.from(JSON.stringify(resetData)).toString('base64')

        // Note: In a real application, you'd store this server-side
        console.log('Password reset requested for:', user.email, 'Code:', resetCode)
        
        return NextResponse.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
          tempToken, // In production, don't return this - store server-side
        })
      }
    }

    // Always return the same message regardless of whether user exists
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    )
  }
}