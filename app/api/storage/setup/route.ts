import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    // Only organization admins can set up storage
    if (auth.user.type !== 'organization') {
      return NextResponse.json({ error: 'Only organization admins can set up storage' }, { status: 403 })
    }

    const { organizationId } = auth.user
    const storageService = createHybridStorageService()

    // Try to get existing configuration
    let config = await storageService.getStorageConfig(organizationId)
    
    if (!config) {
      // Force create default configuration
      console.log(`Creating default storage configuration for organization ${organizationId}`)
      config = await storageService.createDefaultStorageConfig(organizationId)
    }

    return NextResponse.json({
      success: true,
      message: 'Storage configuration created successfully',
      config: {
        id: config.id,
        storage_type: config.storage_type,
        is_active: config.is_active,
        max_file_size_bytes: config.max_file_size_bytes,
        storage_quota_bytes: config.storage_quota_bytes,
        storage_used_bytes: config.storage_used_bytes
      }
    })

  } catch (error) {
    console.error('Error setting up storage:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to set up storage configuration' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { organizationId } = auth.user
    const storageService = createHybridStorageService()

    // Get storage configuration
    const config = await storageService.getStorageConfig(organizationId)

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'No storage configuration found',
        needsSetup: true
      })
    }

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        storage_type: config.storage_type,
        is_active: config.is_active,
        max_file_size_bytes: config.max_file_size_bytes,
        storage_quota_bytes: config.storage_quota_bytes,
        storage_used_bytes: config.storage_used_bytes,
        allowed_mime_types: config.allowed_mime_types
      }
    })

  } catch (error) {
    console.error('Error getting storage config:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get storage configuration' 
      },
      { status: 500 }
    )
  }
}