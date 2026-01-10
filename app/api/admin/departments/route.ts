import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'
import { getClientIdentifier } from '@/lib/utils'
import { checkRateLimit } from '@/lib/captcha'

interface Department {
  id: number
  name: string
  code: string | null
  description: string | null
  manager_id: number | null
  manager_name: string | null
  employee_count: number
  is_active: number
  created_at: Date
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`get_departments_${clientIdentifier}`, 30, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { organizationId, type: userType } = auth.user

    // Only organization admins can access this
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    // Get departments for the organization
    const query = `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.manager_id,
        COALESCE(m.full_name, 'No Manager') as manager_name,
        COUNT(DISTINCT ud.user_id) as employee_count,
        d.is_active,
        d.created_at
      FROM departments d
      LEFT JOIN organization_employees m ON d.manager_id = m.id
      LEFT JOIN user_departments ud ON d.id = ud.department_id AND ud.end_date IS NULL
      WHERE d.organization_id = ? AND d.deleted_at IS NULL
      GROUP BY d.id, d.name, d.code, d.description, d.manager_id, m.full_name, d.is_active, d.created_at
      ORDER BY d.name ASC
    `

    const departments = await executeQuery<Department>(query, [organizationId])

    return NextResponse.json({
      success: true,
      departments,
    })

  } catch (error) {
    console.error('Get departments error:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Department name must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Rate limiting
    const clientIdentifier = getClientIdentifier(request)
    if (!checkRateLimit(`create_department_${clientIdentifier}`, 10, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { organizationId, type: userType } = auth.user

    // Only organization admins can create departments
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const departmentName = name.trim()

    // Check if department name already exists
    const existingQuery = 'SELECT id FROM departments WHERE organization_id = ? AND name = ? AND deleted_at IS NULL'
    const existing = await executeQuery(existingQuery, [organizationId, departmentName])

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
        { status: 409 }
      )
    }

    // Auto-generate unique department code
    const generateDepartmentCode = (name: string): string => {
      // Take first 3 letters of each word, max 6 characters
      const words = name.split(' ').filter(word => word.length > 0)
      let code = ''
      
      if (words.length === 1) {
        // Single word: take first 3-4 characters
        code = words[0].substring(0, 4).toUpperCase()
      } else {
        // Multiple words: take first 2-3 characters from each word
        code = words.map(word => word.substring(0, 2)).join('').substring(0, 6).toUpperCase()
      }
      
      return code
    }

    // Auto-generate description based on department name
    const generateDescription = (name: string): string => {
      const descriptions: { [key: string]: string } = {
        'HR': 'Human Resources department responsible for employee management, recruitment, and organizational development.',
        'IT': 'Information Technology department managing technical infrastructure, software development, and digital systems.',
        'FINANCE': 'Finance department handling financial planning, accounting, budgeting, and financial reporting.',
        'MARKETING': 'Marketing department responsible for brand promotion, customer acquisition, and market research.',
        'SALES': 'Sales department focused on revenue generation, customer relationships, and business development.',
        'OPERATIONS': 'Operations department managing day-to-day business processes and operational efficiency.',
        'LEGAL': 'Legal department providing legal counsel, compliance oversight, and risk management.',
        'ADMIN': 'Administration department handling general administrative tasks and office management.',
        'RESEARCH': 'Research and Development department focused on innovation, product development, and research initiatives.',
        'SUPPORT': 'Customer Support department providing assistance and resolving customer inquiries.',
        'QUALITY': 'Quality Assurance department ensuring product and service quality standards.',
        'SECURITY': 'Security department responsible for organizational safety and security protocols.',
        'TRAINING': 'Training and Development department focused on employee skill development and education.',
        'PROCUREMENT': 'Procurement department managing vendor relationships and purchasing processes.',
        'LOGISTICS': 'Logistics department handling supply chain, inventory, and distribution management.'
      }

      const upperName = name.toUpperCase()
      
      // Check for exact matches or partial matches
      for (const [key, desc] of Object.entries(descriptions)) {
        if (upperName.includes(key) || key.includes(upperName)) {
          return desc
        }
      }
      
      // Default description for custom departments
      return `${name} department responsible for specialized functions and operations within the organization.`
    }

    let departmentCode = generateDepartmentCode(departmentName)
    
    // Ensure code uniqueness by adding numbers if needed
    let codeExists = true
    let counter = 1
    let finalCode = departmentCode
    
    while (codeExists) {
      const codeCheckQuery = 'SELECT id FROM departments WHERE organization_id = ? AND code = ? AND deleted_at IS NULL'
      const codeCheck = await executeQuery(codeCheckQuery, [organizationId, finalCode])
      
      if (codeCheck.length === 0) {
        codeExists = false
      } else {
        finalCode = `${departmentCode}${counter}`
        counter++
      }
    }

    const description = generateDescription(departmentName)

    // Create department
    const insertQuery = `
      INSERT INTO departments (organization_id, name, code, description)
      VALUES (?, ?, ?, ?)
    `
    
    const result = await executeSingle(insertQuery, [
      organizationId,
      departmentName,
      finalCode,
      description
    ])

    return NextResponse.json({
      success: true,
      message: 'Department created successfully',
      department: {
        id: result.insertId,
        name: departmentName,
        code: finalCode,
        description: description
      },
    })

  } catch (error) {
    console.error('Create department error:', error)
    
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    )
  }
}