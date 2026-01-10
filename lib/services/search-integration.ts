import { createElasticsearchService } from '@/lib/search/elasticsearch'
import { executeQuery } from '@/lib/database'

export interface FileIndexData {
  id: number
  name: string
  file_type: string
  mime_type: string
  size_bytes: number
  organization_id: number
  uploaded_by: number
  visibility: 'private' | 'org' | 'public'
  folder_path?: string
  description?: string
  ai_description?: string
  extracted_text?: string
  ocr_confidence?: number
  created_at: Date
  updated_at: Date
  uploader_name?: string
  department_name?: string
  tags?: string[]
}

export class SearchIntegrationService {
  private elasticsearchService = createElasticsearchService()

  /**
   * Index a file in Elasticsearch when it's uploaded or updated
   */
  async indexFile(fileId: number): Promise<boolean> {
    try {
      // Get file data with related information
      const fileData = await this.getFileDataForIndexing(fileId)
      
      if (!fileData) {
        console.error(`File ${fileId} not found for indexing`)
        return false
      }

      // Prepare document for Elasticsearch
      const document = {
        file_id: fileData.id.toString(),
        organization_id: fileData.organization_id.toString(),
        title: fileData.name,
        content: fileData.description || fileData.ai_description || '',
        author: fileData.uploader_name || '',
        department: fileData.department_name || '',
        tags: fileData.tags || [],
        file_type: fileData.file_type,
        mime_type: fileData.mime_type,
        size_bytes: fileData.size_bytes,
        created_at: fileData.created_at,
        updated_at: fileData.updated_at,
        extracted_text: fileData.extracted_text || '',
        ocr_confidence: fileData.ocr_confidence || 0,
        language: 'en', // Default to English, can be enhanced with language detection
        visibility: fileData.visibility,
        folder_path: fileData.folder_path || ''
      }

      // Index in Elasticsearch
      const result = await this.elasticsearchService.indexDocument(document)
      
      if (result) {
        console.log(`✅ File ${fileId} indexed successfully in Elasticsearch`)
      } else {
        console.error(`❌ Failed to index file ${fileId} in Elasticsearch`)
      }

      return result
    } catch (error) {
      console.error(`Error indexing file ${fileId}:`, error)
      return false
    }
  }

  /**
   * Remove a file from Elasticsearch index
   */
  async removeFileFromIndex(fileId: number): Promise<boolean> {
    try {
      const result = await this.elasticsearchService.deleteDocument(fileId.toString())
      
      if (result) {
        console.log(`✅ File ${fileId} removed from search index`)
      } else {
        console.error(`❌ Failed to remove file ${fileId} from search index`)
      }

      return result
    } catch (error) {
      console.error(`Error removing file ${fileId} from index:`, error)
      return false
    }
  }

  /**
   * Bulk index multiple files
   */
  async bulkIndexFiles(organizationId: number, limit: number = 100): Promise<{ success: number; failed: number }> {
    try {
      console.log(`Starting bulk indexing for organization ${organizationId}...`)
      
      // Get files to index
      const files = await executeQuery<FileIndexData>(`
        SELECT 
          f.id,
          f.name,
          f.file_type,
          f.mime_type,
          f.size_bytes,
          f.organization_id,
          f.uploaded_by,
          f.visibility,
          f.folder_path,
          f.description,
          f.ai_description,
          f.extracted_text,
          f.ocr_confidence,
          f.created_at,
          f.updated_at,
          COALESCE(oe.full_name, o.admin_full_name) as uploader_name,
          d.name as department_name
        FROM files f
        LEFT JOIN organization_employees oe ON f.uploaded_by = oe.id
        LEFT JOIN organizations o ON f.organization_id = o.id
        LEFT JOIN user_departments ud ON oe.id = ud.user_id AND ud.is_primary = 1
        LEFT JOIN departments d ON ud.department_id = d.id
        WHERE f.organization_id = ?
        ORDER BY f.created_at DESC
        LIMIT ?
      `, [organizationId, limit])

      let success = 0
      let failed = 0

      for (const file of files) {
        // Get tags for this file
        const tags = await this.getFileTags(file.id)
        file.tags = tags

        // Prepare document
        const document = {
          file_id: file.id.toString(),
          organization_id: file.organization_id.toString(),
          title: file.name,
          content: file.description || file.ai_description || '',
          author: file.uploader_name || '',
          department: file.department_name || '',
          tags: file.tags,
          file_type: file.file_type,
          mime_type: file.mime_type,
          size_bytes: file.size_bytes,
          created_at: file.created_at,
          updated_at: file.updated_at,
          extracted_text: file.extracted_text || '',
          ocr_confidence: file.ocr_confidence || 0,
          language: 'en',
          visibility: file.visibility,
          folder_path: file.folder_path || ''
        }

        // Index document
        const result = await this.elasticsearchService.indexDocument(document)
        
        if (result) {
          success++
        } else {
          failed++
        }

        // Small delay to prevent overwhelming Elasticsearch
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Bulk indexing complete: ${success} success, ${failed} failed`)
      return { success, failed }
    } catch (error) {
      console.error('Bulk indexing error:', error)
      return { success: 0, failed: 0 }
    }
  }

  /**
   * Reindex all files for an organization
   */
  async reindexOrganization(organizationId: number): Promise<boolean> {
    try {
      console.log(`Starting full reindex for organization ${organizationId}...`)
      
      // Get total count
      const countResult = await executeQuery<{ count: number }>(`
        SELECT COUNT(*) as count FROM files WHERE organization_id = ?
      `, [organizationId])
      
      const totalFiles = countResult[0]?.count || 0
      console.log(`Found ${totalFiles} files to reindex`)

      if (totalFiles === 0) {
        return true
      }

      // Process in batches
      const batchSize = 50
      let processed = 0
      let totalSuccess = 0
      let totalFailed = 0

      while (processed < totalFiles) {
        const result = await this.bulkIndexFiles(organizationId, batchSize)
        totalSuccess += result.success
        totalFailed += result.failed
        processed += batchSize

        console.log(`Progress: ${Math.min(processed, totalFiles)}/${totalFiles} files processed`)
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      console.log(`Reindexing complete: ${totalSuccess} success, ${totalFailed} failed`)
      return totalFailed === 0
    } catch (error) {
      console.error('Reindexing error:', error)
      return false
    }
  }

  /**
   * Get file data with all related information for indexing
   */
  private async getFileDataForIndexing(fileId: number): Promise<FileIndexData | null> {
    try {
      const files = await executeQuery<FileIndexData>(`
        SELECT 
          f.id,
          f.name,
          f.file_type,
          f.mime_type,
          f.size_bytes,
          f.organization_id,
          f.uploaded_by,
          f.visibility,
          f.folder_path,
          f.description,
          f.ai_description,
          f.extracted_text,
          f.ocr_confidence,
          f.created_at,
          f.updated_at,
          COALESCE(oe.full_name, o.admin_full_name) as uploader_name,
          d.name as department_name
        FROM files f
        LEFT JOIN organization_employees oe ON f.uploaded_by = oe.id
        LEFT JOIN organizations o ON f.organization_id = o.id
        LEFT JOIN user_departments ud ON oe.id = ud.user_id AND ud.is_primary = 1
        LEFT JOIN departments d ON ud.department_id = d.id
        WHERE f.id = ?
      `, [fileId])

      if (files.length === 0) {
        return null
      }

      const file = files[0]
      
      // Get tags
      file.tags = await this.getFileTags(fileId)

      return file
    } catch (error) {
      console.error(`Error getting file data for indexing:`, error)
      return null
    }
  }

  /**
   * Get tags for a file
   */
  private async getFileTags(fileId: number): Promise<string[]> {
    try {
      const tags = await executeQuery<{ name: string }>(`
        SELECT t.name
        FROM tags t
        JOIN file_tags ft ON t.id = ft.tag_id
        WHERE ft.file_id = ?
      `, [fileId])

      return tags.map(tag => tag.name)
    } catch (error) {
      console.error(`Error getting tags for file ${fileId}:`, error)
      return []
    }
  }

  /**
   * Health check for search system
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    return await this.elasticsearchService.healthCheck()
  }
}

// Factory function
export function createSearchIntegrationService(): SearchIntegrationService {
  return new SearchIntegrationService()
}