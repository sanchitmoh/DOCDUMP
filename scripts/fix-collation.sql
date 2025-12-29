-- Fix collation issues in the database
-- This script ensures all text columns use the same collation

-- Fix departments table
ALTER TABLE departments MODIFY COLUMN name VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE departments MODIFY COLUMN code VARCHAR(50) COLLATE utf8mb4_general_ci;
ALTER TABLE departments MODIFY COLUMN description TEXT COLLATE utf8mb4_general_ci;

-- Fix files table
ALTER TABLE files MODIFY COLUMN name VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE files MODIFY COLUMN original_name VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE files MODIFY COLUMN department VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE files MODIFY COLUMN description TEXT COLLATE utf8mb4_general_ci;
ALTER TABLE files MODIFY COLUMN ai_description TEXT COLLATE utf8mb4_general_ci;
ALTER TABLE files MODIFY COLUMN file_type VARCHAR(50) COLLATE utf8mb4_general_ci;
ALTER TABLE files MODIFY COLUMN mime_type VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE files MODIFY COLUMN visibility ENUM('private', 'org', 'public') COLLATE utf8mb4_general_ci;

-- Fix folders table
ALTER TABLE folders MODIFY COLUMN name VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE folders MODIFY COLUMN description TEXT COLLATE utf8mb4_general_ci;
ALTER TABLE folders MODIFY COLUMN department VARCHAR(255) COLLATE utf8mb4_general_ci;

-- Fix organizations table
ALTER TABLE organizations MODIFY COLUMN name VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE organizations MODIFY COLUMN domain VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE organizations MODIFY COLUMN description TEXT COLLATE utf8mb4_general_ci;

-- Fix organization_employees table
ALTER TABLE organization_employees MODIFY COLUMN full_name VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE organization_employees MODIFY COLUMN email VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE organization_employees MODIFY COLUMN department VARCHAR(255) COLLATE utf8mb4_general_ci;
ALTER TABLE organization_employees MODIFY COLUMN position VARCHAR(255) COLLATE utf8mb4_general_ci;

-- Fix extracted_text_content table
ALTER TABLE extracted_text_content MODIFY COLUMN content_type VARCHAR(50) COLLATE utf8mb4_general_ci;

-- Show current collations to verify
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    COLLATION_NAME
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND COLLATION_NAME IS NOT NULL 
    AND COLLATION_NAME != 'utf8mb4_general_ci'
ORDER BY TABLE_NAME, COLUMN_NAME;