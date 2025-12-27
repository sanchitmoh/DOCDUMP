import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { executeQuery } from '@/lib/database'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'

interface Employee {
  id: number
  name: string
  email: string
  department: string | null
  status: "active" | "inactive"
  joinDate: string
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`get_people_${clientIdentifier}`, 30, 60 * 1000)) {
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
    if (!payload || payload.type !== 'organization') {
      return NextResponse.json(
        { error: 'Unauthorized. Only organization admins can access employee data.' },
        { status: 403 }
      )
    }

    // Get employees for the organization
    const query = `
      SELECT 
        e.id,
        e.full_name as name,
        e.email,
        COALESCE(e.department, 'No Department') as department,
        CASE WHEN e.status = 1 THEN 'active' ELSE 'inactive' END as status,
        DATE_FORMAT(e.created_at, '%Y-%m-%d') as joinDate
      FROM organization_employees e
      WHERE e.organization_id = ?
      ORDER BY e.created_at DESC
    `

    const organizationId = payload.organizationId || payload.id
    const employees = await executeQuery<Employee>(query, [organizationId])

    return NextResponse.json({
      success: true,
      people: employees,
    })

  } catch (error) {
    console.error('Get people error:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}