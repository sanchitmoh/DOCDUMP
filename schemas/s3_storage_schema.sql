-- ============================================
-- S3 STORAGE SCHEMA - Remote & Offline Support
-- ============================================
-- This schema extends the files table to support Amazon S3 storage
-- with both remote (S3) and offline/local storage modes

-- STORAGE CONFIGURATIONS (per organization)
CREATE TABLE storage_configurations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  storage_type ENUM('s3','local','hybrid') NOT NULL DEFAULT 's3',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  
  -- S3 Configuration
  s3_bucket_name VARCHAR(255) DEFAULT NULL,
  s3_region VARCHAR(50) DEFAULT NULL,
  s3_access_key_id VARCHAR(255) DEFAULT NULL,  -- encrypted in app
  s3_secret_access_key VARCHAR(500) DEFAULT NULL,  -- encrypted in app
  s3_endpoint_url VARCHAR(500) DEFAULT NULL,  -- for S3-compatible services
  s3_use_path_style TINYINT(1) DEFAULT 0,
  s3_encryption_type ENUM('none','AES256','aws:kms') DEFAULT 'AES256',
  s3_kms_key_id VARCHAR(255) DEFAULT NULL,
  
  -- Local/Offline Configuration
  local_storage_path VARCHAR(1000) DEFAULT NULL,  -- base path for local storage
  local_backup_enabled TINYINT(1) DEFAULT 0,
  local_backup_path VARCHAR(1000) DEFAULT NULL,
  
  -- Hybrid Mode Settings
  hybrid_primary_storage ENUM('s3','local') DEFAULT 's3',
  hybrid_sync_enabled TINYINT(1) DEFAULT 0,
  hybrid_sync_interval_minutes INT DEFAULT 60,
  
  -- Storage Limits & Policies
  max_file_size_bytes BIGINT UNSIGNED DEFAULT 10737418240,  -- 10GB default
  allowed_mime_types JSON DEFAULT NULL,  -- null = all allowed
  storage_quota_bytes BIGINT UNSIGNED DEFAULT NULL,
  storage_used_bytes BIGINT UNSIGNED DEFAULT 0,
  
  -- Lifecycle & Retention
  auto_delete_after_days INT DEFAULT NULL,  -- null = never
  transition_to_glacier_days INT DEFAULT NULL,  -- S3 lifecycle
  transition_to_deep_archive_days INT DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_storage_config_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_storage_config_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_storage_config_type ON storage_configurations(storage_type);
CREATE INDEX idx_storage_config_active ON storage_configurations(is_active);


-- ENHANCED FILES TABLE - Add storage mode columns
ALTER TABLE files
  ADD COLUMN storage_mode ENUM('remote','offline','hybrid') NOT NULL DEFAULT 'remote',
  ADD COLUMN storage_provider ENUM('s3','local','s3_compatible') NOT NULL DEFAULT 's3',
  ADD COLUMN s3_bucket VARCHAR(255) DEFAULT NULL,
  ADD COLUMN s3_key VARCHAR(1000) DEFAULT NULL,  -- full S3 object key
  ADD COLUMN s3_region VARCHAR(50) DEFAULT NULL,
  ADD COLUMN s3_version_id VARCHAR(255) DEFAULT NULL,  -- S3 versioning
  ADD COLUMN s3_etag VARCHAR(255) DEFAULT NULL,
  ADD COLUMN s3_storage_class ENUM('STANDARD','STANDARD_IA','ONEZONE_IA','INTELLIGENT_TIERING','GLACIER','DEEP_ARCHIVE','REDUCED_REDUNDANCY') DEFAULT 'STANDARD',
  ADD COLUMN local_path VARCHAR(1000) DEFAULT NULL,  -- for offline/local storage
  ADD COLUMN local_backup_path VARCHAR(1000) DEFAULT NULL,
  ADD COLUMN is_synced TINYINT(1) NOT NULL DEFAULT 1,  -- sync status for hybrid mode
  ADD COLUMN last_sync_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN sync_error TEXT DEFAULT NULL,
  ADD COLUMN presigned_url VARCHAR(2000) DEFAULT NULL,
  ADD COLUMN presigned_url_expires_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN cdn_url VARCHAR(1000) DEFAULT NULL,  -- CloudFront or CDN URL
  ADD COLUMN thumbnail_url VARCHAR(1000) DEFAULT NULL,  -- thumbnail/preview URL
  ADD COLUMN storage_config_id BIGINT DEFAULT NULL,
  
  ADD CONSTRAINT fk_files_storage_config FOREIGN KEY (storage_config_id) REFERENCES storage_configurations(id) ON DELETE SET NULL;

CREATE INDEX idx_files_storage_mode ON files(storage_mode);
CREATE INDEX idx_files_storage_provider ON files(storage_provider);
CREATE INDEX idx_files_s3_bucket ON files(s3_bucket);
CREATE INDEX idx_files_s3_key ON files(s3_key(255));  -- prefix index
CREATE INDEX idx_files_local_path ON files(local_path(255));
CREATE INDEX idx_files_synced ON files(is_synced);
CREATE INDEX idx_files_storage_config ON files(storage_config_id);


-- FILE STORAGE LOCATIONS (tracks multiple storage locations for redundancy)
CREATE TABLE file_storage_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  storage_type ENUM('s3','local','s3_compatible','cdn') NOT NULL,
  storage_provider VARCHAR(100) DEFAULT NULL,  -- 'aws-s3', 'minio', 'local-fs', etc.
  location_path VARCHAR(1000) NOT NULL,  -- S3 key, local path, or CDN URL
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  is_backup TINYINT(1) NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  storage_class VARCHAR(50) DEFAULT NULL,  -- S3 storage class
  checksum_sha256 CHAR(64) DEFAULT NULL,
  size_bytes BIGINT UNSIGNED DEFAULT 0,
  metadata JSON DEFAULT NULL,  -- provider-specific metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_storage_loc_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_storage_loc_file ON file_storage_locations(file_id);
CREATE INDEX idx_storage_loc_type ON file_storage_locations(storage_type);
CREATE INDEX idx_storage_loc_primary ON file_storage_locations(file_id, is_primary);
CREATE INDEX idx_storage_loc_backup ON file_storage_locations(is_backup);


-- STORAGE SYNC JOBS (for hybrid mode synchronization)
CREATE TABLE storage_sync_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  file_id BIGINT NULL,  -- null = full sync
  sync_type ENUM('full','incremental','file') NOT NULL,
  source_storage ENUM('s3','local') NOT NULL,
  target_storage ENUM('s3','local') NOT NULL,
  status ENUM('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  progress_percent INT DEFAULT 0,
  files_processed INT DEFAULT 0,
  files_total INT DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_sync_job_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_sync_job_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_sync_job_org ON storage_sync_jobs(organization_id);
CREATE INDEX idx_sync_job_file ON storage_sync_jobs(file_id);
CREATE INDEX idx_sync_job_status ON storage_sync_jobs(status);
CREATE INDEX idx_sync_job_created ON storage_sync_jobs(created_at);


-- STORAGE USAGE TRACKING (per organization)
CREATE TABLE storage_usage_stats (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  storage_type ENUM('s3','local','total') NOT NULL,
  total_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_count INT NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  calculated_date DATE NOT NULL,  -- for daily snapshots
  
  CONSTRAINT fk_storage_usage_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_storage_usage_org_date_type (organization_id, calculated_date, storage_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_storage_usage_org ON storage_usage_stats(organization_id);
CREATE INDEX idx_storage_usage_date ON storage_usage_stats(calculated_date);


-- PRESIGNED URL CACHE (for S3 presigned URLs)
CREATE TABLE presigned_url_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  url_type ENUM('download','upload','thumbnail','preview') NOT NULL DEFAULT 'download',
  presigned_url VARCHAR(2000) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_presigned_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_presigned_file ON presigned_url_cache(file_id);
CREATE INDEX idx_presigned_expires ON presigned_url_cache(expires_at);
CREATE INDEX idx_presigned_type ON presigned_url_cache(url_type);


-- STORAGE OPERATIONS LOG (audit trail for storage operations)
CREATE TABLE storage_operations_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  file_id BIGINT NULL,
  operation_type ENUM('upload','download','delete','copy','move','sync','restore') NOT NULL,
  storage_type ENUM('s3','local','hybrid') NOT NULL,
  source_location VARCHAR(1000) DEFAULT NULL,
  target_location VARCHAR(1000) DEFAULT NULL,
  status ENUM('success','failed','partial') NOT NULL,
  bytes_transferred BIGINT UNSIGNED DEFAULT NULL,
  duration_ms INT DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  employee_id BIGINT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_storage_op_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_storage_op_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
  CONSTRAINT fk_storage_op_emp FOREIGN KEY (employee_id) REFERENCES organization_employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_storage_op_org ON storage_operations_log(organization_id);
CREATE INDEX idx_storage_op_file ON storage_operations_log(file_id);
CREATE INDEX idx_storage_op_type ON storage_operations_log(operation_type);
CREATE INDEX idx_storage_op_status ON storage_operations_log(status);
CREATE INDEX idx_storage_op_created ON storage_operations_log(created_at);


