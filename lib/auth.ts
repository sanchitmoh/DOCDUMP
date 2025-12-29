import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { executeQuery, executeSingle } from './database'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface Organization {
  id: number
  name: string
  code: string
  admin_full_name: string
  admin_email: string
  password_hash: string
  logo?: string
  status: number
  token_version: number
  created_at: Date
  updated_at: Date
}

export interface Employee {
  id: number
  organization_id: number
  full_name: string
  email: string
  password_hash: string
  department?: string
  status: number
  token_version: number
  created_at: Date
  updated_at: Date
}

export interface JWTPayload {
  id: number
  email: string
  type: 'organization' | 'employee'
  organizationId?: number
  tokenVersion: number
  userId?: number // Add userId for backward compatibility
}

export interface AuthResult {
  success: boolean
  user?: JWTPayload
  error?: string
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Generate JWT token
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (error) {
    return null
  }
}

// Authenticate request from cookie
export function authenticateRequest(request: NextRequest): AuthResult {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value
    
    if (!token) {
      return { success: false, error: 'Authentication required' }
    }

    // Verify token
    const decoded = verifyToken(token)
    if (!decoded) {
      return { success: false, error: 'Invalid or expired token' }
    }

    // Add userId for backward compatibility
    const user = {
      ...decoded,
      userId: decoded.id,
      organizationId: decoded.organizationId || decoded.id
    }

    return { success: true, user }
  } catch (error) {
    return { success: false, error: 'Authentication failed' }
  }
}

// Generate organization code
export function generateOrgCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// Check if organization exists by email
export async function findOrganizationByEmail(email: string): Promise<Organization | null> {
  const query = 'SELECT * FROM organizations WHERE admin_email = ? AND status = 1'
  const results = await executeQuery<Organization>(query, [email])
  return results.length > 0 ? results[0] : null
}

// Check if organization exists by code
export async function findOrganizationByCode(code: string): Promise<Organization | null> {
  const query = 'SELECT * FROM organizations WHERE code = ? AND status = 1'
  const results = await executeQuery<Organization>(query, [code])
  return results.length > 0 ? results[0] : null
}

// Check if employee exists by email and organization
export async function findEmployeeByEmail(email: string, organizationId?: number): Promise<Employee | null> {
  let query = 'SELECT * FROM organization_employees WHERE email = ? AND status = 1'
  const params: any[] = [email]
  
  if (organizationId) {
    query += ' AND organization_id = ?'
    params.push(organizationId)
  }
  
  const results = await executeQuery<Employee>(query, params)
  return results.length > 0 ? results[0] : null
}

// Create new organization
export async function createOrganization(data: {
  name: string
  code: string
  adminFullName: string
  adminEmail: string
  passwordHash: string
  logo?: string
}): Promise<number> {
  const query = `
    INSERT INTO organizations (name, code, admin_full_name, admin_email, password_hash, logo)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  const result = await executeSingle(query, [
    data.name,
    data.code,
    data.adminFullName,
    data.adminEmail,
    data.passwordHash,
    data.logo || null
  ])
  return result.insertId
}

// Create new employee
export async function createEmployee(data: {
  organizationId: number
  fullName: string
  email: string
  passwordHash: string
  department?: string
}): Promise<number> {
  const query = `
    INSERT INTO organization_employees (organization_id, full_name, email, password_hash, department)
    VALUES (?, ?, ?, ?, ?)
  `
  const result = await executeSingle(query, [
    data.organizationId,
    data.fullName,
    data.email,
    data.passwordHash,
    data.department || null
  ])
  return result.insertId
}

// Create employee with department relationship
export async function createEmployeeWithDepartment(data: {
  organizationId: number
  fullName: string
  email: string
  passwordHash: string
  departmentName?: string
}): Promise<number> {
  // First create the employee
  const employeeQuery = `
    INSERT INTO organization_employees (organization_id, full_name, email, password_hash)
    VALUES (?, ?, ?, ?)
  `
  const employeeResult = await executeSingle(employeeQuery, [
    data.organizationId,
    data.fullName,
    data.email,
    data.passwordHash
  ])
  
  const employeeId = employeeResult.insertId

  // If department is specified, link the employee to the department
  if (data.departmentName) {
    // Find the department by name in the organization
    const deptQuery = `
      SELECT id FROM departments 
      WHERE organization_id = ? AND name = ? AND is_active = 1 AND deleted_at IS NULL
    `
    const deptResults = await executeQuery<{ id: number }>(deptQuery, [data.organizationId, data.departmentName])
    
    if (deptResults.length > 0) {
      const departmentId = deptResults[0].id
      
      // Create user-department relationship
      const userDeptQuery = `
        INSERT INTO user_departments (user_id, department_id, is_primary)
        VALUES (?, ?, 1)
      `
      await executeSingle(userDeptQuery, [employeeId, departmentId])
    }
  }

  return employeeId
}

// Update token version (for logout/security)
export async function updateTokenVersion(type: 'organization' | 'employee', id: number): Promise<void> {
  const table = type === 'organization' ? 'organizations' : 'organization_employees'
  const query = `UPDATE ${table} SET token_version = token_version + 1 WHERE id = ?`
  await executeSingle(query, [id])
}

// Get organization with employee count
export async function getOrganizationDetails(id: number): Promise<Organization & { employeeCount: number } | null> {
  const query = `
    SELECT o.*, 
           (SELECT COUNT(*) FROM organization_employees WHERE organization_id = o.id AND status = 1) as employeeCount
    FROM organizations o 
    WHERE o.id = ? AND o.status = 1
  `
  const results = await executeQuery<Organization & { employeeCount: number }>(query, [id])
  return results.length > 0 ? results[0] : null
}

// Get employee with organization details
export async function getEmployeeWithOrganization(id: number): Promise<(Employee & { organizationName: string; organizationCode: string }) | null> {
  const query = `
    SELECT e.*, o.name as organizationName, o.code as organizationCode
    FROM organization_employees e
    JOIN organizations o ON e.organization_id = o.id
    WHERE e.id = ? AND e.status = 1 AND o.status = 1
  `
  const results = await executeQuery<Employee & { organizationName: string; organizationCode: string }>(query, [id])
  return results.length > 0 ? results[0] : null
}

// Get employee with organization and department details
export async function getEmployeeWithOrganizationAndDepartment(id: number): Promise<(Employee & { organizationName: string; organizationCode: string; departmentName?: string }) | null> {
  const query = `
    SELECT 
      e.*, 
      o.name as organizationName, 
      o.code as organizationCode,
      d.name as departmentName
    FROM organization_employees e
    JOIN organizations o ON e.organization_id = o.id
    LEFT JOIN user_departments ud ON e.id = ud.user_id AND ud.end_date IS NULL AND ud.is_primary = 1
    LEFT JOIN departments d ON ud.department_id = d.id AND d.is_active = 1 AND d.deleted_at IS NULL
    WHERE e.id = ? AND e.status = 1 AND o.status = 1
  `
  const results = await executeQuery<Employee & { organizationName: string; organizationCode: string; departmentName?: string }>(query, [id])
  return results.length > 0 ? results[0] : null
}

// Get or create system employee for organization admin
export async function getOrCreateSystemEmployee(organizationId: number, adminEmail: string): Promise<number> {
  const systemEmployeeEmail = `admin-${organizationId}@system.internal`
  
  try {
    // Check if system employee record exists
    const existingSystemEmployee = await executeQuery(`
      SELECT id FROM organization_employees 
      WHERE organization_id = ? AND email = ? AND status = 1
    `, [organizationId, systemEmployeeEmail])
    
    if (existingSystemEmployee.length > 0) {
      return existingSystemEmployee[0].id
    }
    
    // Create system employee record for organization admin
    const result = await executeSingle(`
      INSERT INTO organization_employees (
        organization_id, full_name, email, password_hash, status
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      organizationId,
      `System Admin (${adminEmail})`,
      systemEmployeeEmail,
      'system-admin-no-password', // Placeholder password hash
      1
    ])
    
    return result.insertId
  } catch (error) {
    console.error('Error creating system employee for admin:', error)
    throw error
  }
}