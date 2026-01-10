import { executeQuery, executeSingle } from '@/lib/database'
import { createS3Service } from '@/lib/storage/s3'
import { createLocalStorageService } from '@/lib/storage/local'
import { getRedisInstance } from '@/lib/cache/redis'
import * as fs from 'fs/promises'
import * as path from 'path'
import crypto from 'crypto'

export interface StorageConfiguration {
  id: number
  organization_id: number
  storage_type: 's3' | 'local' | 'hybrid'
  is_active: boolean
  s3_bucket_name?: string
  s3_region?: string
  s3_access_key_id?: string
  s3_secret_access_key?: string
  s3_endpoint_url?: string
  s3_use_path_style: boolean
  s3_encryption_type: 'none' | 'AES256' | 'aws:kms'
  s3_kms_key_id?: string
  local_storage_path?: string
  local_backup_enabled: boolean
  local_backup_path?: string
  hybrid_primary_storage: 's3' | 'local'
  hybrid_sync_enabled: boolean
  hybrid_sync_interval_minutes: number
  max_file_size_bytes: number
  allowed_mime_types?: string[]
  storage_quota_bytes?: number
  storage_used_bytes: number
  auto_delete_after_days?: number
  transition_to_glacier_days?: number
  transition_to_deep_archive_days?: number
  created_at: Date
  updated_at: Date
}

export interface FileStorageLocation {
  id: number
  file_id: number
  storage_type: 's3' | 'local' | 's3_compatible' | 'cdn'
  storage_provider?: string
  location_path: string
  is_primary: boolean
  is_backup: boolean
  is_archived: boolean
  storage_class?: string
  checksum_sha256?: string
  size_bytes?: number
  metadata?: any
  created_at: Date
  updated_at: Date
}

export interface StorageSyncJob {
  id: number
  organization_id: number
  file_id?: number
  sync_type: 'full' | 'incremental' | 'file'
  source_storage: 's3' | 'local'
  target_storage: 's3' | 'local'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress_percent: number
  files_processed: number
  files_total?: number
  error_message?: string
  started_at?: Date
  completed_at?: Date
  triggered_by?: number
  created_at: Date
  updated_at: Date
}

export interface StorageOperationLog {
  id: number
  organization_id: number
  file_id?: number
  operation_type: 'upload' | 'download' | 'delete' | 'copy' | 'move' | 'sync' | 'restore'
  storage_type: 's3' | 'local' | 'hybrid'
  source_location?: string
  target_location?: string
  status: 'success' | 'failed' | 'partial'
  bytes_transferred?: number
  duration_ms?: number
  error_message?: string
  employee_id?: number
  metadata?: any
  created_at: Date
}

export class HybridStorageService {
  private redis = getRedisInstance()
  private s3Service = createS3Service()
  private localService = createLocalStorageService()

  /**
   * Get storage configuration for organization
   */
  async getStorageConfig(organizationId: number): Promise<StorageConfiguration | null> {
    try {
      const configs = await executeQuery(`
        SELECT * FROM storage_configurations 
        WHERE organization_id = ? AND is_active = 1
        LIMIT 1
      `, [organizationId])

      if (configs.length === 0) {
        console.log(`No storage configuration found for organization ${organizationId}, creating default...`)
        // Create default configuration
        return await this.createDefaultStorageConfig(organizationId)
      }

      const config = configs[0]
      if (config.allowed_mime_types) {
        try {
          // Handle both string and already parsed array
          if (typeof config.allowed_mime_types === 'string') {
            config.allowed_mime_types = JSON.parse(config.allowed_mime_types)
          }
        } catch (jsonError) {
          console.warn('Invalid JSON in allowed_mime_types, using default:', jsonError)
          config.allowed_mime_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/tiff',
            'video/mp4',
            'video/avi',
            'video/quicktime',
            'video/x-msvideo',
            'audio/mpeg',
            'audio/wav',
            'audio/mp3',
            'application/zip',
            'application/x-zip-compressed'
          ]
        }
      } else {
        // Set default if null/undefined
        config.allowed_mime_types = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/bmp',
          'image/tiff',
          'video/mp4',
          'video/avi',
          'video/quicktime',
          'video/x-msvideo',
          'audio/mpeg',
          'audio/wav',
          'audio/mp3',
          'application/zip',
          'application/x-zip-compressed'
        ]
      }

      return config
    } catch (error) {
      console.error('Error getting storage config:', error)
      // Try to create default configuration as fallback
      try {
        console.log('Attempting to create default storage configuration as fallback...')
        return await this.createDefaultStorageConfig(organizationId)
      } catch (createError) {
        console.error('Failed to create default storage configuration:', createError)
        return null
      }
    }
  }

  /**
   * Create default storage configuration
   */
  async createDefaultStorageConfig(organizationId: number): Promise<StorageConfiguration> {
    try {
      const defaultConfig = {
        organization_id: organizationId,
        storage_type: process.env.STORAGE_MODE || 'hybrid',
        is_active: true,
        s3_bucket_name: process.env.AWS_S3_BUCKET,
        s3_region: process.env.AWS_REGION,
        s3_access_key_id: process.env.AWS_ACCESS_KEY_ID,
        s3_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
        s3_use_path_style: false,
        s3_encryption_type: 'AES256',
        local_storage_path: process.env.LOCAL_STORAGE_PATH || './storage/files',
        local_backup_enabled: true,
        local_backup_path: './storage/backup',
        hybrid_primary_storage: 's3',
        hybrid_sync_enabled: true,
        hybrid_sync_interval_minutes: 60,
        max_file_size_bytes: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
        allowed_mime_types: JSON.stringify([
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/bmp',
          'image/tiff',
          'video/mp4',
          'video/avi',
          'video/quicktime',
          'video/x-msvideo',
          'audio/mpeg',
          'audio/wav',
          'audio/mp3',
          'application/zip',
          'application/x-zip-compressed'
        ]),
        storage_quota_bytes: 10737418240, // 10GB default
        storage_used_bytes: 0
      }

      const result = await executeSingle(`
        INSERT INTO storage_configurations (
          organization_id, storage_type, is_active, s3_bucket_name, s3_region,
          s3_access_key_id, s3_secret_access_key, s3_use_path_style, s3_encryption_type,
          local_storage_path, local_backup_enabled, local_backup_path,
          hybrid_primary_storage, hybrid_sync_enabled, hybrid_sync_interval_minutes,
          max_file_size_bytes, allowed_mime_types, storage_quota_bytes, storage_used_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        defaultConfig.organization_id,
        defaultConfig.storage_type,
        defaultConfig.is_active,
        defaultConfig.s3_bucket_name,
        defaultConfig.s3_region,
        defaultConfig.s3_access_key_id,
        defaultConfig.s3_secret_access_key,
        defaultConfig.s3_use_path_style,
        defaultConfig.s3_encryption_type,
        defaultConfig.local_storage_path,
        defaultConfig.local_backup_enabled,
        defaultConfig.local_backup_path,
        defaultConfig.hybrid_primary_storage,
        defaultConfig.hybrid_sync_enabled,
        defaultConfig.hybrid_sync_interval_minutes,
        defaultConfig.max_file_size_bytes,
        defaultConfig.allowed_mime_types,
        defaultConfig.storage_quota_bytes,
        defaultConfig.storage_used_bytes
      ])

      return {
        id: result.insertId,
        ...defaultConfig,
        allowed_mime_types: JSON.parse(defaultConfig.allowed_mime_types),
        created_at: new Date(),
        updated_at: new Date()
      } as StorageConfiguration
    } catch (error) {
      console.error('Error creating default storage config:', error)
      throw error
    }
  }

  /**
   * Store file with hybrid storage strategy
   */
  async storeFile(
    organizationId: number,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: number,
    metadata: any = {}
  ): Promise<{
    fileId: number
    primaryLocation: FileStorageLocation
    backupLocation?: FileStorageLocation
    checksum: string
  }> {
    const startTime = Date.now()
    let fileId: number | null = null

    try {
      const config = await this.getStorageConfig(organizationId)
      if (!config) {
        throw new Error('Storage configuration not found')
      }

      // Validate file size
      if (fileBuffer.length > config.max_file_size_bytes) {
        throw new Error(`File size exceeds limit of ${config.max_file_size_bytes} bytes`)
      }

      // Validate MIME type
      if (config.allowed_mime_types && !config.allowed_mime_types.includes(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`)
      }

      // Generate checksum
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')
      const storageKey = `${organizationId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${fileName}`

      // Create file record first
      const fileResult = await executeSingle(`
        INSERT INTO files (
          organization_id, folder_id, name, mime_type, size_bytes, storage_key, 
          checksum_sha256, storage_mode, storage_provider, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        organizationId,
        folderId,
        fileName,
        mimeType,
        fileBuffer.length,
        storageKey,
        checksum,
        config.storage_type,
        config.storage_type === 'hybrid' ? config.hybrid_primary_storage : config.storage_type
      ])

      fileId = fileResult.insertId

      let primaryLocation: FileStorageLocation
      let backupLocation: FileStorageLocation | undefined

      // Store based on configuration
      switch (config.storage_type) {
        case 'local':
          primaryLocation = await this.storeLocal(fileId, fileBuffer, storageKey, checksum)
          break

        case 's3':
          primaryLocation = await this.storeS3(fileId, fileBuffer, storageKey, checksum, config, mimeType)
          break

        case 'hybrid':
          if (config.hybrid_primary_storage === 's3') {
            // Primary: S3, Backup: Local
            try {
              primaryLocation = await this.storeS3(fileId, fileBuffer, storageKey, checksum, config, mimeType)
              backupLocation = await this.storeLocal(fileId, fileBuffer, storageKey, checksum, false)
            } catch (s3Error) {
              console.warn('S3 storage failed, falling back to local storage as primary:', s3Error)
              // Fall back to local storage as primary
              primaryLocation = await this.storeLocal(fileId, fileBuffer, storageKey, checksum, true)
            }
          } else {
            // Primary: Local, Backup: S3
            primaryLocation = await this.storeLocal(fileId, fileBuffer, storageKey, checksum)
            try {
              backupLocation = await this.storeS3(fileId, fileBuffer, storageKey, checksum, config, mimeType, false)
            } catch (s3Error) {
              console.warn('S3 backup storage failed, continuing with local only:', s3Error)
              // Continue without S3 backup
            }
          }
          break

        default:
          throw new Error(`Unsupported storage type: ${config.storage_type}`)
      }

      // Update storage usage
      await this.updateStorageUsage(organizationId, fileBuffer.length)

      // Log operation
      await this.logStorageOperation({
        organization_id: organizationId,
        file_id: fileId,
        operation_type: 'upload',
        storage_type: config.storage_type,
        target_location: storageKey,
        status: 'success',
        bytes_transferred: fileBuffer.length,
        duration_ms: Date.now() - startTime,
        metadata: {
          primary_storage: primaryLocation.storage_type,
          backup_storage: backupLocation?.storage_type,
          checksum,
          mime_type: mimeType
        }
      })

      return {
        fileId,
        primaryLocation,
        backupLocation,
        checksum
      }

    } catch (error) {
      console.error('Error storing file:', error)

      // Log failed operation
      if (fileId) {
        await this.logStorageOperation({
          organization_id: organizationId,
          file_id: fileId,
          operation_type: 'upload',
          storage_type: 'hybrid',
          status: 'failed',
          duration_ms: Date.now() - startTime,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      throw error
    }
  }

  /**
   * Store file in S3
   */
  private async storeS3(
    fileId: number,
    fileBuffer: Buffer,
    storageKey: string,
    checksum: string,
    config: StorageConfiguration,
    mimeType: string,
    isPrimary: boolean = true
  ): Promise<FileStorageLocation> {
    try {
      const s3Result = await this.s3Service.uploadFile(
        fileBuffer,
        storageKey,
        mimeType,
        {
          checksum,
          fileId: fileId.toString()
        }
      )

      const locationResult = await executeSingle(`
        INSERT INTO file_storage_locations (
          file_id, storage_type, storage_provider, location_path,
          is_primary, is_backup, checksum_sha256, size_bytes,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        fileId,
        's3',
        'aws',
        s3Result.key,
        isPrimary,
        !isPrimary,
        checksum,
        fileBuffer.length,
        JSON.stringify({
          bucket: s3Result.bucket,
          etag: s3Result.etag,
          location: s3Result.location
        })
      ])

      return {
        id: locationResult.insertId,
        file_id: fileId,
        storage_type: 's3',
        storage_provider: 'aws',
        location_path: s3Result.key,
        is_primary: isPrimary,
        is_backup: !isPrimary,
        is_archived: false,
        checksum_sha256: checksum,
        size_bytes: fileBuffer.length,
        metadata: {
          bucket: s3Result.bucket,
          etag: s3Result.etag,
          location: s3Result.location
        },
        created_at: new Date(),
        updated_at: new Date()
      }
    } catch (error) {
      console.error('Error storing file in S3:', error)
      throw error
    }
  }

  /**
   * Store file locally
   */
  private async storeLocal(
    fileId: number,
    fileBuffer: Buffer,
    storageKey: string,
    checksum: string,
    isPrimary: boolean = true
  ): Promise<FileStorageLocation> {
    try {
      const localResult = await this.localService.uploadFile(
        fileBuffer,
        storageKey,
        {
          metadata: {
            checksum,
            fileId: fileId.toString()
          }
        }
      )

      const locationResult = await executeSingle(`
        INSERT INTO file_storage_locations (
          file_id, storage_type, storage_provider, location_path,
          is_primary, is_backup, checksum_sha256, size_bytes,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        fileId,
        'local',
        'filesystem',
        localResult.path,
        isPrimary,
        !isPrimary,
        checksum,
        fileBuffer.length,
        JSON.stringify({
          full_path: localResult.fullPath,
          directory: path.dirname(localResult.path)
        })
      ])

      return {
        id: locationResult.insertId,
        file_id: fileId,
        storage_type: 'local',
        storage_provider: 'filesystem',
        location_path: localResult.path,
        is_primary: isPrimary,
        is_backup: !isPrimary,
        is_archived: false,
        checksum_sha256: checksum,
        size_bytes: fileBuffer.length,
        metadata: {
          full_path: localResult.fullPath,
          directory: path.dirname(localResult.path)
        },
        created_at: new Date(),
        updated_at: new Date()
      }
    } catch (error) {
      console.error('Error storing file locally:', error)
      throw error
    }
  }

  /**
   * Retrieve file from hybrid storage
   */
  async retrieveFile(
    fileId: number,
    organizationId: number,
    preferredStorage?: 's3' | 'local'
  ): Promise<{
    buffer: Buffer
    metadata: any
    source: 'primary' | 'backup'
    storageType: string
  }> {
    const startTime = Date.now()

    try {
      // Get file storage locations
      const locations = await executeQuery(`
        SELECT * FROM file_storage_locations 
        WHERE file_id = ? 
        ORDER BY is_primary DESC, created_at ASC
      `, [fileId])

      console.log('Storage locations found:', locations.length, locations.map(l => ({
        id: l.id,
        storage_type: l.storage_type,
        is_primary: l.is_primary,
        location_path: l.location_path
      })))

      if (locations.length === 0) {
        throw new Error('File storage locations not found')
      }

      // Try preferred storage first if specified
      if (preferredStorage) {
        const preferredLocation = locations.find(loc => 
          loc.storage_type === preferredStorage
        )
        if (preferredLocation) {
          try {
            const result = await this.retrieveFromLocation(preferredLocation)
            await this.logStorageOperation({
              organization_id: organizationId,
              file_id: fileId,
              operation_type: 'download',
              storage_type: preferredLocation.storage_type,
              source_location: preferredLocation.location_path,
              status: 'success',
              bytes_transferred: result.buffer.length,
              duration_ms: Date.now() - startTime
            })
            return {
              ...result,
              source: preferredLocation.is_primary ? 'primary' : 'backup',
              storageType: preferredLocation.storage_type
            }
          } catch (error) {
            console.warn(`Failed to retrieve from preferred storage ${preferredStorage}:`, error)
          }
        }
      }

      // Try primary location first, then backups
      for (const location of locations) {
        try {
          const result = await this.retrieveFromLocation(location)
          await this.logStorageOperation({
            organization_id: organizationId,
            file_id: fileId,
            operation_type: 'download',
            storage_type: location.storage_type,
            source_location: location.location_path,
            status: 'success',
            bytes_transferred: result.buffer.length,
            duration_ms: Date.now() - startTime
          })
          return {
            ...result,
            source: location.is_primary ? 'primary' : 'backup',
            storageType: location.storage_type
          }
        } catch (error) {
          console.warn(`Failed to retrieve from ${location.storage_type}:`, error)
          continue
        }
      }

      throw new Error('File could not be retrieved from any storage location')

    } catch (error) {
      console.error('Error retrieving file:', error)
      
      await this.logStorageOperation({
        organization_id: organizationId,
        file_id: fileId,
        operation_type: 'download',
        storage_type: 'hybrid',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * Retrieve file from specific location
   */
  private async retrieveFromLocation(location: FileStorageLocation): Promise<{
    buffer: Buffer
    metadata: any
  }> {
    console.log('Retrieving from location:', {
      storage_type: location.storage_type,
      location_path: location.location_path,
      is_primary: location.is_primary
    })

    switch (location.storage_type) {
      case 's3':
        console.log('Attempting S3 download...')
        const s3Buffer = await this.s3Service.downloadFile(location.location_path)
        console.log('S3 download result:', {
          hasBuffer: !!s3Buffer,
          bufferLength: s3Buffer?.length,
          isBuffer: Buffer.isBuffer(s3Buffer)
        })
        return {
          buffer: s3Buffer,
          metadata: {} // S3 service doesn't return metadata in downloadFile
        }

      case 'local':
        console.log('Attempting local download...')
        const localResult = await this.localService.downloadFile(location.location_path)
        console.log('Local download result:', {
          hasBuffer: !!localResult?.buffer,
          bufferLength: localResult?.buffer?.length,
          hasMetadata: !!localResult?.metadata
        })
        return {
          buffer: localResult.buffer,
          metadata: localResult.metadata
        }

      default:
        throw new Error(`Unsupported storage type: ${location.storage_type}`)
    }
  }

  /**
   * Sync files between storage locations
   */
  async syncStorage(
    organizationId: number,
    syncType: 'full' | 'incremental' | 'file' = 'incremental',
    fileId?: number,
    triggeredBy?: number
  ): Promise<number> {
    try {
      const config = await this.getStorageConfig(organizationId)
      if (!config || !config.hybrid_sync_enabled) {
        throw new Error('Sync not enabled for organization')
      }

      // Create sync job
      const jobResult = await executeSingle(`
        INSERT INTO storage_sync_jobs (
          organization_id, file_id, sync_type, source_storage, target_storage,
          status, triggered_by
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `, [
        organizationId,
        fileId || null,
        syncType,
        config.hybrid_primary_storage,
        config.hybrid_primary_storage === 's3' ? 'local' : 's3',
        triggeredBy || null
      ])

      const jobId = jobResult.insertId

      // Add to Redis queue for processing
      await this.redis.addJob('storage-sync', {
        jobId,
        organizationId,
        fileId,
        syncType,
        sourceStorage: config.hybrid_primary_storage,
        targetStorage: config.hybrid_primary_storage === 's3' ? 'local' : 's3'
      }, 5) // Medium priority

      return jobId
    } catch (error) {
      console.error('Error creating sync job:', error)
      throw error
    }
  }

  /**
   * Process storage sync job
   */
  async processSyncJob(jobId: number): Promise<void> {
    try {
      // Get job details
      const jobs = await executeQuery(`
        SELECT * FROM storage_sync_jobs WHERE id = ?
      `, [jobId])

      if (jobs.length === 0) {
        throw new Error('Sync job not found')
      }

      const job = jobs[0]

      // Update status to running
      await executeSingle(`
        UPDATE storage_sync_jobs 
        SET status = 'running', started_at = NOW()
        WHERE id = ?
      `, [jobId])

      let filesToSync: any[] = []

      if (job.sync_type === 'file' && job.file_id) {
        // Sync specific file
        filesToSync = await executeQuery(`
          SELECT f.*, fsl.* FROM files f
          LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id
          WHERE f.id = ? AND f.organization_id = ?
        `, [job.file_id, job.organization_id])
      } else {
        // Sync all files for organization
        filesToSync = await executeQuery(`
          SELECT f.*, fsl.* FROM files f
          LEFT JOIN file_storage_locations fsl ON f.id = fsl.file_id AND fsl.is_primary = 1
          WHERE f.organization_id = ? AND f.is_deleted = 0
          ${job.sync_type === 'incremental' ? 'AND f.updated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)' : ''}
        `, [job.organization_id])
      }

      const totalFiles = filesToSync.length
      let processedFiles = 0

      // Update total files count
      await executeSingle(`
        UPDATE storage_sync_jobs 
        SET files_total = ?
        WHERE id = ?
      `, [totalFiles, jobId])

      for (const file of filesToSync) {
        try {
          await this.syncSingleFile(file, job.source_storage, job.target_storage)
          processedFiles++

          // Update progress
          const progressPercent = Math.round((processedFiles / totalFiles) * 100)
          await executeSingle(`
            UPDATE storage_sync_jobs 
            SET files_processed = ?, progress_percent = ?
            WHERE id = ?
          `, [processedFiles, progressPercent, jobId])

        } catch (error) {
          console.error(`Error syncing file ${file.id}:`, error)
          // Continue with other files
        }
      }

      // Mark job as completed
      await executeSingle(`
        UPDATE storage_sync_jobs 
        SET status = 'completed', completed_at = NOW(), progress_percent = 100
        WHERE id = ?
      `, [jobId])

    } catch (error) {
      console.error('Error processing sync job:', error)
      
      // Mark job as failed
      await executeSingle(`
        UPDATE storage_sync_jobs 
        SET status = 'failed', completed_at = NOW(), error_message = ?
        WHERE id = ?
      `, [error instanceof Error ? error.message : 'Unknown error', jobId])
    }
  }

  /**
   * Sync single file between storage locations
   */
  private async syncSingleFile(
    file: any,
    sourceStorage: string,
    targetStorage: string
  ): Promise<void> {
    try {
      // Get file from source storage
      const { buffer } = await this.retrieveFile(file.id, file.organization_id, sourceStorage as any)

      // Store in target storage
      if (targetStorage === 's3') {
        const config = await this.getStorageConfig(file.organization_id)
        if (config) {
          await this.storeS3(file.id, buffer, file.storage_key, file.checksum_sha256, config, file.mime_type || 'application/octet-stream', false)
        }
      } else if (targetStorage === 'local') {
        await this.storeLocal(file.id, buffer, file.storage_key, file.checksum_sha256, false)
      }

    } catch (error) {
      console.error(`Error syncing file ${file.id}:`, error)
      throw error
    }
  }

  /**
   * Update storage usage statistics
   */
  async updateStorageUsage(organizationId: number, bytesAdded: number): Promise<void> {
    try {
      await executeSingle(`
        UPDATE storage_configurations 
        SET storage_used_bytes = storage_used_bytes + ?
        WHERE organization_id = ?
      `, [bytesAdded, organizationId])

      // Update daily statistics
      const today = new Date().toISOString().split('T')[0]
      
      await executeSingle(`
        INSERT INTO storage_usage_stats (
          organization_id, storage_type, total_bytes, file_count, calculated_date
        ) VALUES (?, 'total', ?, 1, ?)
        ON DUPLICATE KEY UPDATE
          total_bytes = total_bytes + VALUES(total_bytes),
          file_count = file_count + VALUES(file_count),
          last_calculated_at = CURRENT_TIMESTAMP
      `, [organizationId, bytesAdded, today])

    } catch (error) {
      console.error('Error updating storage usage:', error)
    }
  }

  /**
   * Log storage operation
   */
  async logStorageOperation(operation: Partial<StorageOperationLog>): Promise<void> {
    try {
      await executeSingle(`
        INSERT INTO storage_operations_log (
          organization_id, file_id, operation_type, storage_type,
          source_location, target_location, status, bytes_transferred,
          duration_ms, error_message, employee_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        operation.organization_id,
        operation.file_id || null,
        operation.operation_type,
        operation.storage_type,
        operation.source_location || null,
        operation.target_location || null,
        operation.status,
        operation.bytes_transferred || null,
        operation.duration_ms || null,
        operation.error_message || null,
        operation.employee_id || null,
        operation.metadata ? JSON.stringify(operation.metadata) : null
      ])
    } catch (error) {
      console.error('Error logging storage operation:', error)
    }
  }

  /**
   * Get storage statistics for organization
   */
  async getStorageStats(organizationId: number): Promise<any> {
    try {
      const config = await this.getStorageConfig(organizationId)
      const usageStats = await executeQuery(`
        SELECT 
          storage_type,
          SUM(total_bytes) as total_bytes,
          SUM(file_count) as file_count
        FROM storage_usage_stats 
        WHERE organization_id = ? 
        GROUP BY storage_type
      `, [organizationId])

      const recentOperations = await executeQuery(`
        SELECT 
          operation_type,
          storage_type,
          COUNT(*) as operation_count,
          SUM(bytes_transferred) as total_bytes_transferred,
          AVG(duration_ms) as avg_duration_ms
        FROM storage_operations_log 
        WHERE organization_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY operation_type, storage_type
      `, [organizationId])

      return {
        configuration: config,
        usage_stats: usageStats,
        recent_operations: recentOperations,
        quota_usage_percent: config ? 
          Math.round((config.storage_used_bytes / (config.storage_quota_bytes || 1)) * 100) : 0
      }
    } catch (error) {
      console.error('Error getting storage stats:', error)
      return null
    }
  }

  /**
   * Health check for hybrid storage
   */
  async healthCheck(organizationId: number): Promise<{
    status: 'healthy' | 'unhealthy'
    message: string
    details: any
  }> {
    try {
      const config = await this.getStorageConfig(organizationId)
      if (!config) {
        return {
          status: 'unhealthy',
          message: 'Storage configuration not found',
          details: {}
        }
      }

      const checks: any = {}

      // Check S3 if configured
      if (config.storage_type === 's3' || config.storage_type === 'hybrid') {
        try {
          const s3Health = await this.s3Service.healthCheck()
          checks.s3 = s3Health
        } catch (error) {
          checks.s3 = {
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'S3 check failed'
          }
        }
      }

      // Check local storage if configured
      if (config.storage_type === 'local' || config.storage_type === 'hybrid') {
        try {
          const localHealth = await this.localService.healthCheck()
          checks.local = localHealth
        } catch (error) {
          checks.local = {
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Local storage check failed'
          }
        }
      }

      const allHealthy = Object.values(checks).every((check: any) => 
        check.status === 'healthy'
      )

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        message: allHealthy ? 'All storage systems operational' : 'Some storage systems have issues',
        details: {
          configuration: config.storage_type,
          checks
        }
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        details: {}
      }
    }
  }
}

// Factory function
export function createHybridStorageService(): HybridStorageService {
  return new HybridStorageService()
}