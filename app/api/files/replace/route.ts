import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { executeQuery, executeSingle } from '@/lib/database'
import { createFileService } from '@/lib/services/file-service'
import { createDocumentProcessor } from '@/lib/processing/document-processor'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication failed' }, { status: 401 })
    }

    const { userId, organizationId, type: userType } = auth.user

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileId = formData.get('fileId') as string

    if (!file || !fileId) {
      return NextResponse.json({ error: 'File and fileId are required' }, { status: 400 })
    }

    // Verify file ownership or organization admin access
    const existingFiles = await executeQuery(`
      SELECT 
        f.id,
        f.name,
        f.storage_key,
        f.storage_provider,
        f.created_by,
        f.organization_id,
        f.file_type,
        f.mime_type,
        f.size_bytes,
        f.folder_id,
        f.department
      FROM files f
      WHERE f.id = ? AND f.organization_id = ?
    `, [fileId, organizationId])

    if (existingFiles.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const existingFile = existingFiles[0]
    
    // Check permissions
    if (userType !== 'organization' && existingFile.created_by !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get file details
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name
    const fileSize = file.size
    const mimeType = file.type
    const fileExtension = path.extname(fileName).toLowerCase().substring(1)
    
    // Determine file type
    const fileTypeMap: { [key: string]: string } = {
      'pdf': 'pdf',
      'doc': 'document',
      'docx': 'document',
      'txt': 'document',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'mp4': 'video',
      'avi': 'video',
      'mov': 'video',
      'mp3': 'audio',
      'wav': 'audio',
      'xlsx': 'spreadsheet',
      'xls': 'spreadsheet',
      'csv': 'spreadsheet',
      'pptx': 'presentation',
      'ppt': 'presentation'
    }
    const fileType = fileTypeMap[fileExtension] || 'other'

    // Archive the old file (create a backup record)
    await executeSingle(`
      INSERT INTO file_versions (
        file_id,
        version_number,
        storage_key,
        mime_type,
        size_bytes,
        checksum_sha256,
        created_by,
        created_at
      )
      SELECT 
        id,
        COALESCE((SELECT MAX(version_number) FROM file_versions WHERE file_id = ?), 0) + 1,
        storage_key,
        mime_type,
        size_bytes,
        checksum_sha256,
        ?,
        NOW()
      FROM files
      WHERE id = ?
    `, [fileId, userId, fileId])

    // Upload new file using FileService
    const fileService = createFileService()
    const uploadResult = await fileService.uploadFile({
      file: fileBuffer,
      fileName: fileName,
      mimeType: mimeType,
      organizationId: organizationId,
      uploadedBy: userId,
      folderId: existingFile.folder_id || 1,
      department: existingFile.department || null,
      tags: [],
      visibility: 'org'
    })

    if (!uploadResult.success || !uploadResult.file) {
      return NextResponse.json({ 
        error: 'Failed to upload new file: ' + (uploadResult.error || 'Unknown error')
      }, { status: 500 })
    }

    const newFile = uploadResult.file

    // Update file record with new file details
    await executeSingle(`
      UPDATE files 
      SET 
        name = ?,
        storage_key = ?,
        storage_provider = ?,
        size_bytes = ?,
        mime_type = ?,
        file_type = ?,
        checksum_sha256 = ?,
        updated_at = NOW(),
        updated_by = ?
      WHERE id = ?
    `, [
      fileName,
      newFile.storage_key,
      newFile.storage_provider,
      fileSize,
      mimeType,
      fileType,
      newFile.checksum_sha256,
      userId,
      fileId
    ])

    // Trigger background processing for the new file
    try {
      const documentProcessor = createDocumentProcessor()
      await documentProcessor.processDocument(parseInt(fileId))
    } catch (processingError) {
      console.error('Background processing error:', processingError)
      // Don't fail the request if processing fails
    }

    // Log the replacement action
    await executeSingle(`
      INSERT INTO file_audit_logs (
        file_id,
        employee_id,
        action,
        details,
        created_at
      ) VALUES (?, ?, 'replace', ?, NOW())
    `, [
      fileId,
      userId,
      JSON.stringify({
        old_file: existingFile.name,
        new_file: fileName,
        old_size: existingFile.size_bytes,
        new_size: fileSize
      })
    ])

    return NextResponse.json({
      success: true,
      message: 'File replaced successfully',
      file: {
        id: fileId,
        name: fileName,
        size: fileSize,
        type: fileType,
        mimeType: mimeType
      }
    })

  } catch (error) {
    console.error('File replacement error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to replace file'
    }, { status: 500 })
  }
}
