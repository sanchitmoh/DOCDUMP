import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

export interface LocalStorageConfig {
  basePath: string
  maxFileSize: number
  allowedExtensions: string[]
}

export interface LocalUploadResult {
  path: string
  size: number
  checksum: string
  relativePath: string
}

export class LocalStorageService {
  private basePath: string
  private maxFileSize: number
  private allowedExtensions: Set<string>

  constructor(config: LocalStorageConfig) {
    this.basePath = path.resolve(config.basePath)
    this.maxFileSize = config.maxFileSize
    this.allowedExtensions = new Set(config.allowedExtensions.map(ext => ext.toLowerCase()))
  }

  /**
   * Initialize storage directory structure
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true })
      
      // Create subdirectories for organization
      const subdirs = ['temp', 'organizations', 'thumbnails', 'cache']
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(this.basePath, subdir), { recursive: true })
      }

      console.log(`Local storage initialized at: ${this.basePath}`)
    } catch (error) {
      console.error('Failed to initialize local storage:', error)
      throw new Error(`Local storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Save file to local storage with security checks
   */
  async saveFile(
    buffer: Buffer,
    relativePath: string,
    options: {
      validateExtension?: boolean
      generateChecksum?: boolean
      createDirectories?: boolean
    } = {}
  ): Promise<LocalUploadResult> {
    const {
      validateExtension = true,
      generateChecksum = true,
      createDirectories = true
    } = options

    try {
      // Security: Validate file size
      if (buffer.length > this.maxFileSize) {
        throw new Error(`File size ${buffer.length} exceeds maximum allowed size ${this.maxFileSize}`)
      }

      // Security: Validate file extension
      if (validateExtension) {
        const ext = path.extname(relativePath).toLowerCase().slice(1)
        if (!this.allowedExtensions.has(ext)) {
          throw new Error(`File extension '${ext}' is not allowed`)
        }
      }

      // Security: Sanitize path to prevent directory traversal
      const sanitizedPath = this.sanitizePath(relativePath)
      const fullPath = path.join(this.basePath, sanitizedPath)

      // Security: Ensure path is within base directory
      if (!fullPath.startsWith(this.basePath)) {
        throw new Error('Invalid file path - potential directory traversal attack')
      }

      // Create directories if needed
      if (createDirectories) {
        const dir = path.dirname(fullPath)
        await fs.mkdir(dir, { recursive: true })
      }

      // Generate checksum for integrity
      let checksum = ''
      if (generateChecksum) {
        checksum = crypto.createHash('sha256').update(buffer).digest('hex')
      }

      // Write file atomically using temporary file
      const tempPath = `${fullPath}.tmp`
      await fs.writeFile(tempPath, buffer)
      await fs.rename(tempPath, fullPath)

      // Set secure file permissions (readable by owner only)
      await fs.chmod(fullPath, 0o600)

      const stats = await fs.stat(fullPath)

      return {
        path: fullPath,
        size: stats.size,
        checksum,
        relativePath: sanitizedPath,
      }
    } catch (error) {
      console.error('Local storage save error:', error)
      throw new Error(`Failed to save file locally: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Read file from local storage with integrity verification
   */
  async readFile(relativePath: string, verifyChecksum?: string): Promise<Buffer> {
    try {
      const sanitizedPath = this.sanitizePath(relativePath)
      const fullPath = path.join(this.basePath, sanitizedPath)

      // Security: Ensure path is within base directory
      if (!fullPath.startsWith(this.basePath)) {
        throw new Error('Invalid file path - potential directory traversal attack')
      }

      // Check if file exists
      try {
        await fs.access(fullPath)
      } catch {
        throw new Error(`File not found: ${relativePath}`)
      }

      const buffer = await fs.readFile(fullPath)

      // Verify integrity if checksum provided
      if (verifyChecksum) {
        const calculatedChecksum = crypto.createHash('sha256').update(buffer).digest('hex')
        if (calculatedChecksum !== verifyChecksum) {
          throw new Error('File integrity check failed - checksum mismatch')
        }
      }

      return buffer
    } catch (error) {
      console.error('Local storage read error:', error)
      throw new Error(`Failed to read file locally: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete file from local storage
   */
  async deleteFile(relativePath: string): Promise<void> {
    try {
      const sanitizedPath = this.sanitizePath(relativePath)
      const fullPath = path.join(this.basePath, sanitizedPath)

      // Security: Ensure path is within base directory
      if (!fullPath.startsWith(this.basePath)) {
        throw new Error('Invalid file path - potential directory traversal attack')
      }

      await fs.unlink(fullPath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, consider it already deleted
        return
      }
      console.error('Local storage delete error:', error)
      throw new Error(`Failed to delete file locally: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Move file within local storage
   */
  async moveFile(sourceRelativePath: string, targetRelativePath: string): Promise<void> {
    try {
      const sanitizedSourcePath = this.sanitizePath(sourceRelativePath)
      const sanitizedTargetPath = this.sanitizePath(targetRelativePath)
      
      const sourcePath = path.join(this.basePath, sanitizedSourcePath)
      const targetPath = path.join(this.basePath, sanitizedTargetPath)

      // Security: Ensure paths are within base directory
      if (!sourcePath.startsWith(this.basePath) || !targetPath.startsWith(this.basePath)) {
        throw new Error('Invalid file path - potential directory traversal attack')
      }

      // Create target directory if needed
      const targetDir = path.dirname(targetPath)
      await fs.mkdir(targetDir, { recursive: true })

      await fs.rename(sourcePath, targetPath)
    } catch (error) {
      console.error('Local storage move error:', error)
      throw new Error(`Failed to move file locally: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Copy file within local storage
   */
  async copyFile(sourceRelativePath: string, targetRelativePath: string): Promise<void> {
    try {
      const sanitizedSourcePath = this.sanitizePath(sourceRelativePath)
      const sanitizedTargetPath = this.sanitizePath(targetRelativePath)
      
      const sourcePath = path.join(this.basePath, sanitizedSourcePath)
      const targetPath = path.join(this.basePath, sanitizedTargetPath)

      // Security: Ensure paths are within base directory
      if (!sourcePath.startsWith(this.basePath) || !targetPath.startsWith(this.basePath)) {
        throw new Error('Invalid file path - potential directory traversal attack')
      }

      // Create target directory if needed
      const targetDir = path.dirname(targetPath)
      await fs.mkdir(targetDir, { recursive: true })

      // Use streams for efficient copying of large files
      const sourceStream = createReadStream(sourcePath)
      const targetStream = createWriteStream(targetPath)
      
      await pipeline(sourceStream, targetStream)

      // Set secure file permissions
      await fs.chmod(targetPath, 0o600)
    } catch (error) {
      console.error('Local storage copy error:', error)
      throw new Error(`Failed to copy file locally: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if file exists in local storage
   */
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const sanitizedPath = this.sanitizePath(relativePath)
      const fullPath = path.join(this.basePath, sanitizedPath)

      // Security: Ensure path is within base directory
      if (!fullPath.startsWith(this.basePath)) {
        return false
      }

      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file metadata from local storage
   */
  async getFileMetadata(relativePath: string): Promise<{
    size: number
    lastModified: Date
    created: Date
    isFile: boolean
    permissions: string
  }> {
    try {
      const sanitizedPath = this.sanitizePath(relativePath)
      const fullPath = path.join(this.basePath, sanitizedPath)

      // Security: Ensure path is within base directory
      if (!fullPath.startsWith(this.basePath)) {
        throw new Error('Invalid file path - potential directory traversal attack')
      }

      const stats = await fs.stat(fullPath)

      return {
        size: stats.size,
        lastModified: stats.mtime,
        created: stats.birthtime,
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8),
      }
    } catch (error) {
      console.error('Local storage metadata error:', error)
      throw new Error(`Failed to get file metadata locally: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List files in local storage directory
   */
  async listFiles(
    relativePath: string = '',
    options: {
      recursive?: boolean
      includeDirectories?: boolean
      maxDepth?: number
    } = {}
  ): Promise<Array<{
    name: string
    path: string
    size: number
    lastModified: Date
    isDirectory: boolean
  }>> {
    const { recursive = false, includeDirectories = false, maxDepth = 10 } = options

    try {
      const sanitizedPath = this.sanitizePath(relativePath)
      const fullPath = path.join(this.basePath, sanitizedPath)

      // Security: Ensure path is within base directory
      if (!fullPath.startsWith(this.basePath)) {
        throw new Error('Invalid directory path - potential directory traversal attack')
      }

      const files: Array<{
        name: string
        path: string
        size: number
        lastModified: Date
        isDirectory: boolean
      }> = []

      const scanDirectory = async (dirPath: string, currentDepth: number = 0) => {
        if (currentDepth > maxDepth) return

        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name)
          const relativePath = path.relative(this.basePath, entryPath)
          
          if (entry.isDirectory()) {
            if (includeDirectories) {
              const stats = await fs.stat(entryPath)
              files.push({
                name: entry.name,
                path: relativePath,
                size: 0,
                lastModified: stats.mtime,
                isDirectory: true,
              })
            }

            if (recursive) {
              await scanDirectory(entryPath, currentDepth + 1)
            }
          } else if (entry.isFile()) {
            const stats = await fs.stat(entryPath)
            files.push({
              name: entry.name,
              path: relativePath,
              size: stats.size,
              lastModified: stats.mtime,
              isDirectory: false,
            })
          }
        }
      }

      await scanDirectory(fullPath)
      return files
    } catch (error) {
      console.error('Local storage list error:', error)
      throw new Error(`Failed to list files locally: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate unique file path for storage
   */
  generateFilePath(organizationId: string, fileName: string, fileId?: string): string {
    const timestamp = new Date().toISOString().split('T')[0]
    const randomId = fileId || crypto.randomUUID()
    const sanitizedFileName = this.sanitizeFileName(fileName)
    
    return path.join('organizations', organizationId, timestamp, randomId, sanitizedFileName)
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(organizationId?: string): Promise<{
    totalFiles: number
    totalSize: number
    lastUpdated: Date
  }> {
    try {
      const basePath = organizationId 
        ? path.join(this.basePath, 'organizations', organizationId)
        : this.basePath

      let totalFiles = 0
      let totalSize = 0

      const files = await this.listFiles(
        organizationId ? `organizations/${organizationId}` : '',
        { recursive: true }
      )

      for (const file of files) {
        if (!file.isDirectory) {
          totalFiles++
          totalSize += file.size
        }
      }

      return {
        totalFiles,
        totalSize,
        lastUpdated: new Date(),
      }
    } catch (error) {
      console.error('Storage stats error:', error)
      throw new Error(`Failed to get storage statistics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Clean up temporary files older than specified age
   */
  async cleanupTempFiles(maxAgeHours: number = 24): Promise<number> {
    try {
      const tempDir = path.join(this.basePath, 'temp')
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)
      
      const files = await this.listFiles('temp', { recursive: true })
      let deletedCount = 0

      for (const file of files) {
        if (!file.isDirectory && file.lastModified < cutoffTime) {
          await this.deleteFile(file.path)
          deletedCount++
        }
      }

      return deletedCount
    } catch (error) {
      console.error('Temp cleanup error:', error)
      return 0
    }
  }

  /**
   * Upload file (adapter method for compatibility with hybrid storage)
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    options: {
      metadata?: Record<string, string>
    } = {}
  ): Promise<{
    path: string
    fullPath: string
    size: number
    checksum: string
  }> {
    const result = await this.saveFile(buffer, key, {
      validateExtension: false, // Skip extension validation for hybrid storage
      generateChecksum: true,
      createDirectories: true
    })

    return {
      path: result.relativePath,
      fullPath: result.path,
      size: result.size,
      checksum: result.checksum
    }
  }

  /**
   * Download file (adapter method for compatibility with hybrid storage)
   */
  async downloadFile(key: string): Promise<{
    buffer: Buffer
    metadata: any
  }> {
    const buffer = await this.readFile(key)
    return {
      buffer,
      metadata: {}
    }
  }

  /**
   * Health check for local storage
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', message: string }> {
    try {
      // Check if base directory is accessible
      await fs.access(this.basePath, fs.constants.R_OK | fs.constants.W_OK)
      
      // Test write operation
      const testFile = path.join(this.basePath, 'temp', '.health-check')
      const testData = Buffer.from('health-check')
      
      await fs.writeFile(testFile, testData)
      const readData = await fs.readFile(testFile)
      await fs.unlink(testFile)

      if (!testData.equals(readData)) {
        throw new Error('Read/write test failed')
      }

      return {
        status: 'healthy',
        message: 'Local storage is accessible and functional'
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Local storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Sanitize file path to prevent directory traversal attacks
   */
  private sanitizePath(filePath: string): string {
    // Remove any path traversal attempts
    const sanitized = filePath
      .replace(/\.\./g, '') // Remove ..
      .replace(/\/+/g, '/') // Replace multiple slashes with single slash
      .replace(/^\//, '') // Remove leading slash
      .replace(/\/$/, '') // Remove trailing slash

    return sanitized
  }

  /**
   * Sanitize file name to prevent issues with file system
   */
  private sanitizeFileName(fileName: string): string {
    // Replace invalid characters with underscores
    return fileName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  }
}

// Factory function to create local storage service instance
export function createLocalStorageService(): LocalStorageService {
  const config: LocalStorageConfig = {
    basePath: process.env.LOCAL_STORAGE_PATH || './storage/files',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
    allowedExtensions: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,jpeg,png,gif').split(','),
  }

  return new LocalStorageService(config)
}