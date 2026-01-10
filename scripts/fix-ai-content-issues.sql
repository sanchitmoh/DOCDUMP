-- Fix AI content issues
-- 1. Add 'analysis' to the content_type ENUM
ALTER TABLE ai_generated_content 
MODIFY COLUMN content_type ENUM('summary', 'description', 'tags', 'keywords', 'analysis') NOT NULL;

-- 2. Check existing data and fix any orphaned records
SELECT 'Checking for orphaned ai_generated_content records...' as status;
SELECT COUNT(*) as orphaned_records 
FROM ai_generated_content 
WHERE generated_by NOT IN (SELECT id FROM organization_employees);

-- 3. Update orphaned records to use a valid user ID or set to NULL
UPDATE ai_generated_content 
SET generated_by = NULL 
WHERE generated_by NOT IN (SELECT id FROM organization_employees);

SELECT 'Fixed orphaned records by setting generated_by to NULL' as status;