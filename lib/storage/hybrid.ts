import { S3StorageService, UploadResult as S3UploadResult } from './s3'
import { LocalStorageService, LocalUploadResult } from './local'
import { executeQuery, executeSingle } from '../database'
import crypto from 'crypto'

export type StorageMode = 'local' | 's3' | 'hybrid'
export type StorageProvider = 's3' | 'local' | 's3_compatible'

export interface FileMetadata {
  fileId: string
  organizationId: string
  fileName: string
  mimeType: string
  size: number
  checksum?: string
  department?: string
  createdBy?: number
}

export interface StorageResult {
  fileId: string
  locations: StorageLocation[]
  primaryLocation: StorageLocation
  size: number
  checksum: string
}

export interface StorageLocation {
  type: StorageProvider
  path: string
  isPrimary: boolean
  isBackup: boolean
  size: number
  checksum: string
  createdAt: Date
}

export interface SyncJob {
  id: string
  organizationId: string
  fileId?: string
  syncType: 'full' | 'incremental' | 'file'
  sourceStorage: 'local' | 's3'
  targetStorage: 'local' | 's3'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startedAt?: Date
  completedAt?: Date
  errorMessage?: string
}

export class HybridStorageManager {
  private s3Service: S3StorageService
  private localService: LocalStorageService
  private storageMode: StorageMode

  constructor(
    s3Service: S3StorageService,
    localService: LocalStorageService,
    storageMode: StorageMode = 'hybrid'
  ) {
    this.s3Service = s3Service
    this.localService = localService
    this.storageMode = storageMode
  }

  /**
   * Upload file with hybrid storage strategy
   */
  async uploadFile(buffer: Buffer, metadata: FileMetadata): Promise<StorageResult> {
    const { fileId, organizationId, fileName, mimeType, size, createdBy } = metadata
    
    try {
      // Generate checksum for integrity
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
      
      const locations: StorageLocation[] = []
      let primaryLocation: StorageLocation

      // Determine storage strategy based on mode
      switch (this.storageMode) {
        case 'local':
          primaryLocation = await this.uploadToLocal(buffer, organizationId, fileName, fileId)
          locations.push(primaryLocation)
          break

        case 's3':
          primaryLocation = await this.uploadToS3(buffer, organizationId, fileName, fileId, mimeType)
          locations.push(primaryLocation)
          break

        case 'hybrid':
        default:
          // Upload to both local and S3 for redundancy
          const [localLocation, s3Location] = await Promise.allSettled([
            this.uploadToLocal(buffer, organizationId, fileName, fileId),
            this.uploadToS3(buffer, organizationId, fileName, fileId, mimeType)
          ])

          // Determine primary based on success
          if (s3Location.status === 'fulfilled') {
            primaryLocation = s3Location.value
            primaryLocation.isPrimary = true
            locations.push(primaryLocation)
          }

          if (localLocation.status === 'fulfilled') {
            const localLoc = localLocation.value
            if (!primaryLocation!) {
              primaryLocation = localLoc
              primaryLocation.isPrimary = true
            } else {
              localLoc.isBackup = true
            }
            locations.push(localLoc)
          }

          if (!primaryLocation!) {
            throw new Error('Failed to upload to any storage location')
          }
          break
      }

      // Store file metadata in database
      await this.storeFileMetadata(fileId, organizationId, {
        fileName,
        mimeType,
        size,
        checksum,
        createdBy,
        storageMode: this.storageMode,
        primaryLocation,
      })

      // Store storage locations in database
      for (const location of locations) {
        await this.storeStorageLocation(fileId, location)
      }

      // Log storage operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'upload',
        storageType: this.storageMode,
        status: 'success',
        bytesTransferred: size,
        employeeId: createdBy,
      })

      return {
        fileId,
        locations,
        primaryLocation: primaryLocation!,
        size,
        checksum,
      }
    } catch (error) {
      console.error('Hybrid upload error:', error)
      
      // Log failed operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'upload',
        storageType: this.storageMode,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        employeeId: createdBy,
      })

      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Download file with fallback strategy
   */
  async downloadFile(fileId: string, organizationId: string): Promise<Buffer> {
    try {
      // Get storage locations for file
      const locations = await this.getStorageLocations(fileId)
      
      if (locations.length === 0) {
        throw new Error('No storage locations found for file')
      }

      // Try primary location first
      const primaryLocation = locations.find(loc => loc.isPrimary)
      if (primaryLocation) {
        try {
          const buffer = await this.downloadFromLocation(primaryLocation)
          
          // Log successful download
          await this.logStorageOperation({
            organizationId,
            fileId,
            operationType: 'download',
            storageType: this.storageMode,
            status: 'success',
            bytesTransferred: buffer.length,
          })

          return buffer
        } catch (error) {
          console.warn(`Failed to download from primary location: ${error}`)
        }
      }

      // Try backup locations
      for (const location of locations.filter(loc => !loc.isPrimary)) {
        try {
          const buffer = await this.downloadFromLocation(location)
          
          // Log successful download from backup
          await this.logStorageOperation({
            organizationId,
            fileId,
            operationType: 'download',
            storageType: this.storageMode,
            status: 'success',
            bytesTransferred: buffer.length,
          })

          return buffer
        } catch (error) {
          console.warn(`Failed to download from backup location: ${error}`)
        }
      }

      throw new Error('Failed to download file from any location')
    } catch (error) {
      console.error('Hybrid download error:', error)
      
      // Log failed operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'download',
        storageType: this.storageMode,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete file from all storage locations
   */
  async deleteFile(fileId: string, organizationId: string): Promise<void> {
    try {
      const locations = await this.getStorageLocations(fileId)
      
      // Delete from all locations
      const deletePromises = locations.map(async (location) => {
        try {
          if (location.type === 's3') {
            await this.s3Service.deleteFile(location.path)
          } else if (location.type === 'local') {
            await this.localService.deleteFile(location.path)
          }
        } catch (error) {
          console.warn(`Failed to delete from ${location.type}: ${error}`)
        }
      })

      await Promise.allSettled(deletePromises)

      // Remove storage locations from database
      await executeSingle(
        'DELETE FROM file_storage_locations WHERE file_id = ?',
        [fileId]
      )

      // Update file status to deleted
      await executeSingle(
        'UPDATE files SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [fileId]
      )

      // Log deletion
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'delete',
        storageType: this.storageMode,
        status: 'success',
      })
    } catch (error) {
      console.error('Hybrid delete error:', error)
      
      // Log failed operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'delete',
        storageType: this.storageMode,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sync file to remote storage (S3)
   */
  async syncToRemote(fileId: string, organizationId: string): Promise<void> {
    try {
      const locations = await this.getStorageLocations(fileId)
      const localLocation = locations.find(loc => loc.type === 'local')
      const s3Location = locations.find(loc => loc.type === 's3')

      if (!localLocation) {
        throw new Error('No local copy found for sync')
      }

      if (s3Location) {
        console.log('File already exists in S3, skipping sync')
        return
      }

      // Download from local storage
      const buffer = await this.localService.readFile(localLocation.path)
      
      // Get file metadata
      const fileMetadata = await this.getFileMetadata(fileId)
      
      // Upload to S3
      const s3Key = this.s3Service.generateFileKey(organizationId, fileMetadata.name, fileId)
      await this.s3Service.uploadFile(buffer, s3Key, fileMetadata.mime_type || 'application/octet-stream')

      // Store new S3 location
      const newS3Location: StorageLocation = {
        type: 's3',
        path: s3Key,
        isPrimary: true, // Make S3 primary for hybrid mode
        isBackup: false,
        size: buffer.length,
        checksum: localLocation.checksum,
        createdAt: new Date(),
      }

      await this.storeStorageLocation(fileId, newS3Location)

      // Update local location to backup
      await executeSingle(
        'UPDATE file_storage_locations SET is_primary = 0, is_backup = 1 WHERE file_id = ? AND storage_type = ?',
        [fileId, 'local']
      )

      // Log sync operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'sync',
        storageType: 'hybrid',
        status: 'success',
        bytesTransferred: buffer.length,
        sourceLocation: localLocation.path,
        targetLocation: s3Key,
      })
    } catch (error) {
      console.error('Sync to remote error:', error)
      
      // Log failed operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'sync',
        storageType: 'hybrid',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Error(`Failed to sync to remote: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sync file to local storage
   */
  async syncToLocal(fileId: string, organizationId: string): Promise<void> {
    try {
      const locations = await this.getStorageLocations(fileId)
      const s3Location = locations.find(loc => loc.type === 's3')
      const localLocation = locations.find(loc => loc.type === 'local')

      if (!s3Location) {
        throw new Error('No S3 copy found for sync')
      }

      if (localLocation) {
        console.log('File already exists locally, skipping sync')
        return
      }

      // Download from S3
      const buffer = await this.s3Service.downloadFile(s3Location.path)
      
      // Get file metadata
      const fileMetadata = await this.getFileMetadata(fileId)
      
      // Save to local storage
      const localPath = this.localService.generateFilePath(organizationId, fileMetadata.name, fileId)
      const result = await this.localService.saveFile(buffer, localPath)

      // Store new local location
      const newLocalLocation: StorageLocation = {
        type: 'local',
        path: result.relativePath,
        isPrimary: false,
        isBackup: true,
        size: result.size,
        checksum: result.checksum,
        createdAt: new Date(),
      }

      await this.storeStorageLocation(fileId, newLocalLocation)

      // Log sync operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'sync',
        storageType: 'hybrid',
        status: 'success',
        bytesTransferred: buffer.length,
        sourceLocation: s3Location.path,
        targetLocation: result.relativePath,
      })
    } catch (error) {
      console.error('Sync to local error:', error)
      
      // Log failed operation
      await this.logStorageOperation({
        organizationId,
        fileId,
        operationType: 'sync',
        storageType: 'hybrid',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Error(`Failed to sync to local: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create sync job for batch operations
   */
  async createSyncJob(
    organizationId: string,
    syncType: 'full' | 'incremental' | 'file',
    sourceStorage: 'local' | 's3',
    targetStorage: 'local' | 's3',
    fileId?: string,
    triggeredBy?: number
  ): Promise<string> {
    try {
      const result = await executeSingle(
        `INSERT INTO storage_sync_jobs 
         (organization_id, file_id, sync_type, source_storage, target_storage, triggered_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [organizationId, fileId || null, syncType, sourceStorage, targetStorage, triggeredBy || null]
      )

      return result.insertId.toString()
    } catch (error) {
      console.error('Create sync job error:', error)
      throw new Error(`Failed to create sync job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process sync job
   */
  async processSyncJob(jobId: string): Promise<void> {
    try {
      // Get job details
      const jobs = await executeQuery<{
        id: string
        organization_id: string
        file_id?: string
        sync_type: string
        source_storage: string
        target_storage: string
        status: string
      }>('SELECT * FROM storage_sync_jobs WHERE id = ? AND status = ?', [jobId, 'pending'])

      if (jobs.length === 0) {
        throw new Error('Sync job not found or not pending')
      }

      const job = jobs[0]

      // Update job status to running
      await executeSingle(
        'UPDATE storage_sync_jobs SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['running', jobId]
      )

      if (job.file_id) {
        // Single file sync
        if (job.source_storage === 'local' && job.target_storage === 's3') {
          await this.syncToRemote(job.file_id, job.organization_id)
        } else if (job.source_storage === 's3' && job.target_storage === 'local') {
          await this.syncToLocal(job.file_id, job.organization_id)
        }
      } else {
        // Organization-wide sync
        await this.syncOrganizationFiles(job.organization_id, job.source_storage as 'local' | 's3', job.target_storage as 'local' | 's3')
      }

      // Update job status to completed
      await executeSingle(
        'UPDATE storage_sync_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP, progress_percent = 100 WHERE id = ?',
        ['completed', jobId]
      )
    } catch (error) {
      console.error('Process sync job error:', error)
      
      // Update job status to failed
      await executeSingle(
        'UPDATE storage_sync_jobs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['failed', error instanceof Error ? error.message : 'Unknown error', jobId]
      )

      throw error
    }
  }

  /**
   * Get storage statistics for organization
   */
  async getStorageStats(organizationId: string): Promise<{
    totalFiles: number
    totalSize: number
    localFiles: number
    localSize: number
    s3Files: number
    s3Size: number
    lastUpdated: Date
  }> {
    try {
      const stats = await executeQuery<{
        storage_type: string
        file_count: number
        total_size: number
      }>(`
        SELECT 
          fsl.storage_type,
          COUNT(*) as file_count,
          SUM(fsl.size_bytes) as total_size
        FROM file_storage_locations fsl
        JOIN files f ON fsl.file_id = f.id
        WHERE f.organization_id = ? AND f.is_deleted = 0
        GROUP BY fsl.storage_type
      `, [organizationId])

      let totalFiles = 0, totalSize = 0, localFiles = 0, localSize = 0, s3Files = 0, s3Size = 0

      for (const stat of stats) {
        totalFiles += stat.file_count
        totalSize += stat.total_size

        if (stat.storage_type === 'local') {
          localFiles = stat.file_count
          localSize = stat.total_size
        } else if (stat.storage_type === 's3') {
          s3Files = stat.file_count
          s3Size = stat.total_size
        }
      }

      return {
        totalFiles,
        totalSize,
        localFiles,
        localSize,
        s3Files,
        s3Size,
        lastUpdated: new Date(),
      }
    } catch (error) {
      console.error('Storage stats error:', error)
      throw new Error(`Failed to get storage statistics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Private helper methods

  private async uploadToLocal(buffer: Buffer, organizationId: string, fileName: string, fileId: string): Promise<StorageLocation> {
    const localPath = this.localService.generateFilePath(organizationId, fileName, fileId)
    const result = await this.localService.saveFile(buffer, localPath)

    return {
      type: 'local',
      path: result.relativePath,
      isPrimary: true,
      isBackup: false,
      size: result.size,
      checksum: result.checksum,
      createdAt: new Date(),
    }
  }

  private async uploadToS3(buffer: Buffer, organizationId: string, fileName: string, fileId: string, mimeType: string): Promise<StorageLocation> {
    const s3Key = this.s3Service.generateFileKey(organizationId, fileName, fileId)
    const result = await this.s3Service.uploadFile(buffer, s3Key, mimeType)

    return {
      type: 's3',
      path: result.key,
      isPrimary: true,
      isBackup: false,
      size: result.size,
      checksum: result.checksum,
      createdAt: new Date(),
    }
  }

  private async downloadFromLocation(location: StorageLocation): Promise<Buffer> {
    if (location.type === 's3') {
      return await this.s3Service.downloadFile(location.path)
    } else if (location.type === 'local') {
      return await this.localService.readFile(location.path, location.checksum)
    } else {
      throw new Error(`Unsupported storage type: ${location.type}`)
    }
  }

  private async storeFileMetadata(fileId: string, organizationId: string, metadata: any): Promise<void> {
    // This would typically update the files table with storage information
    await executeSingle(
      `UPDATE files SET 
       storage_mode = ?, 
       storage_provider = ?,
       checksum_sha256 = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [metadata.storageMode, metadata.primaryLocation.type, metadata.checksum, fileId]
    )
  }

  private async storeStorageLocation(fileId: string, location: StorageLocation): Promise<void> {
    await executeSingle(
      `INSERT INTO file_storage_locations 
       (file_id, storage_type, location_path, is_primary, is_backup, size_bytes, checksum_sha256, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [fileId, location.type, location.path, location.isPrimary ? 1 : 0, location.isBackup ? 1 : 0, location.size, location.checksum]
    )
  }

  private async getStorageLocations(fileId: string): Promise<StorageLocation[]> {
    const locations = await executeQuery<{
      storage_type: string
      location_path: string
      is_primary: number
      is_backup: number
      size_bytes: number
      checksum_sha256: string
      created_at: Date
    }>('SELECT * FROM file_storage_locations WHERE file_id = ?', [fileId])

    return locations.map(loc => ({
      type: loc.storage_type as StorageProvider,
      path: loc.location_path,
      isPrimary: loc.is_primary === 1,
      isBackup: loc.is_backup === 1,
      size: loc.size_bytes,
      checksum: loc.checksum_sha256,
      createdAt: loc.created_at,
    }))
  }

  private async getFileMetadata(fileId: string): Promise<{ name: string; mime_type: string }> {
    const files = await executeQuery<{ name: string; mime_type: string }>(
      'SELECT name, mime_type FROM files WHERE id = ?',
      [fileId]
    )

    if (files.length === 0) {
      throw new Error('File metadata not found')
    }

    return files[0]
  }

  private async logStorageOperation(operation: {
    organizationId: string
    fileId?: string
    operationType: string
    storageType: string
    status: string
    bytesTransferred?: number
    errorMessage?: string
    employeeId?: number
    sourceLocation?: string
    targetLocation?: string
  }): Promise<void> {
    try {
      await executeSingle(
        `INSERT INTO storage_operations_log 
         (organization_id, file_id, operation_type, storage_type, status, bytes_transferred, error_message, employee_id, source_location, target_location, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          operation.organizationId,
          operation.fileId || null,
          operation.operationType,
          operation.storageType,
          operation.status,
          operation.bytesTransferred || null,
          operation.errorMessage || null,
          operation.employeeId || null,
          operation.sourceLocation || null,
          operation.targetLocation || null,
        ]
      )
    } catch (error) {
      console.error('Failed to log storage operation:', error)
      // Don't throw error for logging failures
    }
  }

  private async syncOrganizationFiles(organizationId: string, sourceStorage: 'local' | 's3', targetStorage: 'local' | 's3'): Promise<void> {
    // Get all files for organization that exist in source but not in target
    const query = `
      SELECT DISTINCT f.id, f.organization_id
      FROM files f
      JOIN file_storage_locations fsl_source ON f.id = fsl_source.file_id
      LEFT JOIN file_storage_locations fsl_target ON f.id = fsl_target.file_id AND fsl_target.storage_type = ?
      WHERE f.organization_id = ? 
        AND f.is_deleted = 0 
        AND fsl_source.storage_type = ?
        AND fsl_target.file_id IS NULL
    `

    const filesToSync = await executeQuery<{ id: string; organization_id: string }>(
      query,
      [targetStorage, organizationId, sourceStorage]
    )

    for (const file of filesToSync) {
      try {
        if (sourceStorage === 'local' && targetStorage === 's3') {
          await this.syncToRemote(file.id, file.organization_id)
        } else if (sourceStorage === 's3' && targetStorage === 'local') {
          await this.syncToLocal(file.id, file.organization_id)
        }
      } catch (error) {
        console.error(`Failed to sync file ${file.id}:`, error)
        // Continue with other files
      }
    }
  }
}

// Factory function to create hybrid storage manager
export function createHybridStorageManager(): HybridStorageManager {
  const s3Service = new S3StorageService({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
    bucket: process.env.AWS_S3_BUCKET!,
  })

  const localService = new LocalStorageService({
    basePath: process.env.LOCAL_STORAGE_PATH || './storage/files',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'),
    allowedExtensions: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,jpeg,png,gif').split(','),
  })

  const storageMode = (process.env.STORAGE_MODE as StorageMode) || 'hybrid'

  return new HybridStorageManager(s3Service, localService, storageMode)
}