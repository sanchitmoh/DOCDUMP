import { NextRequest, NextResponse } from 'next/server'
import { createHybridStorageService } from '@/lib/services/hybrid-storage'
import { verifyToken } from '@/lib/auth'
import { executeSingle } from '@/lib/database'

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

    // Only organization admins can view storage config
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const storageService = createHybridStorageService()
    const config = await storageService.getStorageConfig(organizationId)

    if (!config) {
      return NextResponse.json({ error: 'Storage configuration not found' }, { status: 404 })
    }

    // Remove sensitive information from response
    const safeConfig = {
      ...config,
      s3_access_key_id: config.s3_access_key_id ? '***' + config.s3_access_key_id.slice(-4) : null,
      s3_secret_access_key: config.s3_secret_access_key ? '***' : null
    }

    return NextResponse.json({
      success: true,
      config: safeConfig
    })

  } catch (error) {
    console.error('Error fetching storage config:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch config'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    // Only organization admins can update storage config
    if (userType !== 'organization') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const {
      storage_type,
      s3_bucket_name,
      s3_region,
      s3_access_key_id,
      s3_secret_access_key,
      s3_endpoint_url,
      s3_use_path_style,
      s3_encryption_type,
      s3_kms_key_id,
      local_storage_path,
      local_backup_enabled,
      local_backup_path,
      hybrid_primary_storage,
      hybrid_sync_enabled,
      hybrid_sync_interval_minutes,
      max_file_size_bytes,
      allowed_mime_types,
      storage_quota_bytes,
      auto_delete_after_days,
      transition_to_glacier_days,
      transition_to_deep_archive_days
    } = body

    // Validate required fields based on storage type
    if (storage_type === 's3' || (storage_type === 'hybrid' && hybrid_primary_storage === 's3')) {
      if (!s3_bucket_name || !s3_region) {
        return NextResponse.json({ 
          error: 'S3 bucket name and region are required for S3 storage' 
        }, { status: 400 })
      }
    }

    if (storage_type === 'local' || (storage_type === 'hybrid' && hybrid_primary_storage === 'local')) {
      if (!local_storage_path) {
        return NextResponse.json({ 
          error: 'Local storage path is required for local storage' 
        }, { status: 400 })
      }
    }

    // Build update query dynamically
    const updateFields = []
    const updateValues = []

    const fieldsToUpdate = {
      storage_type,
      s3_bucket_name,
      s3_region,
      s3_access_key_id,
      s3_secret_access_key,
      s3_endpoint_url,
      s3_use_path_style,
      s3_encryption_type,
      s3_kms_key_id,
      local_storage_path,
      local_backup_enabled,
      local_backup_path,
      hybrid_primary_storage,
      hybrid_sync_enabled,
      hybrid_sync_interval_minutes,
      max_file_size_bytes,
      storage_quota_bytes,
      auto_delete_after_days,
      transition_to_glacier_days,
      transition_to_deep_archive_days
    }

    Object.entries(fieldsToUpdate).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`)
        updateValues.push(value)
      }
    })

    if (allowed_mime_types !== undefined) {
      updateFields.push('allowed_mime_types = ?')
      updateValues.push(Array.isArray(allowed_mime_types) ? JSON.stringify(allowed_mime_types) : allowed_mime_types)
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updateValues.push(organizationId)

    await executeSingle(`
      UPDATE storage_configurations 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ?
    `, updateValues)

    // Get updated configuration
    const storageService = createHybridStorageService()
    const updatedConfig = await storageService.getStorageConfig(organizationId)

    // Remove sensitive information from response
    const safeConfig = {
      ...updatedConfig,
      s3_access_key_id: updatedConfig?.s3_access_key_id ? '***' + updatedConfig.s3_access_key_id.slice(-4) : null,
      s3_secret_access_key: updatedConfig?.s3_secret_access_key ? '***' : null
    }

    return NextResponse.json({
      success: true,
      message: 'Storage configuration updated successfully',
      config: safeConfig
    })

  } catch (error) {
    console.error('Error updating storage config:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config'
    }, { status: 500 })
  }
}