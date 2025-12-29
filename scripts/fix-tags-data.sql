-- Fix invalid JSON data in tags field
-- Convert comma-separated strings to proper JSON arrays

-- First, let's see what we have
SELECT id, name, tags FROM files WHERE tags IS NOT NULL AND tags != '' LIMIT 10;

-- Update comma-separated tags to JSON format
UPDATE files 
SET tags = CONCAT('["', REPLACE(REPLACE(tags, '"', ''), ',', '","'), '"]')
WHERE tags IS NOT NULL 
  AND tags != '' 
  AND tags NOT LIKE '[%'  -- Don't update if already JSON array format
  AND tags NOT LIKE '{%'; -- Don't update if already JSON object format

-- Verify the changes
SELECT id, name, tags FROM files WHERE tags IS NOT NULL AND tags != '' LIMIT 10;