import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeSingle } from '@/lib/database'
import { checkRateLimit } from '@/lib/captcha'
import { getClientIdentifier } from '@/lib/utils'

// Validation schema
const verifyOtpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
  tempToken: z.string().min(1, 'Verification token required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = verifyOtpSchema.parse(body)
    const { otp, tempToken } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`verify_otp_${clientIdentifier}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Decode temp token
    let otpData: any
    try {
      const decoded = Buffer.from(tempToken, 'base64').toString('utf-8')
      otpData = JSON.parse(decoded)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }

    // Check if OTP is expired
    if (Date.now() > otpData.expiresAt) {
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Verify OTP
    if (otp !== otpData.otp) {
      return NextResponse.json(
        { error: 'Invalid OTP code' },
        { status: 400 }
      )
    }

    // Activate the account based on type
    if (otpData.organizationId && !otpData.employeeId) {
      // Organization verification
      await executeSingle(
        'UPDATE organizations SET status = 1 WHERE id = ?',
        [otpData.organizationId]
      )
    } else if (otpData.employeeId) {
      // Employee verification
      await executeSingle(
        'UPDATE organization_employees SET status = 1 WHERE id = ?',
        [otpData.employeeId]
      )
    } else {
      return NextResponse.json(
        { error: 'Invalid verification data' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    })

  } catch (error) {
    console.error('OTP verification error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    )
  }
}