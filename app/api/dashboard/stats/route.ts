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

    const { userId, organizationId, type: userType } = auth.user

    // Advanced dashboard stats with comprehensive metrics
    const stats = await Promise.all([
      // User file statistics with multimedia metadata
      executeQuery(`
        SELECT 
          COUNT(f.id) as total_files,
          COALESCE(SUM(f.size_bytes), 0) as total_size_bytes,
          COALESCE(SUM(CASE WHEN f.mime_type LIKE 'image/%' THEN 1 ELSE 0 END), 0) as image_count,
          COALESCE(SUM(CASE WHEN f.mime_type LIKE 'video/%' THEN 1 ELSE 0 END), 0) as video_count,
          COALESCE(SUM(CASE WHEN f.mime_type LIKE 'audio/%' THEN 1 ELSE 0 END), 0) as audio_count,
          COALESCE(SUM(CASE WHEN f.mime_type = 'application/pdf' THEN 1 ELSE 0 END), 0) as pdf_count,
          COALESCE(AVG(f.size_bytes), 0) as avg_file_size
        FROM files f 
        WHERE f.created_by = ? AND f.organization_id = ? AND f.is_deleted = 0
      `, [userId, organizationId]),

      // Saved documents with metadata
      executeQuery(`
        SELECT COUNT(si.id) as saved_count
        FROM saved_items si
        WHERE si.user_id = ? AND si.organization_id = ? AND si.file_id IS NOT NULL
      `, [userId, organizationId]),

      // Contributions with detailed analytics
      executeQuery(`
        SELECT 
          COUNT(c.id) as contribution_count,
          COUNT(DISTINCT c.file_id) as unique_files_contributed,
          COUNT(DISTINCT DATE(c.created_at)) as active_days
        FROM contributions c
        WHERE c.user_id = ? AND c.organization_id = ?
      `, [userId, organizationId]),

      // File access analytics
      executeQuery(`
        SELECT 
          COUNT(fal.id) as total_access_events,
          COUNT(DISTINCT fal.file_id) as unique_files_accessed,
          COUNT(CASE WHEN fal.action = 'download' THEN 1 END) as download_count,
          COUNT(CASE WHEN fal.action = 'view' THEN 1 END) as view_count
        FROM file_audit_logs fal
        WHERE fal.employee_id = ? AND fal.organization_id = ?
      `, [userId, organizationId]),

      // Storage usage by type
      executeQuery(`
        SELECT 
          f.storage_provider,
          COUNT(f.id) as file_count,
          COALESCE(SUM(f.size_bytes), 0) as total_bytes
        FROM files f
        WHERE f.created_by = ? AND f.organization_id = ? AND f.is_deleted = 0
        GROUP BY f.storage_provider
      `, [userId, organizationId]),

      // Text extraction statistics
      executeQuery(`
        SELECT 
          COUNT(tej.id) as extraction_jobs,
          COUNT(CASE WHEN tej.status = 'completed' THEN 1 END) as completed_extractions,
          COUNT(CASE WHEN tej.status = 'failed' THEN 1 END) as failed_extractions,
          AVG(CASE WHEN tej.completed_at IS NOT NULL AND tej.started_at IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, tej.started_at, tej.completed_at) END) as avg_processing_time
        FROM text_extraction_jobs tej
        JOIN files f ON tej.file_id = f.id
        WHERE f.created_by = ? AND f.organization_id = ?
      `, [userId, organizationId]),

      // Department analytics (if user has department)
      executeQuery(`
        SELECT 
          d.name as department_name,
          COUNT(f.id) as dept_file_count,
          COALESCE(SUM(f.size_bytes), 0) as dept_total_size
        FROM departments d
        LEFT JOIN files f ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci AND f.organization_id = d.organization_id AND f.is_deleted = 0
        WHERE d.organization_id = ? AND EXISTS (
          SELECT 1 FROM user_departments ud 
          WHERE ud.user_id = ? AND ud.department_id = d.id AND ud.end_date IS NULL
        )
        GROUP BY d.id, d.name
      `, [organizationId, userId]),

      // Recent activity summary
      executeQuery(`
        SELECT 
          DATE(fal.created_at) as activity_date,
          COUNT(fal.id) as activity_count,
          COUNT(DISTINCT fal.file_id) as unique_files
        FROM file_audit_logs fal
        WHERE fal.employee_id = ? AND fal.organization_id = ? 
          AND fal.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(fal.created_at)
        ORDER BY activity_date DESC
        LIMIT 30
      `, [userId, organizationId])
    ])

    // Format storage usage
    const storageByType = stats[4].reduce((acc: any, row: any) => {
      acc[row.storage_provider] = {
        fileCount: row.file_count,
        totalBytes: row.total_bytes
      }
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      stats: {
        // File statistics
        totalFiles: stats[0][0]?.total_files || 0,
        totalSizeBytes: stats[0][0]?.total_size_bytes || 0,
        averageFileSize: stats[0][0]?.avg_file_size || 0,
        
        // File type breakdown
        fileTypes: {
          images: stats[0][0]?.image_count || 0,
          videos: stats[0][0]?.video_count || 0,
          audio: stats[0][0]?.audio_count || 0,
          pdfs: stats[0][0]?.pdf_count || 0,
          other: (stats[0][0]?.total_files || 0) - 
                 (stats[0][0]?.image_count || 0) - 
                 (stats[0][0]?.video_count || 0) - 
                 (stats[0][0]?.audio_count || 0) - 
                 (stats[0][0]?.pdf_count || 0)
        },

        // User activity
        savedDocuments: stats[1][0]?.saved_count || 0,
        contributions: stats[2][0]?.contribution_count || 0,
        uniqueFilesContributed: stats[2][0]?.unique_files_contributed || 0,
        activeDays: stats[2][0]?.active_days || 0,

        // Access analytics
        totalAccessEvents: stats[3][0]?.total_access_events || 0,
        uniqueFilesAccessed: stats[3][0]?.unique_files_accessed || 0,
        downloadCount: stats[3][0]?.download_count || 0,
        viewCount: stats[3][0]?.view_count || 0,

        // Storage breakdown
        storageByType,

        // Text extraction
        textExtraction: {
          totalJobs: stats[5][0]?.extraction_jobs || 0,
          completedJobs: stats[5][0]?.completed_extractions || 0,
          failedJobs: stats[5][0]?.failed_extractions || 0,
          averageProcessingTime: stats[5][0]?.avg_processing_time || 0
        },

        // Department info
        departments: stats[6],

        // Activity timeline
        recentActivity: stats[7]
      }
    })

  } catch (error) {
    console.error('Dashboard stats error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
    }, { status: 500 })
  }
}