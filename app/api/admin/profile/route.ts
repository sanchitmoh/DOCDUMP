import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'

// Validation schema
const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
})

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = updateProfileSchema.parse(body)
    const { fullName, organizationName } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`update_profile_${clientIdentifier}`, 10, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many update attempts. Please try again later.' },
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
    if (!payload || payload.type !== 'organization') {
      return NextResponse.json(
        { error: 'Unauthorized. Only organization admins can update profile.' },
        { status: 403 }
      )
    }

    const organizationId = payload.organizationId || payload.id

    // Check if organization name already exists (excluding current organization)
    const existingOrgQuery = 'SELECT id FROM organizations WHERE name = ? AND id != ?'
    const existingOrg = await executeQuery(existingOrgQuery, [organizationName.trim(), organizationId])

    if (existingOrg.length > 0) {
      return NextResponse.json(
        { error: 'An organization with this name already exists' },
        { status: 409 }
      )
    }

    // Update organization profile
    const updateQuery = `
      UPDATE organizations 
      SET admin_full_name = ?, name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    
    await executeSingle(updateQuery, [
      fullName.trim(),
      organizationName.trim(),
      organizationId
    ])

    // Get updated organization details
    const getUpdatedQuery = `
      SELECT 
        id,
        name,
        code,
        admin_full_name,
        admin_email,
        logo,
        created_at,
        (SELECT COUNT(*) FROM organization_employees WHERE organization_id = ? AND status = 1) as employeeCount
      FROM organizations 
      WHERE id = ?
    `
    
    const updatedOrg = await executeQuery(getUpdatedQuery, [organizationId, organizationId])

    if (updatedOrg.length === 0) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const org = updatedOrg[0]

    // Return updated user data
    const userData = {
      id: org.id,
      name: org.admin_full_name,
      email: org.admin_email,
      type: 'organization',
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
        logo: org.logo,
        employeeCount: org.employeeCount,
        created_at: org.created_at,
      },
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: userData,
    })

  } catch (error) {
    console.error('Update profile error:', error)
    
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