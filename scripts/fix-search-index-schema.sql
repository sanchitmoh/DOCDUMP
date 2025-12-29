-- Fix search_index_status table schema
-- Add missing retry_count column

ALTER TABLE search_index_status 
ADD COLUMN retry_count INT DEFAULT 0 AFTER error_message;

-- Update existing records to have retry_count = 0
UPDATE search_index_status 
SET retry_count = 0 
WHERE retry_count IS NULL;

-- Verify the schema
DESCRIBE search_index_status;