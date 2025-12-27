import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { 
  hashPassword, 
  findEmployeeByEmail, 
  findOrganizationByCode,
  createEmployeeWithDepartment 
} from '@/lib/auth'
import { verifyCaptcha, checkRateLimit } from '@/lib/captcha'
import { generateOTP, sendOTPEmail } from '@/lib/email'
import { getClientIdentifier } from '@/lib/utils'

// Validation schema
const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgCode: z.string().min(8, 'Organization code must be 8 characters').max(8),
  department: z.string().optional(),
  captchaToken: z.string().min(1, 'CAPTCHA verification required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    const { fullName, email, password, orgCode, department, captchaToken } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`register_emp_${clientIdentifier}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Verify CAPTCHA
    const captchaResult = await verifyCaptcha(captchaToken, 'register_employee')
    if (!captchaResult.success) {
      return NextResponse.json(
        { error: captchaResult.error || 'CAPTCHA verification failed' },
        { status: 400 }
      )
    }

    // Verify organization exists
    const organization = await findOrganizationByCode(orgCode)
    if (!organization) {
      return NextResponse.json(
        { error: 'Invalid organization code' },
        { status: 404 }
      )
    }

    // Check if employee email already exists in this organization
    const existingEmployee = await findEmployeeByEmail(email, organization.id)
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'An employee with this email already exists in this organization' },
        { status: 409 }
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

    // Create employee account (unverified initially)
    const employeeId = await createEmployeeWithDepartment({
      organizationId: organization.id,
      fullName,
      email,
      passwordHash,
      departmentName: department,
    })

    // Store OTP temporarily
    const otpData = {
      otp,
      email,
      employeeId,
      organizationId: organization.id,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    }

    // In production, store this in Redis or database
    const tempToken = Buffer.from(JSON.stringify(otpData)).toString('base64')

    return NextResponse.json({
      success: true,
      message: 'Registration initiated. Please check your email for verification code.',
      tempToken,
      organizationName: organization.name,
    })

  } catch (error) {
    console.error('Employee registration error:', error)
    
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