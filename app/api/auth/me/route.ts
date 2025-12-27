import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getOrganizationDetails, getEmployeeWithOrganizationAndDepartment } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
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

    // Get user data based on type
    let userData: any = {}

    if (payload.type === 'organization') {
      const orgDetails = await getOrganizationDetails(payload.id)
      if (!orgDetails) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        )
      }

      userData = {
        id: orgDetails.id,
        name: orgDetails.admin_full_name,
        email: orgDetails.admin_email,
        type: 'organization',
        organization: {
          id: orgDetails.id,
          name: orgDetails.name,
          code: orgDetails.code,
          logo: orgDetails.logo,
          employeeCount: orgDetails.employeeCount,
          created_at: orgDetails.created_at,
        },
      }
    } else {
      const empDetails = await getEmployeeWithOrganizationAndDepartment(payload.id)
      if (!empDetails) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }

      userData = {
        id: empDetails.id,
        name: empDetails.full_name,
        email: empDetails.email,
        type: 'employee',
        department: empDetails.departmentName || empDetails.department, // Use new department name or fallback to old field
        organization: {
          id: empDetails.organization_id,
          name: empDetails.organizationName,
          code: empDetails.organizationCode,
        },
      }
    }

    return NextResponse.json({
      success: true,
      user: userData,
    })

  } catch (error) {
    console.error('Get user error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get user information' },
      { status: 500 }
    )
  }
}