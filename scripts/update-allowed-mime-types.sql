-- Update storage configurations to allow video, audio, and additional file types
-- This script adds support for multimedia files to the existing storage configuration

UPDATE storage_configurations 
SET allowed_mime_types = JSON_ARRAY(
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
)
WHERE allowed_mime_types IS NOT NULL;

-- Show updated configurations
SELECT 
  id,
  organization_id,
  allowed_mime_types,
  max_file_size_bytes,
  updated_at
FROM storage_configurations;