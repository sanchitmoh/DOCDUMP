import { executeQuery, executeSingle } from '@/lib/database'
import { getRedisInstance } from '@/lib/cache/redis'

export interface Folder {
  id: number
  organization_id: number
  parent_id?: number
  name: string
  description?: string
  created_by?: number
  department?: string
  is_active: boolean
  is_deleted: boolean
  created_at: Date
  updated_at: Date
  // Computed fields
  creator_name?: string
  parent_name?: string
  children_count?: number
  files_count?: number
  total_size?: number
  permission?: string
}

export interface FolderPermission {
  id: number
  folder_id: number
  employee_id: number
  permission: 'read' | 'write' | 'admin'
  created_at: Date
  employee_name?: string
}

export interface FolderTree {
  id: number
  name: string
  description?: string
  parent_id?: number
  children: FolderTree[]
  files_count: number
  total_size: number
  permission?: string
  created_by?: number
  created_at: Date
  is_active: boolean
}

export class FolderService {
  private redis = getRedisInstance()

  /**
   * Create a new folder
   */
  async createFolder(
    organizationId: number,
    name: string,
    parentId?: number,
    description?: string,
    department?: string,
    createdBy?: number
  ): Promise<number> {
    try {
      // Validate parent folder exists if provided
      if (parentId) {
        const parentFolders = await executeQuery(`
          SELECT id FROM folders 
          WHERE id = ? AND organization_id = ? AND is_deleted = 0
        `, [parentId, organizationId])

        if (parentFolders.length === 0) {
          throw new Error('Parent folder not found')
        }
      }

      // Check for duplicate folder name in same parent
      const existingFolders = await executeQuery(`
        SELECT id FROM folders 
        WHERE organization_id = ? AND parent_id <=> ? AND name = ? AND is_deleted = 0
      `, [organizationId, parentId || null, name])

      if (existingFolders.length > 0) {
        throw new Error('Folder with this name already exists in the same location')
      }

      // Create folder
      const result = await executeSingle(`
        INSERT INTO folders (
          organization_id, parent_id, name, description, department, created_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [organizationId, parentId || null, name, description || null, department || null, createdBy || null])

      const folderId = result.insertId

      // Cache folder path for quick lookups
      await this.cacheFolderPath(folderId)

      return folderId
    } catch (error) {
      console.error('Error creating folder:', error)
      throw error
    }
  }

  /**
   * Get folder by ID with permissions
   */
  async getFolderById(
    folderId: number,
    organizationId: number,
    userId?: number
  ): Promise<Folder | null> {
    try {
      const folders = await executeQuery(`
        SELECT 
          f.*,
          u.full_name as creator_name,
          pf.name as parent_name,
          fp.permission,
          (SELECT COUNT(*) FROM folders cf WHERE cf.parent_id = f.id AND cf.is_deleted = 0) as children_count,
          (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id AND fi.is_deleted = 0) as files_count,
          (SELECT COALESCE(SUM(fi.size_bytes), 0) FROM files fi WHERE fi.folder_id = f.id AND fi.is_deleted = 0) as total_size
        FROM folders f
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN folders pf ON f.parent_id = pf.id
        LEFT JOIN folder_permissions fp ON f.id = fp.folder_id AND fp.employee_id = ?
        WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
      `, [userId || null, folderId, organizationId])

      return folders.length > 0 ? folders[0] : null
    } catch (error) {
      console.error('Error getting folder:', error)
      return null
    }
  }

  /**
   * Get folder tree structure
   */
  async getFolderTree(
    organizationId: number,
    parentId?: number,
    userId?: number,
    maxDepth: number = 5
  ): Promise<FolderTree[]> {
    try {
      // Get folders at current level
      const folders = await executeQuery(`
        SELECT 
          f.*,
          fp.permission,
          (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id AND fi.is_deleted = 0) as files_count,
          (SELECT COALESCE(SUM(fi.size_bytes), 0) FROM files fi WHERE fi.folder_id = f.id AND fi.is_deleted = 0) as total_size
        FROM folders f
        LEFT JOIN folder_permissions fp ON f.id = fp.folder_id AND fp.employee_id = ?
        WHERE f.organization_id = ? AND f.parent_id <=> ? AND f.is_deleted = 0 AND f.is_active = 1
        ORDER BY f.name ASC
      `, [userId || null, organizationId, parentId || null])

      const tree: FolderTree[] = []

      for (const folder of folders) {
        const treeNode: FolderTree = {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          parent_id: folder.parent_id,
          children: [],
          files_count: folder.files_count || 0,
          total_size: folder.total_size || 0,
          permission: folder.permission,
          created_by: folder.created_by,
          created_at: folder.created_at,
          is_active: folder.is_active
        }

        // Recursively get children if not at max depth
        if (maxDepth > 0) {
          treeNode.children = await this.getFolderTree(
            organizationId,
            folder.id,
            userId,
            maxDepth - 1
          )
        }

        tree.push(treeNode)
      }

      return tree
    } catch (error) {
      console.error('Error getting folder tree:', error)
      return []
    }
  }

  /**
   * Get folder breadcrumb path
   */
  async getFolderPath(folderId: number, organizationId: number): Promise<Folder[]> {
    try {
      // Check cache first
      const cacheKey = `folder_path:${folderId}`
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return cached
      }

      const path: Folder[] = []
      let currentId = folderId

      while (currentId) {
        const folders = await executeQuery(`
          SELECT f.*, u.full_name as creator_name
          FROM folders f
          LEFT JOIN organization_employees u ON f.created_by = u.id
          WHERE f.id = ? AND f.organization_id = ? AND f.is_deleted = 0
        `, [currentId, organizationId])

        if (folders.length === 0) break

        const folder = folders[0]
        path.unshift(folder)
        currentId = folder.parent_id
      }

      // Cache for 1 hour
      await this.redis.set(cacheKey, path, { ttl: 3600 })

      return path
    } catch (error) {
      console.error('Error getting folder path:', error)
      return []
    }
  }

  /**
   * Update folder
   */
  async updateFolder(
    folderId: number,
    organizationId: number,
    updates: {
      name?: string
      description?: string
      department?: string
      is_active?: boolean
    }
  ): Promise<void> {
    try {
      const updateFields = []
      const updateValues = []

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`)
          updateValues.push(value)
        }
      })

      if (updateFields.length === 0) {
        throw new Error('No fields to update')
      }

      // Check for duplicate name if name is being updated
      if (updates.name) {
        const folder = await this.getFolderById(folderId, organizationId)
        if (!folder) {
          throw new Error('Folder not found')
        }

        const existingFolders = await executeQuery(`
          SELECT id FROM folders 
          WHERE organization_id = ? AND parent_id <=> ? AND name = ? AND id != ? AND is_deleted = 0
        `, [organizationId, folder.parent_id || null, updates.name, folderId])

        if (existingFolders.length > 0) {
          throw new Error('Folder with this name already exists in the same location')
        }
      }

      updateValues.push(folderId, organizationId)

      await executeSingle(`
        UPDATE folders 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `, updateValues)

      // Clear cache
      await this.clearFolderCache(folderId)
    } catch (error) {
      console.error('Error updating folder:', error)
      throw error
    }
  }

  /**
   * Move folder to different parent
   */
  async moveFolder(
    folderId: number,
    organizationId: number,
    newParentId?: number
  ): Promise<void> {
    try {
      // Validate folder exists
      const folder = await this.getFolderById(folderId, organizationId)
      if (!folder) {
        throw new Error('Folder not found')
      }

      // Validate new parent exists if provided
      if (newParentId) {
        const parentFolder = await this.getFolderById(newParentId, organizationId)
        if (!parentFolder) {
          throw new Error('Parent folder not found')
        }

        // Check for circular reference
        const isCircular = await this.checkCircularReference(folderId, newParentId, organizationId)
        if (isCircular) {
          throw new Error('Cannot move folder: would create circular reference')
        }
      }

      // Check for duplicate name in new location
      const existingFolders = await executeQuery(`
        SELECT id FROM folders 
        WHERE organization_id = ? AND parent_id <=> ? AND name = ? AND id != ? AND is_deleted = 0
      `, [organizationId, newParentId || null, folder.name, folderId])

      if (existingFolders.length > 0) {
        throw new Error('Folder with this name already exists in the destination')
      }

      // Move folder
      await executeSingle(`
        UPDATE folders 
        SET parent_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `, [newParentId || null, folderId, organizationId])

      // Clear cache for affected folders
      await this.clearFolderCache(folderId)
      if (folder.parent_id) {
        await this.clearFolderCache(folder.parent_id)
      }
      if (newParentId) {
        await this.clearFolderCache(newParentId)
      }
    } catch (error) {
      console.error('Error moving folder:', error)
      throw error
    }
  }

  /**
   * Delete folder (soft delete)
   */
  async deleteFolder(folderId: number, organizationId: number): Promise<void> {
    try {
      // Check if folder has children or files
      const children = await executeQuery(`
        SELECT COUNT(*) as count FROM folders 
        WHERE parent_id = ? AND is_deleted = 0
      `, [folderId])

      const files = await executeQuery(`
        SELECT COUNT(*) as count FROM files 
        WHERE folder_id = ? AND is_deleted = 0
      `, [folderId])

      if (children[0].count > 0 || files[0].count > 0) {
        throw new Error('Cannot delete folder: contains subfolders or files')
      }

      // Soft delete folder
      await executeSingle(`
        UPDATE folders 
        SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `, [folderId, organizationId])

      // Clear cache
      await this.clearFolderCache(folderId)
    } catch (error) {
      console.error('Error deleting folder:', error)
      throw error
    }
  }

  /**
   * Get folder permissions
   */
  async getFolderPermissions(folderId: number, organizationId: number): Promise<FolderPermission[]> {
    try {
      return await executeQuery(`
        SELECT 
          fp.*,
          u.full_name as employee_name
        FROM folder_permissions fp
        JOIN organization_employees u ON fp.employee_id = u.id
        JOIN folders f ON fp.folder_id = f.id
        WHERE fp.folder_id = ? AND f.organization_id = ?
        ORDER BY u.full_name ASC
      `, [folderId, organizationId])
    } catch (error) {
      console.error('Error getting folder permissions:', error)
      return []
    }
  }

  /**
   * Set folder permission
   */
  async setFolderPermission(
    folderId: number,
    employeeId: number,
    permission: 'read' | 'write' | 'admin',
    organizationId: number
  ): Promise<void> {
    try {
      // Verify folder belongs to organization
      const folder = await this.getFolderById(folderId, organizationId)
      if (!folder) {
        throw new Error('Folder not found')
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
        INSERT INTO folder_permissions (folder_id, employee_id, permission)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          permission = VALUES(permission),
          created_at = CURRENT_TIMESTAMP
      `, [folderId, employeeId, permission])
    } catch (error) {
      console.error('Error setting folder permission:', error)
      throw error
    }
  }

  /**
   * Remove folder permission
   */
  async removeFolderPermission(
    folderId: number,
    employeeId: number,
    organizationId: number
  ): Promise<void> {
    try {
      await executeSingle(`
        DELETE fp FROM folder_permissions fp
        JOIN folders f ON fp.folder_id = f.id
        WHERE fp.folder_id = ? AND fp.employee_id = ? AND f.organization_id = ?
      `, [folderId, employeeId, organizationId])
    } catch (error) {
      console.error('Error removing folder permission:', error)
      throw error
    }
  }

  /**
   * Check user permission for folder
   */
  async checkFolderPermission(
    folderId: number,
    userId: number,
    organizationId: number,
    requiredPermission: 'read' | 'write' | 'admin' = 'read'
  ): Promise<boolean> {
    try {
      // Get folder and user info
      const folder = await this.getFolderById(folderId, organizationId, userId)
      if (!folder) return false

      // Folder creator has full access
      if (folder.created_by === userId) return true

      // Check explicit folder permission
      if (folder.permission) {
        const permissionLevels = { read: 1, write: 2, admin: 3 }
        const userLevel = permissionLevels[folder.permission as keyof typeof permissionLevels]
        const requiredLevel = permissionLevels[requiredPermission]
        return userLevel >= requiredLevel
      }

      // Check inherited permissions from parent folders
      const path = await this.getFolderPath(folderId, organizationId)
      for (const pathFolder of path.reverse()) {
        const permissions = await executeQuery(`
          SELECT permission FROM folder_permissions 
          WHERE folder_id = ? AND employee_id = ?
        `, [pathFolder.id, userId])

        if (permissions.length > 0) {
          const permissionLevels = { read: 1, write: 2, admin: 3 }
          const userLevel = permissionLevels[permissions[0].permission as keyof typeof permissionLevels]
          const requiredLevel = permissionLevels[requiredPermission]
          return userLevel >= requiredLevel
        }
      }

      return false
    } catch (error) {
      console.error('Error checking folder permission:', error)
      return false
    }
  }

  /**
   * Search folders
   */
  async searchFolders(
    organizationId: number,
    query: string,
    userId?: number,
    filters?: {
      department?: string
      createdBy?: number
      parentId?: number
    }
  ): Promise<Folder[]> {
    try {
      let whereClause = `
        WHERE f.organization_id = ? AND f.is_deleted = 0 
        AND (f.name LIKE ? OR f.description LIKE ?)
      `
      const queryParams = [organizationId, `%${query}%`, `%${query}%`]

      if (filters?.department) {
        whereClause += ' AND f.department = ?'
        queryParams.push(filters.department)
      }

      if (filters?.createdBy) {
        whereClause += ' AND f.created_by = ?'
        queryParams.push(filters.createdBy)
      }

      if (filters?.parentId !== undefined) {
        whereClause += ' AND f.parent_id <=> ?'
        queryParams.push(filters.parentId || null)
      }

      return await executeQuery(`
        SELECT 
          f.*,
          u.full_name as creator_name,
          pf.name as parent_name,
          fp.permission,
          (SELECT COUNT(*) FROM folders cf WHERE cf.parent_id = f.id AND cf.is_deleted = 0) as children_count,
          (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id AND fi.is_deleted = 0) as files_count,
          (SELECT COALESCE(SUM(fi.size_bytes), 0) FROM files fi WHERE fi.folder_id = f.id AND fi.is_deleted = 0) as total_size
        FROM folders f
        LEFT JOIN organization_employees u ON f.created_by = u.id
        LEFT JOIN folders pf ON f.parent_id = pf.id
        LEFT JOIN folder_permissions fp ON f.id = fp.folder_id AND fp.employee_id = ?
        ${whereClause}
        ORDER BY f.name ASC
        LIMIT 100
      `, [userId || null, ...queryParams])
    } catch (error) {
      console.error('Error searching folders:', error)
      return []
    }
  }

  /**
   * Get folder statistics
   */
  async getFolderStats(organizationId: number): Promise<any> {
    try {
      const stats = await executeQuery(`
        SELECT 
          COUNT(*) as total_folders,
          COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_folders,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_folders,
          COUNT(CASE WHEN is_deleted = 1 THEN 1 END) as deleted_folders,
          COUNT(DISTINCT department) as departments_with_folders,
          COUNT(DISTINCT created_by) as users_with_folders
        FROM folders 
        WHERE organization_id = ?
      `, [organizationId])

      const departmentStats = await executeQuery(`
        SELECT 
          department,
          COUNT(*) as folder_count,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count
        FROM folders 
        WHERE organization_id = ? AND department IS NOT NULL
        GROUP BY department
        ORDER BY folder_count DESC
      `, [organizationId])

      const creatorStats = await executeQuery(`
        SELECT 
          u.full_name as creator_name,
          COUNT(*) as folder_count
        FROM folders f
        JOIN organization_employees u ON f.created_by = u.id
        WHERE f.organization_id = ?
        GROUP BY f.created_by, u.full_name
        ORDER BY folder_count DESC
        LIMIT 10
      `, [organizationId])

      return {
        overview: stats[0],
        by_department: departmentStats,
        by_creator: creatorStats
      }
    } catch (error) {
      console.error('Error getting folder stats:', error)
      return null
    }
  }

  /**
   * Check for circular reference in folder hierarchy
   */
  private async checkCircularReference(
    folderId: number,
    newParentId: number,
    organizationId: number
  ): Promise<boolean> {
    try {
      let currentId = newParentId
      const visited = new Set<number>()

      while (currentId && !visited.has(currentId)) {
        if (currentId === folderId) {
          return true // Circular reference found
        }

        visited.add(currentId)

        const parents = await executeQuery(`
          SELECT parent_id FROM folders 
          WHERE id = ? AND organization_id = ? AND is_deleted = 0
        `, [currentId, organizationId])

        currentId = parents.length > 0 ? parents[0].parent_id : null
      }

      return false
    } catch (error) {
      console.error('Error checking circular reference:', error)
      return true // Assume circular to be safe
    }
  }

  /**
   * Cache folder path
   */
  private async cacheFolderPath(folderId: number): Promise<void> {
    try {
      const cacheKey = `folder_path:${folderId}`
      await this.redis.del(cacheKey) // Clear existing cache
    } catch (error) {
      console.error('Error caching folder path:', error)
    }
  }

  /**
   * Clear folder cache
   */
  private async clearFolderCache(folderId: number): Promise<void> {
    try {
      await this.redis.clearPattern(`folder_path:${folderId}`)
      await this.redis.clearPattern(`folder_tree:*`)
    } catch (error) {
      console.error('Error clearing folder cache:', error)
    }
  }
}

// Factory function
export function createFolderService(): FolderService {
  return new FolderService()
}