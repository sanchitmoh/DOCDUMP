import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'
import { z } from 'zod'

interface EmployeeProfile {
  id: number
  full_name: string
  email: string
  department_name: string | null
  organization_name: string
  organization_code: string
  created_at: Date
}

// Validation schema for profile updates
const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255),
})

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`get_employee_profile_${clientIdentifier}`, 30, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
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
    
    if (!payload || payload.type !== 'employee') {
      return NextResponse.json(
        { error: 'Unauthorized. Only employees can access this endpoint.' },
        { status: 403 }
      )
    }

    // Get employee profile with department and organization info
    const query = `
      SELECT 
        e.id,
        e.full_name,
        e.email,
        e.created_at,
        o.name as organization_name,
        o.code as organization_code,
        d.name as department_name
      FROM organization_employees e
      JOIN organizations o ON e.organization_id = o.id
      LEFT JOIN user_departments ud ON e.id = ud.user_id AND ud.end_date IS NULL AND ud.is_primary = 1
      LEFT JOIN departments d ON ud.department_id = d.id AND d.is_active = 1 AND d.deleted_at IS NULL
      WHERE e.id = ? AND e.status = 1 AND o.status = 1
    `

    const results = await executeQuery<EmployeeProfile>(query, [payload.id])

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'Employee profile not found' },
        { status: 404 }
      )
    }

    const profile = results[0]

    const responseData = {
      success: true,
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        department: profile.department_name,
        organizationName: profile.organization_name,
        organizationCode: profile.organization_code,
        memberSince: profile.created_at,
      },
    }
    
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Get employee profile error:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = updateProfileSchema.parse(body)
    const { fullName } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`update_employee_profile_${clientIdentifier}`, 10, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
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
    if (!payload || payload.type !== 'employee') {
      return NextResponse.json(
        { error: 'Unauthorized. Only employees can update their profile.' },
        { status: 403 }
      )
    }

    // Update employee profile
    const updateQuery = `
      UPDATE organization_employees 
      SET full_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 1
    `

    await executeSingle(updateQuery, [fullName, payload.id])

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    })

  } catch (error) {
    console.error('Update employee profile error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}