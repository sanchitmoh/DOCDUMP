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

    const { organizationId, type: userType } = auth.user

    // Only organization admins can access admin stats
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get comprehensive organization statistics
    const stats = await Promise.all([
      // Total documents and recent uploads
      executeQuery(`
        SELECT 
          COUNT(f.id) as total_documents,
          COALESCE(SUM(f.size_bytes), 0) as total_size_bytes,
          COUNT(CASE WHEN f.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as uploads_this_week,
          COUNT(CASE WHEN f.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as uploads_this_month
        FROM files f 
        WHERE f.organization_id = ? AND f.is_deleted = 0
      `, [organizationId]),

      // Employee statistics
      executeQuery(`
        SELECT 
          COUNT(oe.id) as total_employees,
          COUNT(CASE WHEN oe.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_employees_this_month,
          COUNT(CASE WHEN oe.status = 1 THEN 1 END) as active_employees
        FROM organization_employees oe
        WHERE oe.organization_id = ?
      `, [organizationId]),

      // Upload activity and growth
      executeQuery(`
        SELECT 
          COUNT(f.id) as total_uploads,
          COUNT(CASE WHEN f.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as uploads_this_week,
          COUNT(CASE WHEN f.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND f.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as uploads_last_week
        FROM files f
        WHERE f.organization_id = ? AND f.is_deleted = 0
      `, [organizationId]),

      // Department statistics
      executeQuery(`
        SELECT 
          COUNT(DISTINCT d.id) as total_departments,
          COUNT(DISTINCT f.department) as departments_with_files
        FROM departments d
        LEFT JOIN files f ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci 
          AND f.organization_id = d.organization_id AND f.is_deleted = 0
        WHERE d.organization_id = ?
      `, [organizationId]),

      // Recent activity for admin dashboard
      executeQuery(`
        SELECT 
          'employee_joined' as activity_type,
          oe.full_name COLLATE utf8mb4_general_ci as subject,
          COALESCE(d.name, 'No Department') COLLATE utf8mb4_general_ci as department,
          oe.created_at as activity_date
        FROM organization_employees oe
        LEFT JOIN departments d ON oe.department_id = d.id
        WHERE oe.organization_id = ? AND oe.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        
        UNION ALL
        
        SELECT 
          'document_uploaded' as activity_type,
          f.name COLLATE utf8mb4_general_ci as subject,
          COALESCE(f.department, 'General') COLLATE utf8mb4_general_ci as department,
          f.created_at as activity_date
        FROM files f
        WHERE f.organization_id = ? AND f.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND f.is_deleted = 0
        
        UNION ALL
        
        SELECT 
          'department_created' as activity_type,
          d.name COLLATE utf8mb4_general_ci as subject,
          'Organization Settings' COLLATE utf8mb4_general_ci as department,
          d.created_at as activity_date
        FROM departments d
        WHERE d.organization_id = ? AND d.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        
        ORDER BY activity_date DESC
        LIMIT 10
      `, [organizationId, organizationId, organizationId]),

      // File type breakdown
      executeQuery(`
        SELECT 
          file_type,
          COUNT(*) as count,
          COALESCE(SUM(size_bytes), 0) as total_size
        FROM (
          SELECT 
            CASE 
              WHEN f.mime_type LIKE 'image/%' THEN 'Images'
              WHEN f.mime_type LIKE 'video/%' THEN 'Videos'
              WHEN f.mime_type LIKE 'audio/%' THEN 'Audio'
              WHEN f.mime_type = 'application/pdf' THEN 'PDFs'
              WHEN f.mime_type LIKE 'application/vnd.ms-%' OR f.mime_type LIKE 'application/vnd.openxmlformats%' THEN 'Office Documents'
              WHEN f.mime_type LIKE 'text/%' THEN 'Text Files'
              ELSE 'Other'
            END as file_type,
            f.size_bytes
          FROM files f
          WHERE f.organization_id = ? AND f.is_deleted = 0
        ) AS categorized_files
        GROUP BY file_type
        ORDER BY count DESC
      `, [organizationId]),

      // Storage usage by provider
      executeQuery(`
        SELECT 
          f.storage_provider,
          COUNT(f.id) as file_count,
          COALESCE(SUM(f.size_bytes), 0) as total_bytes
        FROM files f
        WHERE f.organization_id = ? AND f.is_deleted = 0
        GROUP BY f.storage_provider
      `, [organizationId])
    ])

    // Calculate growth rate
    const uploadsThisWeek = stats[2][0]?.uploads_this_week || 0
    const uploadsLastWeek = stats[2][0]?.uploads_last_week || 0
    const growthRate = uploadsLastWeek > 0 
      ? ((uploadsThisWeek - uploadsLastWeek) / uploadsLastWeek * 100).toFixed(1)
      : uploadsThisWeek > 0 ? '100.0' : '0.0'

    return NextResponse.json({
      success: true,
      stats: {
        // Main metrics
        totalDocuments: stats[0][0]?.total_documents || 0,
        totalSizeBytes: stats[0][0]?.total_size_bytes || 0,
        uploadsThisWeek: stats[0][0]?.uploads_this_week || 0,
        uploadsThisMonth: stats[0][0]?.uploads_this_month || 0,
        
        // Employee metrics
        totalEmployees: stats[1][0]?.total_employees || 0,
        activeEmployees: stats[1][0]?.active_employees || 0,
        newEmployeesThisMonth: stats[1][0]?.new_employees_this_month || 0,
        
        // Upload activity
        totalUploads: stats[2][0]?.total_uploads || 0,
        growthRate: parseFloat(growthRate),
        
        // Department metrics
        totalDepartments: stats[3][0]?.total_departments || 0,
        departmentsWithFiles: stats[3][0]?.departments_with_files || 0,
        
        // Recent activity
        recentActivity: stats[4].map((activity: any) => ({
          type: activity.activity_type,
          subject: activity.subject,
          department: activity.department,
          date: activity.activity_date
        })),
        
        // File type breakdown
        fileTypes: stats[5],
        
        // Storage breakdown
        storageByProvider: stats[6]
      }
    })

  } catch (error) {
    console.error('Admin dashboard stats error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch admin dashboard stats'
    }, { status: 500 })
  }
}