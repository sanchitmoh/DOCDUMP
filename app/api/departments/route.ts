import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { organizationId } = auth.user

    // Get active departments for the organization
    const departments = await executeQuery(`
      SELECT 
        id,
        name,
        code,
        description
      FROM departments 
      WHERE organization_id = ? 
        AND is_active = 1 
        AND deleted_at IS NULL
      ORDER BY name ASC
    `, [organizationId])

    return NextResponse.json({
      success: true,
      departments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description
      }))
    })

  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}