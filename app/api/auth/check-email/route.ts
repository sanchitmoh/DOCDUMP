import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeQuery } from '@/lib/database'
import { checkRateLimit } from '@/lib/captcha'
import { getClientIdentifier } from '@/lib/utils'

// Validation schema
const checkEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  userType: z.enum(['organization', 'employee'], {
    required_error: 'User type is required',
  }),
  orgCode: z.string().optional(), // Required for employee checks
})

interface EmailCheckResult {
  available: boolean
  suggestions?: string[]
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = checkEmailSchema.parse(body)
    const { email, userType, orgCode } = validatedData

    // Rate limiting to prevent abuse
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`check_email_${clientIdentifier}`, 20, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many email checks. Please try again later.' },
        { status: 429 }
      )
    }

    let result: EmailCheckResult

    if (userType === 'organization') {
      result = await checkOrganizationEmail(email)
    } else {
      if (!orgCode) {
        return NextResponse.json(
          { error: 'Organization code is required for employee email check' },
          { status: 400 }
        )
      }
      result = await checkEmployeeEmail(email, orgCode)
    }

    return NextResponse.json({
      success: true,
      ...result,
    })

  } catch (error) {
    console.error('Email check error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Email check failed. Please try again.' },
      { status: 500 }
    )
  }
}

async function checkOrganizationEmail(email: string): Promise<EmailCheckResult> {
  try {
    // Check if email exists in organizations table (uses idx_org_email index)
    const query = 'SELECT admin_email FROM organizations WHERE admin_email = ? LIMIT 1'
    const results = await executeQuery(query, [email])

    if (results.length > 0) {
      // Email is taken, generate suggestions
      const suggestions = generateEmailSuggestions(email, 'organization')
      return {
        available: false,
        suggestions,
        message: 'This email is already registered as an organization admin',
      }
    }

    // Also check if email exists as an employee (cross-check)
    const employeeQuery = 'SELECT email FROM organization_employees WHERE email = ? LIMIT 1'
    const employeeResults = await executeQuery(employeeQuery, [email])

    if (employeeResults.length > 0) {
      const suggestions = generateEmailSuggestions(email, 'organization')
      return {
        available: false,
        suggestions,
        message: 'This email is already registered as an employee',
      }
    }

    return {
      available: true,
      message: 'Email is available',
    }

  } catch (error) {
    console.error('Organization email check error:', error)
    throw error
  }
}

async function checkEmployeeEmail(email: string, orgCode: string): Promise<EmailCheckResult> {
  try {
    // First, verify the organization exists and get its ID
    const orgQuery = 'SELECT id, name FROM organizations WHERE code = ? AND status = 1 LIMIT 1'
    const orgResults = await executeQuery<{ id: number; name: string }>(orgQuery, [orgCode])

    if (orgResults.length === 0) {
      return {
        available: false,
        message: 'Invalid organization code',
      }
    }

    const organizationId = orgResults[0].id
    const organizationName = orgResults[0].name

    // Check if email exists in this organization (uses idx_emp_org_email index)
    const employeeQuery = `
      SELECT email FROM organization_employees 
      WHERE email = ? AND organization_id = ? 
      LIMIT 1
    `
    const employeeResults = await executeQuery(employeeQuery, [email, organizationId])

    if (employeeResults.length > 0) {
      const suggestions = generateEmailSuggestions(email, 'employee')
      return {
        available: false,
        suggestions,
        message: `This email is already registered in ${organizationName}`,
      }
    }

    // Check if email exists as organization admin
    const adminQuery = 'SELECT admin_email FROM organizations WHERE admin_email = ? LIMIT 1'
    const adminResults = await executeQuery(adminQuery, [email])

    if (adminResults.length > 0) {
      const suggestions = generateEmailSuggestions(email, 'employee')
      return {
        available: false,
        suggestions,
        message: 'This email is already registered as an organization admin',
      }
    }

    return {
      available: true,
      message: `Email is available for ${organizationName}`,
    }

  } catch (error) {
    console.error('Employee email check error:', error)
    throw error
  }
}

function generateEmailSuggestions(email: string, userType: 'organization' | 'employee'): string[] {
  const [localPart, domain] = email.split('@')
  
  if (!localPart || !domain) {
    return []
  }

  const suggestions: string[] = []
  
  if (userType === 'organization') {
    // Suggestions for organization admins
    suggestions.push(
      `${localPart}.admin@${domain}`,
      `${localPart}_org@${domain}`,
      `admin.${localPart}@${domain}`,
      `${localPart}${Math.floor(Math.random() * 100)}@${domain}`,
      `${localPart}.corp@${domain}`
    )
  } else {
    // Suggestions for employees
    suggestions.push(
      `${localPart}.emp@${domain}`,
      `${localPart}_employee@${domain}`,
      `${localPart}${Math.floor(Math.random() * 100)}@${domain}`,
      `${localPart}.work@${domain}`,
      `${localPart}_${new Date().getFullYear()}@${domain}`
    )
  }

  // Return unique suggestions (first 3)
  return [...new Set(suggestions)].slice(0, 3)
}

// GET endpoint for simple availability check (without suggestions)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userType = searchParams.get('userType') as 'organization' | 'employee'
    const orgCode = searchParams.get('orgCode')

    if (!email || !userType) {
      return NextResponse.json(
        { error: 'Email and userType parameters are required' },
        { status: 400 }
      )
    }

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`check_email_get_${clientIdentifier}`, 30, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    let available = false

    if (userType === 'organization') {
      const result = await checkOrganizationEmail(email)
      available = result.available
    } else {
      if (!orgCode) {
        return NextResponse.json(
          { error: 'Organization code is required for employee email check' },
          { status: 400 }
        )
      }
      const result = await checkEmployeeEmail(email, orgCode)
      available = result.available
    }

    return NextResponse.json({
      available,
      email,
      userType,
    })

  } catch (error) {
    console.error('Email availability check error:', error)
    return NextResponse.json(
      { error: 'Check failed' },
      { status: 500 }
    )
  }
}