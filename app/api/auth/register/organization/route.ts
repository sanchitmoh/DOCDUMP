import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { 
  hashPassword, 
  generateOrgCode, 
  findOrganizationByEmail, 
  findOrganizationByCode,
  createOrganization 
} from '@/lib/auth'
import { verifyCaptcha, checkRateLimit } from '@/lib/captcha'
import { generateOTP, sendOTPEmail } from '@/lib/email'
import { getClientIdentifier } from '@/lib/utils'

// Validation schema
const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  captchaToken: z.string().min(1, 'CAPTCHA verification required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    const { fullName, email, password, organizationName, captchaToken } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`register_org_${clientIdentifier}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Verify CAPTCHA
    const captchaResult = await verifyCaptcha(captchaToken, 'register_organization')
    if (!captchaResult.success) {
      return NextResponse.json(
        { error: captchaResult.error || 'CAPTCHA verification failed' },
        { status: 400 }
      )
    }

    // Check if organization admin email already exists
    const existingOrg = await findOrganizationByEmail(email)
    if (existingOrg) {
      return NextResponse.json(
        { error: 'An organization with this email already exists' },
        { status: 409 }
      )
    }

    // Generate unique organization code
    let orgCode: string
    let codeExists = true
    let attempts = 0
    
    do {
      orgCode = generateOrgCode()
      const existing = await findOrganizationByCode(orgCode)
      codeExists = !!existing
      attempts++
    } while (codeExists && attempts < 10)

    if (codeExists) {
      return NextResponse.json(
        { error: 'Unable to generate unique organization code. Please try again.' },
        { status: 500 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Generate and send OTP
    const otp = generateOTP()
    const otpSent = await sendOTPEmail(email, otp, fullName)
    
    if (!otpSent) {
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      )
    }

    // Store registration data temporarily (in production, use Redis or database)
    // For now, we'll create the organization but mark it as unverified
    const organizationId = await createOrganization({
      name: organizationName,
      code: orgCode,
      adminFullName: fullName,
      adminEmail: email,
      passwordHash,
    })

    // Store OTP temporarily (in production, use Redis with expiration)
    // For demo purposes, we'll use a simple approach
    const otpData = {
      otp,
      email,
      organizationId,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    }

    // In production, store this in Redis or database
    // For now, we'll return a temporary token to identify the registration
    const tempToken = Buffer.from(JSON.stringify(otpData)).toString('base64')

    return NextResponse.json({
      success: true,
      message: 'Registration initiated. Please check your email for verification code.',
      tempToken,
      organizationCode: orgCode,
    })

  } catch (error) {
    console.error('Organization registration error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}