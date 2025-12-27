import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeQuery } from '@/lib/database'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'

// Validation schema
const getDepartmentsSchema = z.object({
  orgCode: z.string().length(8, 'Organization code must be 8 characters'),
})

interface Department {
  id: number
  name: string
  code: string | null
  description: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = getDepartmentsSchema.parse(body)
    const { orgCode } = validatedData

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`get_org_departments_${clientIdentifier}`, 20, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // First, verify the organization exists and is active
    const orgQuery = 'SELECT id, name FROM organizations WHERE code = ? AND status = 1'
    const orgResults = await executeQuery<{ id: number; name: string }>(orgQuery, [orgCode])

    if (orgResults.length === 0) {
      return NextResponse.json(
        { error: 'Invalid organization code' },
        { status: 404 }
      )
    }

    const organization = orgResults[0]

    // Get departments for this organization
    const departmentsQuery = `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description
      FROM departments d
      WHERE d.organization_id = ? AND d.is_active = 1 AND d.deleted_at IS NULL
      ORDER BY d.name ASC
    `

    const departments = await executeQuery<Department>(departmentsQuery, [organization.id])

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      departments: departments.map(dept => dept.name),
    })

  } catch (error) {
    console.error('Get departments by org code error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}