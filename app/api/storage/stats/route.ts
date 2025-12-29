import { NextRequest, NextResponse } from 'next/server'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { verifyToken } from '@/lib/auth'
import { executeQuery } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { organizationId, userType } = decoded

    // Only organization admins can view storage stats
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const storageService = createHybridStorageService()
    
    // Get comprehensive storage statistics
    const stats = await storageService.getStorageStats(organizationId)

    // Get file type distribution
    const fileTypeStats = await executeQuery(`
      SELECT 
        file_type,
        COUNT(*) as file_count,
        SUM(size_bytes) as total_size_bytes,
        AVG(size_bytes) as avg_size_bytes
      FROM files 
      WHERE organization_id = ? AND is_deleted = 0
      GROUP BY file_type
      ORDER BY total_size_bytes DESC
    `, [organizationId])

    // Get storage location distribution
    const locationStats = await executeQuery(`
      SELECT 
        fsl.storage_type,
        fsl.is_primary,
        fsl.is_backup,
        COUNT(*) as file_count,
        SUM(fsl.size_bytes) as total_size_bytes
      FROM file_storage_locations fsl
      JOIN files f ON fsl.file_id = f.id
      WHERE f.organization_id = ? AND f.is_deleted = 0
      GROUP BY fsl.storage_type, fsl.is_primary, fsl.is_backup
    `, [organizationId])

    // Get recent activity
    const recentActivity = await executeQuery(`
      SELECT 
        operation_type,
        storage_type,
        COUNT(*) as operation_count,
        SUM(bytes_transferred) as total_bytes,
        DATE(created_at) as activity_date
      FROM storage_operations_log 
      WHERE organization_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY operation_type, storage_type, DATE(created_at)
      ORDER BY activity_date DESC
      LIMIT 100
    `, [organizationId])

    // Get top folders by size
    const topFolders = await executeQuery(`
      SELECT 
        fo.id,
        fo.name,
        COUNT(f.id) as file_count,
        SUM(f.size_bytes) as total_size_bytes,
        AVG(f.size_bytes) as avg_file_size
      FROM folders fo
      LEFT JOIN files f ON fo.id = f.folder_id AND f.is_deleted = 0
      WHERE fo.organization_id = ? AND fo.is_deleted = 0
      GROUP BY fo.id, fo.name
      HAVING file_count > 0
      ORDER BY total_size_bytes DESC
      LIMIT 10
    `, [organizationId])

    // Get sync job statistics
    const syncStats = await executeQuery(`
      SELECT 
        sync_type,
        status,
        COUNT(*) as job_count,
        AVG(progress_percent) as avg_progress,
        AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_duration_seconds
      FROM storage_sync_jobs 
      WHERE organization_id = ?
      GROUP BY sync_type, status
    `, [organizationId])

    // Calculate health score
    const healthCheck = await storageService.healthCheck(organizationId)
    
    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        file_type_distribution: fileTypeStats,
        storage_location_distribution: locationStats,
        recent_activity: recentActivity,
        top_folders: topFolders,
        sync_statistics: syncStats,
        health_check: healthCheck
      }
    })

  } catch (error) {
    console.error('Error fetching storage stats:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch storage stats'
    }, { status: 500 })
  }
}