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

    const organizationId = payload.organizationId || payload.id
    console.log('Fetching employees for organization ID:', organizationId)

    // Get employees for the organization with their departments
    const query = `
      SELECT 
        e.id,
        e.full_name as name,
        e.email,
        COALESCE(d.name, 'No Department') as department,
        CASE WHEN e.status = 1 THEN 'active' ELSE 'inactive' END as status,
        DATE_FORMAT(e.created_at, '%Y-%m-%d') as joinDate
      FROM organization_employees e
      LEFT JOIN user_departments ud ON e.id = ud.user_id AND ud.end_date IS NULL AND ud.is_primary = 1
      LEFT JOIN departments d ON ud.department_id = d.id AND d.is_active = 1 AND d.deleted_at IS NULL
      WHERE e.organization_id = ?
      ORDER BY e.created_at DESC
    `

    console.log('Executing query:', query)
    console.log('With params:', [organizationId])

    const employees = await executeQuery<Employee>(query, [organizationId])
    
    console.log('Query successful, found employees:', employees.length)

    return NextResponse.json({
      success: true,
      people: employees,
    })

  } catch (error) {
    console.error('Get people error:', error)
    
    // Provide more specific error information
    let errorMessage = 'Failed to fetch employees'
    let statusCode = 500
    
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      // Check for specific database errors
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Database connection refused. Please check if MySQL is running.'
      } else if (error.message.includes('ER_BAD_DB_ERROR')) {
        errorMessage = 'Database does not exist. Please create the database first.'
      } else if (error.message.includes('ER_ACCESS_DENIED_ERROR')) {
        errorMessage = 'Database access denied. Please check your credentials.'
      } else if (error.message.includes('ER_NO_SUCH_TABLE')) {
        errorMessage = 'Required database tables do not exist. Please run the database setup.'
      } else if (error.message.includes('Unknown column')) {
        errorMessage = 'Database schema mismatch. Please update your database schema.'
      } else if (error.message.includes('Connection lost')) {
        errorMessage = 'Database connection lost. Please try again.'
      } else {
        // Include the actual error message for debugging
        errorMessage = `Database error: ${error.message}`
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}