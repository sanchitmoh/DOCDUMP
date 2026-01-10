-- Add file access logs table for tracking recent views
CREATE TABLE IF NOT EXISTS file_access_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  organization_id INT NOT NULL,
  action ENUM('view', 'download', 'share') NOT NULL DEFAULT 'view',
  ip_address VARCHAR(45),
  user_agent TEXT,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_file_access_user_action (user_id, action, accessed_at DESC),
  INDEX idx_file_access_file (file_id, accessed_at DESC),
  INDEX idx_file_access_org (organization_id, accessed_at DESC),
  
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add last_viewed_at column to files table for quick access
ALTER TABLE files 
ADD COLUMN last_viewed_at TIMESTAMP NULL AFTER updated_at;

-- Add index for last_viewed_at
ALTER TABLE files 
ADD INDEX idx_files_last_viewed (organization_id, last_viewed_at DESC);