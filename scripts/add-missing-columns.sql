-- Add missing columns to files table for view/download tracking
ALTER TABLE files 
ADD COLUMN view_count INT UNSIGNED DEFAULT 0,
ADD COLUMN download_count INT UNSIGNED DEFAULT 0,
ADD COLUMN last_viewed_at TIMESTAMP NULL,
ADD COLUMN last_downloaded_at TIMESTAMP NULL;

-- Add indexes for performance
CREATE INDEX idx_files_view_count ON files (view_count);
CREATE INDEX idx_files_download_count ON files (download_count);
CREATE INDEX idx_files_last_viewed ON files (last_viewed_at);
CREATE INDEX idx_files_last_downloaded ON files (last_downloaded_at);

-- Create AI generated content table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_generated_content (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  content_type ENUM('summary', 'description', 'tags', 'keywords') NOT NULL,
  content TEXT NOT NULL,
  generated_by BIGINT NULL,
  model_used VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_ai_content_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_content_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_content_user FOREIGN KEY (generated_by) REFERENCES organization_employees(id) ON DELETE SET NULL,
  
  UNIQUE KEY uq_ai_content_file_type (file_id, content_type)
);

CREATE INDEX idx_ai_content_org ON ai_generated_content (organization_id);
CREATE INDEX idx_ai_content_type ON ai_generated_content (content_type);