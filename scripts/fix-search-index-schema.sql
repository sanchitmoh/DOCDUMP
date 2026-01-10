-- Add missing retry_count column to search_index_status table
ALTER TABLE search_index_status 
ADD COLUMN retry_count INT DEFAULT 0;

-- Add index for performance
CREATE INDEX idx_search_index_retry_count ON search_index_status (retry_count);

-- Update existing records to have retry_count = 0
UPDATE search_index_status SET retry_count = 0 WHERE retry_count IS NULL;