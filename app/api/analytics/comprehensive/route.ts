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
    const { searchParams } = new URL(request.url)
    
    const period = searchParams.get('period') || '30' // days
    const department = searchParams.get('department') || ''
    const includeDetails = searchParams.get('details') === 'true'

    // Only organization admins can see full analytics
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const periodDays = parseInt(period)
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - periodDays)

    // Build comprehensive analytics
    const analytics = await Promise.all([
      // 1. File Statistics Overview
      executeQuery(`
        SELECT 
          COUNT(f.id) as total_files,
          COUNT(CASE WHEN f.is_active = 1 AND f.is_deleted = 0 THEN 1 END) as active_files,
          COUNT(CASE WHEN f.is_deleted = 1 THEN 1 END) as deleted_files,
          COALESCE(SUM(f.size_bytes), 0) as total_size_bytes,
          COALESCE(AVG(f.size_bytes), 0) as avg_file_size,
          COUNT(DISTINCT f.created_by) as unique_contributors,
          COUNT(DISTINCT f.department) as departments_with_files,
          
          -- File type breakdown
          COUNT(CASE WHEN f.mime_type LIKE 'image/%' THEN 1 END) as image_files,
          COUNT(CASE WHEN f.mime_type LIKE 'video/%' THEN 1 END) as video_files,
          COUNT(CASE WHEN f.mime_type LIKE 'audio/%' THEN 1 END) as audio_files,
          COUNT(CASE WHEN f.mime_type = 'application/pdf' THEN 1 END) as pdf_files,
          COUNT(CASE WHEN f.mime_type LIKE 'application/vnd.ms-%' OR f.mime_type LIKE 'application/vnd.openxmlformats-%' THEN 1 END) as office_files,
          
          -- Storage breakdown
          COUNT(CASE WHEN f.storage_provider = 's3' THEN 1 END) as s3_files,
          COUNT(CASE WHEN f.storage_provider = 'local' THEN 1 END) as local_files,
          COUNT(CASE WHEN f.storage_mode = 'hybrid' THEN 1 END) as hybrid_files
        FROM files f
        WHERE f.organization_id = ?
        ${department ? 'AND f.department = ?' : ''}
      `, department ? [organizationId, department] : [organizationId]),

      // 2. User Activity Analytics
      executeQuery(`
        SELECT 
          COUNT(DISTINCT fal.employee_id) as active_users,
          COUNT(fal.id) as total_activities,
          COUNT(CASE WHEN fal.action = 'view' THEN 1 END) as total_views,
          COUNT(CASE WHEN fal.action = 'download' THEN 1 END) as total_downloads,
          COUNT(CASE WHEN fal.action = 'upload' THEN 1 END) as total_uploads,
          COUNT(CASE WHEN fal.action = 'share' THEN 1 END) as total_shares,
          COUNT(CASE WHEN fal.action = 'delete' THEN 1 END) as total_deletions,
          
          -- Time-based activity
          COUNT(CASE WHEN fal.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as activity_last_24h,
          COUNT(CASE WHEN fal.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as activity_last_7d,
          COUNT(CASE WHEN fal.created_at >= ? THEN 1 END) as activity_period
        FROM file_audit_logs fal
        JOIN files f ON fal.file_id = f.id
        WHERE fal.organization_id = ?
        ${department ? 'AND f.department = ?' : ''}
      `, department ? [dateFrom, organizationId, department] : [dateFrom, organizationId]),

      // 3. Storage Analytics
      executeQuery(`
        SELECT 
          sc.storage_type,
          sc.storage_used_bytes,
          sc.storage_quota_bytes,
          sc.max_file_size_bytes,
          COUNT(f.id) as file_count,
          COALESCE(SUM(f.size_bytes), 0) as actual_usage_bytes,
          AVG(f.size_bytes) as avg_file_size_bytes
        FROM storage_configurations sc
        LEFT JOIN files f ON f.organization_id = sc.organization_id 
          AND f.storage_provider COLLATE utf8mb4_general_ci = sc.storage_type COLLATE utf8mb4_general_ci 
          AND f.is_deleted = 0
        WHERE sc.organization_id = ?
        GROUP BY sc.id, sc.storage_type
      `, [organizationId]),

      // 4. Text Extraction Analytics
      executeQuery(`
        SELECT 
          tej.extraction_method,
          tej.status,
          COUNT(tej.id) as job_count,
          AVG(CASE WHEN tej.completed_at IS NOT NULL AND tej.started_at IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, tej.started_at, tej.completed_at) END) as avg_processing_time,
          COUNT(CASE WHEN tej.created_at >= ? THEN 1 END) as recent_jobs,
          
          -- Success rates
          COUNT(CASE WHEN tej.status = 'completed' THEN 1 END) as successful_jobs,
          COUNT(CASE WHEN tej.status = 'failed' THEN 1 END) as failed_jobs,
          
          -- Text statistics
          AVG(etc.word_count) as avg_extracted_words,
          AVG(etc.confidence_score) as avg_confidence
        FROM text_extraction_jobs tej
        LEFT JOIN extracted_text_content etc ON tej.file_id = etc.file_id AND etc.content_type = 'full_text'
        JOIN files f ON tej.file_id = f.id
        WHERE tej.organization_id = ?
        ${department ? 'AND f.department = ?' : ''}
        GROUP BY tej.extraction_method, tej.status
      `, department ? [dateFrom, organizationId, department] : [dateFrom, organizationId]),

      // 5. Search and Indexing Analytics
      executeQuery(`
        SELECT 
          sis.index_status,
          COUNT(sis.id) as file_count,
          COUNT(CASE WHEN sis.indexed_at >= ? THEN 1 END) as recently_indexed,
          AVG(CASE WHEN sis.indexed_at IS NOT NULL AND f.created_at IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, f.created_at, sis.indexed_at) END) as avg_indexing_delay
        FROM search_index_status sis
        JOIN files f ON sis.file_id = f.id
        WHERE sis.organization_id = ?
        ${department ? 'AND f.department = ?' : ''}
        GROUP BY sis.index_status
      `, department ? [dateFrom, organizationId, department] : [dateFrom, organizationId]),

      // 6. Department Analytics
      executeQuery(`
        SELECT 
          d.name as department_name,
          d.description as department_description,
          COUNT(f.id) as file_count,
          COALESCE(SUM(f.size_bytes), 0) as total_size_bytes,
          COUNT(DISTINCT f.created_by) as unique_contributors,
          COUNT(CASE WHEN f.created_at >= ? THEN 1 END) as recent_files,
          
          -- Activity by department
          COUNT(CASE WHEN fal.action = 'view' THEN 1 END) as total_views,
          COUNT(CASE WHEN fal.action = 'download' THEN 1 END) as total_downloads,
          
          -- User count in department
          (SELECT COUNT(*) FROM user_departments ud WHERE ud.department_id = d.id AND ud.end_date IS NULL) as user_count
        FROM departments d
        LEFT JOIN files f ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci AND f.organization_id = d.organization_id AND f.is_deleted = 0
        LEFT JOIN file_audit_logs fal ON fal.file_id = f.id AND fal.created_at >= ?
        WHERE d.organization_id = ?
        ${department ? 'AND d.name = ?' : ''}
        GROUP BY d.id, d.name, d.description
        ORDER BY file_count DESC
      `, department ? [dateFrom, dateFrom, organizationId, department] : [dateFrom, dateFrom, organizationId]),

      // 7. Top Contributors
      executeQuery(`
        SELECT 
          oe.id,
          oe.full_name,
          oe.email,
          d.name as department_name,
          COUNT(f.id) as files_contributed,
          COALESCE(SUM(f.size_bytes), 0) as total_bytes_contributed,
          COUNT(CASE WHEN f.created_at >= ? THEN 1 END) as recent_contributions,
          
          -- Activity stats
          COUNT(CASE WHEN fal.action = 'view' THEN 1 END) as files_viewed,
          COUNT(CASE WHEN fal.action = 'download' THEN 1 END) as files_downloaded,
          MAX(f.created_at) as last_contribution,
          MAX(fal.created_at) as last_activity
        FROM organization_employees oe
        LEFT JOIN user_departments ud ON oe.id = ud.user_id AND ud.end_date IS NULL
        LEFT JOIN departments d ON ud.department_id = d.id
        LEFT JOIN files f ON oe.id = f.created_by AND f.is_deleted = 0
        LEFT JOIN file_audit_logs fal ON oe.id = fal.employee_id AND fal.created_at >= ?
        WHERE oe.organization_id = ?
        ${department ? 'AND d.name = ?' : ''}
        GROUP BY oe.id, oe.full_name, oe.email, d.name
        HAVING files_contributed > 0
        ORDER BY files_contributed DESC
        LIMIT 20
      `, department ? [dateFrom, dateFrom, organizationId, department] : [dateFrom, dateFrom, organizationId]),

      // 8. File Access Patterns
      executeQuery(`
        SELECT 
          DATE(fal.created_at) as access_date,
          HOUR(fal.created_at) as access_hour,
          fal.action,
          COUNT(fal.id) as activity_count,
          COUNT(DISTINCT fal.employee_id) as unique_users,
          COUNT(DISTINCT fal.file_id) as unique_files
        FROM file_audit_logs fal
        JOIN files f ON fal.file_id = f.id
        WHERE fal.organization_id = ? 
          AND fal.created_at >= ?
        ${department ? 'AND f.department = ?' : ''}
        GROUP BY DATE(fal.created_at), HOUR(fal.created_at), fal.action
        ORDER BY access_date DESC, access_hour DESC
      `, department ? [organizationId, dateFrom, department] : [organizationId, dateFrom])
    ])

    // Format comprehensive analytics response
    const result = {
      success: true,
      period: {
        days: periodDays,
        from: dateFrom.toISOString(),
        to: new Date().toISOString()
      },
      department: department || 'All Departments',
      
      // File statistics
      files: {
        total: analytics[0][0]?.total_files || 0,
        active: analytics[0][0]?.active_files || 0,
        deleted: analytics[0][0]?.deleted_files || 0,
        totalSizeBytes: analytics[0][0]?.total_size_bytes || 0,
        totalSize: formatFileSize(analytics[0][0]?.total_size_bytes || 0),
        averageSize: formatFileSize(analytics[0][0]?.avg_file_size || 0),
        uniqueContributors: analytics[0][0]?.unique_contributors || 0,
        departmentsWithFiles: analytics[0][0]?.departments_with_files || 0,
        
        typeBreakdown: {
          images: analytics[0][0]?.image_files || 0,
          videos: analytics[0][0]?.video_files || 0,
          audio: analytics[0][0]?.audio_files || 0,
          pdfs: analytics[0][0]?.pdf_files || 0,
          office: analytics[0][0]?.office_files || 0
        },
        
        storageBreakdown: {
          s3: analytics[0][0]?.s3_files || 0,
          local: analytics[0][0]?.local_files || 0,
          hybrid: analytics[0][0]?.hybrid_files || 0
        }
      },
      
      // User activity
      activity: {
        activeUsers: analytics[1][0]?.active_users || 0,
        totalActivities: analytics[1][0]?.total_activities || 0,
        views: analytics[1][0]?.total_views || 0,
        downloads: analytics[1][0]?.total_downloads || 0,
        uploads: analytics[1][0]?.total_uploads || 0,
        shares: analytics[1][0]?.total_shares || 0,
        deletions: analytics[1][0]?.total_deletions || 0,
        
        timeBreakdown: {
          last24Hours: analytics[1][0]?.activity_last_24h || 0,
          last7Days: analytics[1][0]?.activity_last_7d || 0,
          currentPeriod: analytics[1][0]?.activity_period || 0
        }
      },
      
      // Storage analytics
      storage: analytics[2].map(storage => ({
        type: storage.storage_type,
        usedBytes: storage.actual_usage_bytes || 0,
        used: formatFileSize(storage.actual_usage_bytes || 0),
        quotaBytes: storage.storage_quota_bytes,
        quota: storage.storage_quota_bytes ? formatFileSize(storage.storage_quota_bytes) : 'Unlimited',
        utilization: storage.storage_quota_bytes ? 
          ((storage.actual_usage_bytes || 0) / storage.storage_quota_bytes * 100).toFixed(1) + '%' : 'N/A',
        fileCount: storage.file_count || 0,
        averageFileSize: formatFileSize(storage.avg_file_size_bytes || 0),
        maxFileSize: formatFileSize(storage.max_file_size_bytes || 0)
      })),
      
      // Text extraction analytics
      textExtraction: analytics[3].reduce((acc, job) => {
        const method = job.extraction_method
        if (!acc[method]) {
          acc[method] = {
            total: 0,
            successful: 0,
            failed: 0,
            pending: 0,
            processing: 0,
            averageProcessingTime: 0,
            recentJobs: 0,
            averageWords: 0,
            averageConfidence: 0
          }
        }
        
        acc[method].total += job.job_count || 0
        acc[method].recentJobs += job.recent_jobs || 0
        acc[method].averageProcessingTime = job.avg_processing_time || 0
        acc[method].averageWords = job.avg_extracted_words || 0
        acc[method].averageConfidence = job.avg_confidence || 0
        
        if (job.status === 'completed') acc[method].successful += job.job_count || 0
        if (job.status === 'failed') acc[method].failed += job.job_count || 0
        if (job.status === 'pending') acc[method].pending += job.job_count || 0
        if (job.status === 'processing') acc[method].processing += job.job_count || 0
        
        return acc
      }, {}),
      
      // Search indexing
      searchIndexing: analytics[4].reduce((acc, index) => {
        acc[index.index_status] = {
          count: index.file_count || 0,
          recentlyIndexed: index.recently_indexed || 0,
          averageDelay: index.avg_indexing_delay || 0
        }
        return acc
      }, {}),
      
      // Department breakdown
      departments: analytics[5].map(dept => ({
        name: dept.department_name,
        description: dept.department_description,
        fileCount: dept.file_count || 0,
        totalSize: formatFileSize(dept.total_size_bytes || 0),
        totalSizeBytes: dept.total_size_bytes || 0,
        contributors: dept.unique_contributors || 0,
        recentFiles: dept.recent_files || 0,
        views: dept.total_views || 0,
        downloads: dept.total_downloads || 0,
        userCount: dept.user_count || 0
      })),
      
      // Top contributors
      topContributors: analytics[6].map(contributor => ({
        id: contributor.id,
        name: contributor.full_name,
        email: contributor.email,
        department: contributor.department_name,
        filesContributed: contributor.files_contributed || 0,
        totalSize: formatFileSize(contributor.total_bytes_contributed || 0),
        totalSizeBytes: contributor.total_bytes_contributed || 0,
        recentContributions: contributor.recent_contributions || 0,
        filesViewed: contributor.files_viewed || 0,
        filesDownloaded: contributor.files_downloaded || 0,
        lastContribution: contributor.last_contribution,
        lastActivity: contributor.last_activity
      }))
    }

    // Add detailed access patterns if requested
    if (includeDetails) {
      result.accessPatterns = {
        daily: {},
        hourly: {},
        byAction: {}
      }
      
      analytics[7].forEach(pattern => {
        const date = pattern.access_date
        const hour = pattern.access_hour
        const action = pattern.action
        
        // Daily patterns
        if (!result.accessPatterns.daily[date]) {
          result.accessPatterns.daily[date] = {
            totalActivity: 0,
            uniqueUsers: 0,
            uniqueFiles: 0,
            actions: {}
          }
        }
        result.accessPatterns.daily[date].totalActivity += pattern.activity_count
        result.accessPatterns.daily[date].uniqueUsers = Math.max(
          result.accessPatterns.daily[date].uniqueUsers, 
          pattern.unique_users
        )
        result.accessPatterns.daily[date].uniqueFiles = Math.max(
          result.accessPatterns.daily[date].uniqueFiles, 
          pattern.unique_files
        )
        result.accessPatterns.daily[date].actions[action] = 
          (result.accessPatterns.daily[date].actions[action] || 0) + pattern.activity_count
        
        // Hourly patterns
        if (!result.accessPatterns.hourly[hour]) {
          result.accessPatterns.hourly[hour] = 0
        }
        result.accessPatterns.hourly[hour] += pattern.activity_count
        
        // By action patterns
        if (!result.accessPatterns.byAction[action]) {
          result.accessPatterns.byAction[action] = 0
        }
        result.accessPatterns.byAction[action] += pattern.activity_count
      })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Comprehensive analytics error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analytics'
    }, { status: 500 })
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}