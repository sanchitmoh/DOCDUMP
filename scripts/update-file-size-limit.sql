-- Update storage configurations to increase file size limit for video files
-- This script increases the max file size from 100MB to 500MB

UPDATE storage_configurations 
SET max_file_size_bytes = 524288000  -- 500MB
WHERE max_file_size_bytes = 104857600;  -- Only update if it's currently 100MB

-- Show updated configurations
SELECT 
  id,
  organization_id,
  ROUND(max_file_size_bytes / 1024 / 1024) as max_file_size_mb,
  updated_at
FROM storage_configurations;