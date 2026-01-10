import { NextRequest, NextResponse } from 'next/server'
import { createFolderService } from '@/lib/services/folder-service'
import { createFileService } from '@/lib/services/file-service'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { organizationId, type: userType } = auth.user

    // Only organization admins can view analytics
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const folderService = createFolderService()
    const fileService = createFileService()

    // Get folder statistics
    const folderStats = await folderService.getFolderStats(organizationId)

    // Get file statistics
    const fileStats = await fileService.getFileStats(organizationId)

    // Combine statistics
    const analytics = {
      folders: folderStats,
      files: fileStats,
      summary: {
        total_folders: folderStats?.overview?.total_folders || 0,
        total_files: fileStats?.overview?.total_files || 0,
        total_storage_bytes: fileStats?.overview?.total_size_bytes || 0,
        active_folders: folderStats?.overview?.active_folders || 0,
        active_files: fileStats?.overview?.active_files || 0,
        deleted_folders: folderStats?.overview?.deleted_folders || 0,
        deleted_files: fileStats?.overview?.deleted_files || 0
      }
    }

    return NextResponse.json({
      success: true,
      analytics
    })

  } catch (error) {
    console.error('Error fetching analytics:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analytics'
    }, { status: 500 })
  }
}