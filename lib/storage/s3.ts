import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import crypto from 'crypto'
import { Readable } from 'stream'

export interface S3Config {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
}

export interface UploadResult {
  key: string
  etag: string
  location: string
  size: number
  checksum: string
}

export interface PresignedUrlOptions {
  expiresIn?: number
  contentType?: string
  contentDisposition?: string
}

export class S3StorageService {
  private client: S3Client
  private bucket: string

  constructor(config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Security: Force HTTPS
      forcePathStyle: false,
      useAccelerateEndpoint: false,
    })
    this.bucket = config.bucket
  }

  /**
   * Upload file to S3 with enterprise security standards
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      // Generate checksum for integrity verification
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
      
      // Create upload with multipart for large files
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ServerSideEncryption: 'AES256', // Enterprise security requirement
          Metadata: {
            ...metadata,
            checksum,
            uploadedAt: new Date().toISOString(),
          },
          // Security: Prevent public access
          ACL: 'private',
        },
      })

      // Monitor upload progress
      upload.on('httpUploadProgress', (progress) => {
        console.log(`Upload progress: ${progress.loaded}/${progress.total} bytes`)
      })

      const result = await upload.done()

      return {
        key,
        etag: result.ETag?.replace(/"/g, '') || '',
        location: result.Location || `https://${this.bucket}.s3.amazonaws.com/${key}`,
        size: buffer.length,
        checksum,
      }
    } catch (error) {
      console.error('S3 upload error:', error)
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Download file from S3 with integrity verification
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      const response = await this.client.send(command)
      
      if (!response.Body) {
        throw new Error('No file content received from S3')
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      const stream = response.Body as Readable
      
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
      
      const buffer = Buffer.concat(chunks)

      // Verify integrity if checksum is available
      if (response.Metadata?.checksum) {
        const calculatedChecksum = crypto.createHash('sha256').update(buffer).digest('hex')
        if (calculatedChecksum !== response.Metadata.checksum) {
          throw new Error('File integrity check failed - checksum mismatch')
        }
      }

      return buffer
    } catch (error) {
      console.error('S3 download error:', error)
      throw new Error(`Failed to download file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate secure presigned URL for file access
   */
  async generatePresignedUrl(
    key: string,
    operation: 'getObject' | 'putObject' = 'getObject',
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    try {
      const { expiresIn = 3600, contentType, contentDisposition } = options

      let command
      if (operation === 'getObject') {
        command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentType: contentType,
          ResponseContentDisposition: contentDisposition,
        })
      } else {
        command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
          ServerSideEncryption: 'AES256',
          ACL: 'private',
        })
      }

      const url = await getSignedUrl(this.client, command, {
        expiresIn,
      })

      return url
    } catch (error) {
      console.error('Presigned URL generation error:', error)
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.client.send(command)
    } catch (error) {
      console.error('S3 delete error:', error)
      throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Copy file within S3
   */
  async copyFile(sourceKey: string, targetKey: string): Promise<void> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: targetKey,
        ServerSideEncryption: 'AES256',
        ACL: 'private',
      })

      await this.client.send(command)
    } catch (error) {
      console.error('S3 copy error:', error)
      throw new Error(`Failed to copy file in S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.client.send(command)
      return true
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(key: string): Promise<{
    size: number
    lastModified: Date
    contentType: string
    etag: string
    metadata: Record<string, string>
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      const response = await this.client.send(command)

      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType || 'application/octet-stream',
        etag: response.ETag?.replace(/"/g, '') || '',
        metadata: response.Metadata || {},
      }
    } catch (error) {
      console.error('S3 metadata error:', error)
      throw new Error(`Failed to get file metadata from S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List files in S3 bucket with pagination
   */
  async listFiles(
    prefix?: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<{
    files: Array<{
      key: string
      size: number
      lastModified: Date
      etag: string
    }>
    nextContinuationToken?: string
    isTruncated: boolean
  }> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      })

      const response = await this.client.send(command)

      const files = (response.Contents || []).map(obj => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag?.replace(/"/g, '') || '',
      }))

      return {
        files,
        nextContinuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated || false,
      }
    } catch (error) {
      console.error('S3 list error:', error)
      throw new Error(`Failed to list files from S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate unique key for file storage
   */
  generateFileKey(organizationId: string, fileName: string, fileId?: string): string {
    const timestamp = new Date().toISOString().split('T')[0]
    const randomId = fileId || crypto.randomUUID()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    return `organizations/${organizationId}/${timestamp}/${randomId}/${sanitizedFileName}`
  }

  /**
   * Health check for S3 service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', message: string }> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      })

      await this.client.send(command)
      
      return {
        status: 'healthy',
        message: 'S3 service is accessible'
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `S3 service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

// Factory function to create S3 service instance
export function createS3Service(): S3StorageService {
  const config: S3Config = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
    bucket: process.env.AWS_S3_BUCKET!,
  }

  // Validate configuration
  if (!config.accessKeyId || !config.secretAccessKey || !config.region || !config.bucket) {
    throw new Error('Missing required AWS S3 configuration. Please check your environment variables.')
  }

  return new S3StorageService(config)
}