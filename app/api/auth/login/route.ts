import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { 
  verifyPassword, 
  generateToken, 
  findOrganizationByEmail, 
  findEmployeeByEmail,
  getOrganizationDetails,
  getEmployeeWithOrganization
} from '@/lib/auth'
import { verifyCaptcha, checkRateLimit } from '@/lib/captcha'
import { getClientIdentifier } from '@/lib/utils'

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().min(1, 'CAPTCHA verification required'),
  rememberMe: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = loginSchema.parse(body)
    const { email, password, captchaToken, rememberMe } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`login_${clientIdentifier}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Verify CAPTCHA
    const captchaResult = await verifyCaptcha(captchaToken, 'login')
    if (!captchaResult.success) {
      return NextResponse.json(
        { error: captchaResult.error || 'CAPTCHA verification failed' },
        { status: 400 }
      )
    }

    // Try to find organization first
    let user: any = null
    let userType: 'organization' | 'employee' = 'organization'
    
    const organization = await findOrganizationByEmail(email)
    if (organization) {
      user = organization
      userType = 'organization'
    } else {
      // Try to find employee
      const employee = await findEmployeeByEmail(email)
      if (employee) {
        user = employee
        userType = 'employee'
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if account is active
    if (user.status !== 1) {
      return NextResponse.json(
        { error: 'Account is not active. Please verify your email or contact support.' },
        { status: 403 }
      )
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email || user.admin_email,
      type: userType,
      organizationId: userType === 'employee' ? user.organization_id : user.id,
      tokenVersion: user.token_version,
    }

    const token = generateToken(tokenPayload)

    // Get additional user data
    let userData: any = {}
    
    if (userType === 'organization') {
      const orgDetails = await getOrganizationDetails(user.id)
      userData = {
        id: user.id,
        name: user.admin_full_name,
        email: user.admin_email,
        type: 'organization',
        organization: {
          id: user.id,
          name: user.name,
          code: user.code,
          logo: user.logo,
          employeeCount: orgDetails?.employeeCount || 0,
          created_at: user.created_at,
        },
      }
    } else {
      const empDetails = await getEmployeeWithOrganization(user.id)
      userData = {
        id: user.id,
        name: user.full_name,
        email: user.email,
        type: 'employee',
        department: user.department,
        organization: {
          id: user.organization_id,
          name: empDetails?.organizationName,
          code: empDetails?.organizationCode,
        },
      }
    }

    // Set cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 days or 1 day
      path: '/',
    }

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: userData,
    })

    // Set authentication cookie
    response.cookies.set('auth-token', token, cookieOptions)

    return response

  } catch (error) {
    console.error('Login error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    )
  }
}