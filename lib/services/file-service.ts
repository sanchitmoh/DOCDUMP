import { executeQuery, executeSingle } from '@/lib/database'
import { createHybridStorageService } from './hybrid-storage'
import { createTextExtractionService } from './text-extraction'
import { createElasticsearchService } from '@/lib/search/elasticsearch'
import { getRedisInstance } from '@/lib/cache/redis'

export interface FileRecord {
  id: number
  folder_id: number
  organization_id: number
  name: string
  description?: string
  tags?: string[]
  department?: string
  created_by?: number
  mime_type?: string
  file_type?: string
  size_bytes: number
  size_hr?: string
  storage_key: string
  file_url?: string
  checksum_sha256?: string
  ai_description?: string
  is_active: boolean
  is_deleted: boolean
  visibility: 'private' | 'org' | 'public'
  allow_download: boolean
  storage_mode: 'remote' | 'offline' | 'hybrid'
  storage_provider: 's3' | 'local' | 's3_compatible'
  s3_bucket?: string
  s3_key?: string
  s3_region?: string
  local_path?: string
  presigned_url?: string
  presigned_url_expires_at?: Date
  storage_config_id?: number
  created_at: Date
  updated_at: Date
  // Computed fields
  creator_name?: string
  folder_name?: string
  folder_path?: string
  permission?: string
  extracted_text?: string
  document_metadata?: any
}

export interface FilePermission {
  id: number
  file_id: number
  employee_id: number
  permission: 'read' | 'write' | 'owner'
  expires_at?: Date
  created_at: Date
  employee_name?: string
}

export interface FileVersion {
  id: number
  file_id: number
  version_number: number
  storage_key: string
  mime_type?: string
  size_bytes: number
  checksum_sha256?: string
  created_by: number
  created_at: Date
  creator_name?: string
}

export interface FileTag {
  id: number
  file_id: number
  tag: string
  created_at: Date
}

export class FileService {
  private redis = getRedisInstance()
  private storageService = createHybridStorageService()
  private textExtractionService = createTextExtractionService()
  private searchService = createElasticsearchService()

  /**
   * Get file by ID with permissions and metadata
   */
  async getFileById(
    fileId: number,
    organizationId: number,
    userId?: number
  ): Promise<FileRecord | null> {
    try {
      const files = await executeQuery(`
        SELECT 
          f.*,
          u.full_name as creator_name,
          fo.name as folder_name,
          fp.permission as file_permission,
          fop.permission as folder_permission,
          etc.extracted_text,
          dm.title as doc_title,
          dm.author as doc_author,
          dm.page_count,
          dm.word_count
        FROM files f
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
        LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
      `, [userId || null, userId || null, fileId, organizationId])

      if (files.length === 0) return null

      const file = files[0]

      // Get folder path
      if (file.folder_id) {
        const folderPath = await this.getFolderPath(file.folder_id, organizationId)
        file.folder_path = folderPath
      }

      // Parse tags if they exist
      if (file.tags) {
        try {
          file.tags = JSON.parse(file.tags)
        } catch {
          file.tags = []
        }
      }

      // Determine effective permission
      file.permission = this.getEffectivePermission(file, userId)

      return file
    } catch (error) {
      console.error('Error getting file:', error)
      return null
    }
  }

  /**
   * Get files in folder with pagination
   */
  async getFilesInFolder(
    folderId: number,
    organizationId: number,
    employeeId?: number,
    limit = 50,
    offset = 0
  ): Promise<{ files: FileRecord[], total: number }> {
    try {
      // Build query with conditional parameter handling
      let query = `
        SELECT 
          f.*,
          u.full_name AS creator_name,
          fo.name AS folder_name,
          fp.permission AS file_permission,
          fop.permission AS folder_permission,
          dm.page_count,
          dm.word_count
        FROM files f
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN folders fo ON f.folder_id = fo.id
      `;

      const params: any[] = [];

      // Only include employee permission joins if employeeId is provided
      if (employeeId) {
        query += `
        LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
        LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
        `;
        params.push(employeeId, employeeId);
      } else {
        query += `
        LEFT JOIN file_permissions fp ON f.id = fp.file_id
        LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id
        `;
      }

      query += `
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        WHERE f.folder_id = ?
          AND f.organization_id = ?
          AND f.is_deleted = 0
        ORDER BY f.name ASC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;

      params.push(folderId, organizationId);

      const files = await executeQuery(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM files f
        WHERE f.folder_id = ? AND f.organization_id = ? AND f.is_deleted = 0
      `;
      
      const countParams = [folderId, organizationId];
      const countResult = await executeQuery(countQuery, countParams);
      const total = countResult[0].total;

      // Process files
      const processedFiles = files.map((file: any) => {
        // Parse tags
        if (file.tags) {
          try {
            file.tags = JSON.parse(file.tags);
          } catch {
            file.tags = [];
          }
        }

        // Determine effective permission
        file.permission = this.getEffectivePermission(file, employeeId);

        return file;
      });

      return {
        files: processedFiles,
        total
      };
    } catch (error) {
      console.error('Error getting files in folder:', error);
      return { files: [], total: 0 };
    }
  }


  /**
   * Update file metadata
   */
  async updateFile(
    fileId: number,
    organizationId: number,
    updates: {
      name?: string
      description?: string
      tags?: string[]
      department?: string
      visibility?: 'private' | 'org' | 'public'
      allow_download?: boolean
      is_active?: boolean
    }
  ): Promise<void> {
    try {
      const updateFields: string[] = []
      const updateValues: any[] = []

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'tags' && Array.isArray(value)) {
            updateFields.push('tags = ?')
            updateValues.push(JSON.stringify(value))
          } else {
            updateFields.push(`${key} = ?`)
            updateValues.push(value)
          }
        }
      })

      if (updateFields.length === 0) {
        throw new Error('No fields to update')
      }

      // Check for duplicate name if name is being updated
      if (updates.name) {
        const file = await this.getFileById(fileId, organizationId)
        if (!file) {
          throw new Error('File not found')
        }

        const existingFiles = await executeQuery(`
          SELECT id FROM files 
          WHERE folder_id = ? AND name = ? AND id != ? AND is_deleted = 0
        `, [file.folder_id, updates.name, fileId])

        if (existingFiles.length > 0) {
          throw new Error('File with this name already exists in the folder')
        }
      }

      updateValues.push(fileId, organizationId)

      await executeSingle(`
        UPDATE files 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `, updateValues)

      // Update tags table if tags were updated
      if (updates.tags) {
        await this.updateFileTags(fileId, updates.tags)
      }

      // Update search index
      try {
        await this.searchService.indexDocument({
          file_id: fileId.toString(),
          organization_id: organizationId.toString(),
          title: updates.name || '',
          content: '',
          author: '',
          department: updates.department || '',
          tags: Array.isArray(updates.tags) ? updates.tags : [],
          file_type: '',
          mime_type: '',
          size_bytes: 0,
          created_at: new Date(),
          updated_at: new Date(),
          visibility: updates.visibility as any || 'private',
          folder_path: ''
        })
      } catch (error) {
        console.error('Error updating search index:', error)
      }
    } catch (error) {
      console.error('Error updating file:', error)
      throw error
    }
  }

  /**
   * Move file to different folder
   */
  async moveFile(
    fileId: number,
    organizationId: number,
    newFolderId: number
  ): Promise<void> {
    try {
      // Validate file exists
      const file = await this.getFileById(fileId, organizationId)
      if (!file) {
        throw new Error('File not found')
      }

      // Validate new folder exists
      const folders = await executeQuery(`
        SELECT id FROM folders 
        WHERE id = ? AND organization_id = ? AND is_deleted = 0
      `, [newFolderId, organizationId])

      if (folders.length === 0) {
        throw new Error('Destination folder not found')
      }

      // Check for duplicate name in new folder
      const existingFiles = await executeQuery(`
        SELECT id FROM files 
        WHERE folder_id = ? AND name = ? AND id != ? AND is_deleted = 0
      `, [newFolderId, file.name, fileId])

      if (existingFiles.length > 0) {
        throw new Error('File with this name already exists in the destination folder')
      }

      // Move file
      await executeSingle(`
        UPDATE files 
        SET folder_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `, [newFolderId, fileId, organizationId])

      // Log the move operation
      await executeSingle(`
        INSERT INTO file_audit_logs (
          organization_id, file_id, action, detail
        ) VALUES (?, ?, 'move', ?)
      `, [
        organizationId,
        fileId,
        JSON.stringify({
          from_folder_id: file.folder_id,
          to_folder_id: newFolderId,
          file_name: file.name
        })
      ])
    } catch (error) {
      console.error('Error moving file:', error)
      throw error
    }
  }

  /**
   * Delete file (soft delete)
   */
  async deleteFile(fileId: number, organizationId: number, userId?: number): Promise<void> {
    try {
      // Soft delete file
      await executeSingle(`
        UPDATE files 
        SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `, [fileId, organizationId])

      // Log the deletion
      await executeSingle(`
        INSERT INTO file_audit_logs (
          organization_id, file_id, employee_id, action, detail
        ) VALUES (?, ?, ?, 'delete', ?)
      `, [
        organizationId,
        fileId,
        userId || null,
        JSON.stringify({
          deleted_at: new Date().toISOString(),
          soft_delete: true
        })
      ])

      // Remove from search index
      await this.searchService.deleteDocument(fileId.toString())
    } catch (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  }

  /**
   * Get file versions
   */
  async getFileVersions(fileId: number, organizationId: number): Promise<FileVersion[]> {
    try {
      return await executeQuery(`
        SELECT 
          fv.*,
          u.full_name as creator_name
        FROM file_versions fv
        JOIN files f ON fv.file_id = f.id
        LEFT JOIN organization_employees u ON fv.created_by = u.id
        WHERE fv.file_id = ? AND f.organization_id = ?
        ORDER BY fv.version_number DESC
      `, [fileId, organizationId])
    } catch (error) {
      console.error('Error getting file versions:', error)
      return []
    }
  }

  /**
   * Create file version
   */
  async createFileVersion(
    fileId: number,
    organizationId: number,
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
    checksum: string,
    createdBy: number
  ): Promise<number> {
    try {
      // Get next version number
      const versions = await executeQuery(`
        SELECT MAX(version_number) as max_version
        FROM file_versions fv
        JOIN files f ON fv.file_id = f.id
        WHERE fv.file_id = ? AND f.organization_id = ?
      `, [fileId, organizationId])

      const nextVersion = (versions[0].max_version || 0) + 1

      // Create version
      const result = await executeSingle(`
        INSERT INTO file_versions (
          file_id, version_number, storage_key, mime_type, 
          size_bytes, checksum_sha256, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [fileId, nextVersion, storageKey, mimeType, sizeBytes, checksum, createdBy])

      return result.insertId
    } catch (error) {
      console.error('Error creating file version:', error)
      throw error
    }
  }

  /**
   * Get file permissions
   */
  async getFilePermissions(fileId: number, organizationId: number): Promise<FilePermission[]> {
    try {
      return await executeQuery(`
        SELECT 
          fp.*,
          u.full_name as employee_name
        FROM file_permissions fp
        JOIN organization_employees u ON fp.employee_id = u.id
        JOIN files f ON fp.file_id = f.id
        WHERE fp.file_id = ? AND f.organization_id = ?
        ORDER BY u.full_name ASC
      `, [fileId, organizationId])
    } catch (error) {
      console.error('Error getting file permissions:', error)
      return []
    }
  }

  /**
   * Set file permission
   */
  async setFilePermission(
    fileId: number,
    employeeId: number,
    permission: 'read' | 'write' | 'owner',
    organizationId: number,
    expiresAt?: Date
  ): Promise<void> {
    try {
      // Verify file belongs to organization
      const file = await this.getFileById(fileId, organizationId)
      if (!file) {
        throw new Error('File not found')
      }

      // Verify employee belongs to organization
      const employees = await executeQuery(`
        SELECT id FROM organization_employees 
        WHERE id = ? AND organization_id = ?
      `, [employeeId, organizationId])

      if (employees.length === 0) {
        throw new Error('Employee not found in organization')
      }

      // Set permission (upsert)
      await executeSingle(`
        INSERT INTO file_permissions (file_id, employee_id, permission, expires_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          permission = VALUES(permission),
          expires_at = VALUES(expires_at),
          created_at = CURRENT_TIMESTAMP
      `, [fileId, employeeId, permission, expiresAt || null])
    } catch (error) {
      console.error('Error setting file permission:', error)
      throw error
    }
  }

  /**
   * Remove file permission
   */
  async removeFilePermission(
    fileId: number,
    employeeId: number,
    organizationId: number
  ): Promise<void> {
    try {
      await executeSingle(`
        DELETE fp FROM file_permissions fp
        JOIN files f ON fp.file_id = f.id
        WHERE fp.file_id = ? AND fp.employee_id = ? AND f.organization_id = ?
      `, [fileId, employeeId, organizationId])
    } catch (error) {
      console.error('Error removing file permission:', error)
      throw error
    }
  }

  /**
   * Search files
   */
  async searchFiles(
    organizationId: number,
    query: string,
    userId?: number,
    filters?: {
      folderId?: number
      fileType?: string
      mimeType?: string
      department?: string
      createdBy?: number
      visibility?: string
      tags?: string[]
      dateRange?: {
        from?: string
        to?: string
      }
      sizeRange?: {
        min?: number
        max?: number
      }
    },
    options?: {
      limit?: number
      offset?: number
      sortBy?: string
      sortOrder?: 'ASC' | 'DESC'
    }
  ): Promise<{ files: FileRecord[], total: number }> {
    try {
      const limit = options?.limit || 50
      const offset = options?.offset || 0
      const sortBy = options?.sortBy || 'name'
      const sortOrder = options?.sortOrder || 'ASC'

      let whereClause = `
        WHERE f.organization_id = ? AND f.is_deleted = 0 
        AND (f.name LIKE ? OR f.description LIKE ? OR etc.extracted_text LIKE ?)
      `
      const queryParams = [organizationId, `%${query}%`, `%${query}%`, `%${query}%`]

      // Apply filters
      if (filters?.folderId) {
        whereClause += ' AND f.folder_id = ?'
        queryParams.push(filters.folderId)
      }

      if (filters?.fileType) {
        whereClause += ' AND f.file_type = ?'
        queryParams.push(filters.fileType)
      }

      if (filters?.mimeType) {
        whereClause += ' AND f.mime_type = ?'
        queryParams.push(filters.mimeType)
      }

      if (filters?.department) {
        whereClause += ' AND f.department = ?'
        queryParams.push(filters.department)
      }

      if (filters?.createdBy) {
        whereClause += ' AND f.created_by = ?'
        queryParams.push(filters.createdBy)
      }

      if (filters?.visibility) {
        whereClause += ' AND f.visibility = ?'
        queryParams.push(filters.visibility)
      }

      if (filters?.dateRange?.from) {
        whereClause += ' AND f.created_at >= ?'
        queryParams.push(filters.dateRange.from)
      }

      if (filters?.dateRange?.to) {
        whereClause += ' AND f.created_at <= ?'
        queryParams.push(filters.dateRange.to)
      }

      if (filters?.sizeRange?.min) {
        whereClause += ' AND f.size_bytes >= ?'
        queryParams.push(filters.sizeRange.min)
      }

      if (filters?.sizeRange?.max) {
        whereClause += ' AND f.size_bytes <= ?'
        queryParams.push(filters.sizeRange.max)
      }

      // Tag filtering
      if (filters?.tags && filters.tags.length > 0) {
        const tagPlaceholders = filters.tags.map(() => '?').join(',')
        whereClause += ` AND f.id IN (
          SELECT DISTINCT ft.file_id FROM file_tags ft 
          WHERE ft.tag IN (${tagPlaceholders})
        )`
        queryParams.push(...filters.tags)
      }

      // Get files
      const files = await executeQuery(`
        SELECT 
          f.*,
          u.full_name as creator_name,
          fo.name as folder_name,
          fp.permission as file_permission,
          fop.permission as folder_permission,
          etc.extracted_text,
          dm.page_count,
          dm.word_count
        FROM files f
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.employee_id = ?
        LEFT JOIN folder_permissions fop ON fo.id = fop.folder_id AND fop.employee_id = ?
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN document_metadata dm ON f.id = dm.file_id
        ${whereClause}
        ORDER BY f.${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `, [userId || null, userId || null, ...queryParams, limit, offset])

      // Get total count
      const countResult = await executeQuery(`
        SELECT COUNT(DISTINCT f.id) as total
        FROM files f
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        ${whereClause}
      `, queryParams)

      const total = countResult[0].total

      // Process files
      const processedFiles = await Promise.all(files.map(async file => {
        // Parse tags
        if (file.tags) {
          try {
            file.tags = JSON.parse(file.tags)
          } catch {
            file.tags = []
          }
        }

        // Get folder path
        if (file.folder_id) {
          file.folder_path = await this.getFolderPath(file.folder_id, organizationId)
        }

        // Determine effective permission
        file.permission = this.getEffectivePermission(file, userId)

        return file
      }))

      return {
        files: processedFiles,
        total
      }
    } catch (error) {
      console.error('Error searching files:', error)
      return { files: [], total: 0 }
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(organizationId: number): Promise<any> {
    try {
      const overview = await executeQuery(`
        SELECT 
          COUNT(*) as total_files,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_files,
          COUNT(CASE WHEN is_deleted = 1 THEN 1 END) as deleted_files,
          SUM(size_bytes) as total_size_bytes,
          AVG(size_bytes) as avg_size_bytes,
          COUNT(DISTINCT file_type) as file_types_count,
          COUNT(DISTINCT mime_type) as mime_types_count,
          COUNT(DISTINCT created_by) as uploaders_count
        FROM files 
        WHERE organization_id = ?
      `, [organizationId])

      const byFileType = await executeQuery(`
        SELECT 
          file_type,
          COUNT(*) as file_count,
          SUM(size_bytes) as total_size_bytes,
          AVG(size_bytes) as avg_size_bytes
        FROM files 
        WHERE organization_id = ? AND is_deleted = 0
        GROUP BY file_type
        ORDER BY file_count DESC
      `, [organizationId])

      const byFolder = await executeQuery(`
        SELECT 
          fo.name as folder_name,
          COUNT(f.id) as file_count,
          SUM(f.size_bytes) as total_size_bytes
        FROM files f
        JOIN folders fo ON f.folder_id = fo.id
        WHERE f.organization_id = ? AND f.is_deleted = 0
        GROUP BY f.folder_id, fo.name
        ORDER BY file_count DESC
        LIMIT 10
      `, [organizationId])

      const recentActivity = await executeQuery(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as uploads_count,
          SUM(size_bytes) as total_size_bytes
        FROM files 
        WHERE organization_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [organizationId])

      return {
        overview: overview[0],
        by_file_type: byFileType,
        by_folder: byFolder,
        recent_activity: recentActivity
      }
    } catch (error) {
      console.error('Error getting file stats:', error)
      return null
    }
  }

  /**
   * Update file tags
   */
  private async updateFileTags(fileId: number, tags: string[]): Promise<void> {
    try {
      // Delete existing tags
      await executeSingle(`
        DELETE FROM file_tags WHERE file_id = ?
      `, [fileId])

      // Insert new tags
      if (tags.length > 0) {
        const values = tags.map(tag => [fileId, tag.trim()])
        const placeholders = values.map(() => '(?, ?)').join(', ')
        const flatValues = values.flat()

        await executeSingle(`
          INSERT INTO file_tags (file_id, tag) VALUES ${placeholders}
        `, flatValues)
      }
    } catch (error) {
      console.error('Error updating file tags:', error)
      throw error
    }
  }

  /**
   * Get folder path string
   */
  private async getFolderPath(folderId: number, organizationId: number): Promise<string> {
    try {
      const cacheKey = `folder_path_string:${folderId}`
      const cached = await this.redis.get(cacheKey)
      if (cached && typeof cached === 'string') return cached

      const path: string[] = []
      let currentId = folderId

      while (currentId) {
        const folders = await executeQuery(`
          SELECT name, parent_id FROM folders 
          WHERE id = ? AND organization_id = ? AND is_deleted = 0
        `, [currentId, organizationId])

        if (folders.length === 0) break

        const folder = folders[0]
        path.unshift(folder.name)
        currentId = folder.parent_id
      }

      const pathString = '/' + path.join('/')
      await this.redis.set(cacheKey, pathString, { ttl: 3600 })

      return pathString
    } catch (error) {
      console.error('Error getting folder path:', error)
      return ''
    }
  }

  /**
   * Get effective permission for file
   */
  private getEffectivePermission(file: any, userId?: number): string | null {
    if (!userId) return null

    // File owner has full access
    if (file.created_by === userId) return 'owner'

    // Check explicit file permission
    if (file.file_permission) return file.file_permission

    // Check folder permission
    if (file.folder_permission) {
      const folderToFilePermission = {
        'read': 'read',
        'write': 'write',
        'admin': 'owner'
      }
      return folderToFilePermission[file.folder_permission as keyof typeof folderToFilePermission] || null
    }

    // Check visibility
    if (file.visibility === 'public' || file.visibility === 'org') {
      return 'read'
    }

    return null
  }

  /**
   * Track file view/download
   */
  async trackFileAccess(
    fileId: number,
    organizationId: number,
    userId: number,
    accessType: 'view' | 'download',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Update file access counts
      if (accessType === 'view') {
        await executeSingle(`
          UPDATE files SET 
            view_count = COALESCE(view_count, 0) + 1,
            last_viewed_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?
        `, [fileId, organizationId])
      } else if (accessType === 'download') {
        await executeSingle(`
          UPDATE files SET 
            download_count = COALESCE(download_count, 0) + 1,
            last_downloaded_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?
        `, [fileId, organizationId])
      }

      // Log the access in audit trail
      await executeSingle(`
        INSERT INTO file_audit_logs (
          organization_id, file_id, employee_id, action, detail
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        organizationId,
        fileId,
        userId,
        accessType,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent
        })
      ])
    } catch (error) {
      console.error('Error tracking file access:', error)
      // Don't throw error - just log it so the main operation can continue
    }
  }

  /**
   * Generate AI summary for file
   */
  async generateAISummary(
    fileId: number,
    organizationId: number,
    userId: number
  ): Promise<{ success: boolean, summary?: string, error?: string }> {
    try {
      // Check if OpenAI is configured
      if (!process.env.OPENAI_API_KEY) {
        return { success: false, error: 'AI service not configured' }
      }

      // Get file information and extracted text
      const fileData = await executeQuery(`
        SELECT 
          f.name,
          f.file_type,
          f.mime_type,
          f.description,
          f.ai_description,
          etc.extracted_text,
          fo.name as folder_name,
          d.name as department_name
        FROM files f
        LEFT JOIN extracted_text_content etc ON f.id = etc.file_id AND etc.content_type = 'full_text'
        LEFT JOIN folders fo ON f.folder_id = fo.id
        LEFT JOIN departments d ON f.department COLLATE utf8mb4_general_ci = d.name COLLATE utf8mb4_general_ci AND d.organization_id = f.organization_id
        WHERE f.id = ? AND f.organization_id = ?
      `, [fileId, organizationId])

      if (fileData.length === 0) {
        return { success: false, error: 'File not found' }
      }

      const file = fileData[0]
      
      // Check if we have content to summarize
      const content = file.extracted_text || file.description || file.ai_description
      if (!content || content.trim().length < 50) {
        return { success: false, error: 'Insufficient content to generate summary' }
      }

      // Import AI service dynamically
      const { createAIService } = await import('@/lib/services/ai-service')
      const aiService = createAIService()

      // Generate summary
      const summaryResult = await aiService.generateContent({
        type: 'summary',
        content,
        context: {
          fileName: file.name,
          fileType: file.file_type,
          department: file.department_name
        },
        options: {
          maxLength: 500,
          tone: 'professional'
        }
      })

      // Store the summary
      const summaryContent = Array.isArray(summaryResult.result) 
        ? summaryResult.result.join('\n') 
        : summaryResult.result

      await executeSingle(`
        INSERT INTO ai_generated_content (
          file_id, organization_id, content_type, content, 
          generated_by, model_used, created_at
        ) VALUES (?, ?, 'summary', ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          content = VALUES(content),
          generated_by = VALUES(generated_by),
          model_used = VALUES(model_used),
          created_at = CURRENT_TIMESTAMP
      `, [
        fileId,
        organizationId,
        summaryContent,
        userId,
        'gpt-3.5-turbo'
      ])

      return { success: true, summary: summaryContent }
    } catch (error) {
      console.error('Error generating AI summary:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate summary' 
      }
    }
  }
}

// Factory function
export function createFileService(): FileService {
  return new FileService()
}