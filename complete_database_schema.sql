create database Coprate_Digital_library
use Coprate_Digital_library

CREATE TABLE organizations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code CHAR(8) NOT NULL UNIQUE,
    admin_full_name VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    logo TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE (name)
);

-- Indexes
CREATE INDEX idx_org_email ON organizations(admin_email);
CREATE INDEX idx_org_code ON organizations(code);


CREATE TABLE organization_employees (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_employee_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    UNIQUE (organization_id, email)
);

-- Indexes
CREATE INDEX idx_emp_email ON organization_employees(email);
CREATE INDEX idx_emp_org_email ON organization_employees(organization_id, email);

ALTER TABLE organizations
  ADD COLUMN token_version INT NOT NULL DEFAULT 0;

ALTER TABLE organization_employees
  ADD COLUMN token_version INT NOT NULL DEFAULT 0;
 
 ALTER TABLE organizations
 ADD COLUMN status TINYINT(1) NOT NULL DEFAULT 1;
 
 ALTER TABLE organization_employees
 ADD COLUMN status TINYINT(1) NOT NULL DEFAULT 1;
 
 
 -- make sure DB has utf8mb4 & case-insensitive collation
-- CREATE DATABASE yourdb CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- FOLDERS (MySQL)
CREATE TABLE folders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by BIGINT NULL,                           -- references organization_employees
  department VARCHAR(100),                              -- optional department owning folder
  is_active TINYINT(1) NOT NULL DEFAULT 1,              -- soft active/inactive
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,             -- soft delete
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_folders_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_folders_creator FOREIGN KEY (created_by) REFERENCES organization_employees(id) ON DELETE SET NULL
);

-- enforce unique sibling folder names per organization (case-insensitive if DB collation is CI)
CREATE UNIQUE INDEX uq_folder_name ON folders (organization_id, parent_id, name);

CREATE INDEX idx_folders_org_parent ON folders (organization_id, parent_id);
CREATE INDEX idx_folders_createdby ON folders (created_by);


-- FILES (MySQL)
CREATE TABLE files (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  folder_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tags JSON DEFAULT NULL,               -- array of tags ["policy","invoice"]
  department VARCHAR(100) DEFAULT NULL,
  created_by BIGINT NULL,           -- employee who uploaded
  mime_type VARCHAR(255) DEFAULT NULL,
  file_type VARCHAR(100) DEFAULT NULL,  -- optional business type, e.g. "invoice", "policy"
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  size_hr VARCHAR(32) DEFAULT NULL,     -- human readable size (optional)
  storage_key VARCHAR(1000) NOT NULL,   -- S3 key / bucket:path
  file_url VARCHAR(1000) DEFAULT NULL,  -- last presigned/public URL (not authoritative)
  checksum_sha256 CHAR(64) DEFAULT NULL,
  ai_description TEXT DEFAULT NULL,     -- generated AI summary/tags
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  visibility ENUM('private','org','public') NOT NULL DEFAULT 'private',
  allow_download TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_files_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_files_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_files_creator FOREIGN KEY (created_by) REFERENCES organization_employees(id) ON DELETE SET NULL
);

-- Unique file name per folder (case-insensitive if collation CI)
CREATE UNIQUE INDEX uq_file_name ON files (folder_id, name);

-- Helpful indexes for queries
CREATE INDEX idx_files_org_folder ON files (organization_id, folder_id);
CREATE INDEX idx_files_createdby ON files (created_by);
CREATE INDEX idx_files_mime ON files (mime_type);
CREATE INDEX idx_files_size ON files (size_bytes);

-- Full-text index for search (requires MySQL InnoDB + fulltext support)
CREATE FULLTEXT INDEX ft_files_name_ai ON files (name, ai_description);


-- FILE TAGS normalized (optional but recommended for robust filtering)
CREATE TABLE file_tags (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  tag VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_filetags_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_file_tag (file_id, tag)
);
CREATE INDEX idx_filetags_tag ON file_tags(tag);


-- FILE VERSIONS (history + rollback)
CREATE TABLE file_versions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  version_number INT NOT NULL,
  storage_key VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(255) DEFAULT NULL,
  size_bytes BIGINT UNSIGNED DEFAULT 0,
  checksum_sha256 CHAR(64) DEFAULT NULL,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_file_versions_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT uq_file_version UNIQUE (file_id, version_number)
);
CREATE INDEX idx_file_versions_file ON file_versions(file_id);


-- FOLDER PERMISSIONS (folder-level ACL)
CREATE TABLE folder_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  folder_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  permission ENUM('read','write','admin') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_folderperm_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_folderperm_emp FOREIGN KEY (employee_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_folder_user (folder_id, employee_id)
);
CREATE INDEX idx_folderperm_emp ON folder_permissions(employee_id);


-- FILE PERMISSIONS (file-level ACL; overrides folder)
CREATE TABLE file_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  permission ENUM('read','write','owner') NOT NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fileperm_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_fileperm_emp FOREIGN KEY (employee_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_file_user (file_id, employee_id)
);
CREATE INDEX idx_fileperm_emp ON file_permissions(employee_id);


-- AUDIT LOGS (who did what and when)
CREATE TABLE file_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  file_id BIGINT NULL,
  folder_id BIGINT NULL,
  employee_id BIGINT NULL,
  action VARCHAR(64) NOT NULL,         -- 'upload','download','delete','share',etc
  detail JSON DEFAULT NULL,             -- extra metadata (ip, user-agent, presigned url id)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX idx_audit_file ON file_audit_logs(file_id);
CREATE INDEX idx_audit_emp ON file_audit_logs(employee_id);

CREATE TABLE saved_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  folder_id BIGINT NULL,
  file_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Exactly one of folder_id or file_id must be non-NULL
  CHECK (
    (folder_id IS NOT NULL AND file_id IS NULL) OR
    (folder_id IS NULL AND file_id IS NOT NULL)
  ),

  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,

  UNIQUE KEY uq_saved_user_folder (user_id, folder_id),
  UNIQUE KEY uq_saved_user_file   (user_id, file_id)
);

CREATE INDEX idx_saved_user ON saved_items(user_id);
CREATE INDEX idx_saved_org ON saved_items(organization_id);

 
CREATE TABLE contributions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  folder_id BIGINT NULL,
  file_id BIGINT NULL,
  action ENUM('create','update','delete','share','upload','rename') NOT NULL,
  details JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Exactly one of folder_id or file_id must be non-NULL
  CHECK (
    (folder_id IS NOT NULL AND file_id IS NULL) OR
    (folder_id IS NULL AND file_id IS NOT NULL)
  ),

  CONSTRAINT fk_contrib_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_contrib_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_contrib_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_contrib_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_contrib_user ON contributions(user_id);
CREATE INDEX idx_contrib_org ON contributions(organization_id);
CREATE INDEX idx_contrib_folder ON contributions(folder_id);
CREATE INDEX idx_contrib_file ON contributions(file_id);


CREATE TABLE chat_conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,                 -- reference to employee/user
  organization_id BIGINT NOT NULL,
  title VARCHAR(255) DEFAULT NULL,
  summary TEXT DEFAULT NULL,
  metadata JSON DEFAULT NULL,              -- tags, labels, custom UI state
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_chatconv_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_chatconv_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_user ON chat_conversations (user_id, created_at);
CREATE INDEX idx_conversations_org ON chat_conversations (organization_id, created_at);
CREATE INDEX idx_conversations_pinned ON chat_conversations (user_id, is_pinned);
CREATE INDEX idx_conversations_archived ON chat_conversations (organization_id, is_archived);

CREATE TABLE chat_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_type ENUM('user','ai','system') NOT NULL,
  content LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_name VARCHAR(128) DEFAULT NULL,       -- e.g. "gpt-5-thinking-mini"
  model_version VARCHAR(64) DEFAULT NULL,     -- e.g. "2025-11-01"
  tokens_used INT DEFAULT NULL,
  response_time_ms INT DEFAULT NULL,
  cost_cents BIGINT DEFAULT NULL,              -- optional cost tracking in cents
  moderation_status ENUM('pending','clean','flagged') DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  error_code VARCHAR(64) DEFAULT NULL,

  -- Visualization / structured outputs
  visualization_type ENUM('none','chart','table','stats','image','multiview') DEFAULT 'none',
  visualization_json JSON DEFAULT NULL,        -- structured chart/table data (chart config + data)
  visualization_file_id BIGINT DEFAULT NULL,   -- points to files.id for generated images/plots
  streaming BOOLEAN NOT NULL DEFAULT 0,        -- true if message was streamed incrementally
  is_final BOOLEAN NOT NULL DEFAULT 1,         -- false until final chunk received

  CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_vis_file FOREIGN KEY (visualization_file_id) REFERENCES files(id) ON DELETE SET NULL
);
CREATE INDEX idx_messages_conversation ON chat_messages (conversation_id, created_at);
CREATE INDEX idx_messages_sender ON chat_messages (sender_type, created_at);
CREATE INDEX idx_messages_model ON chat_messages (model_name, created_at);
-- You can also add a JSON functional index on specific visualization JSON keys if needed

CREATE TABLE chat_message_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_message_attachment UNIQUE (message_id, file_id),
  CONSTRAINT fk_msg_attach_msg FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_attach_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_message ON chat_message_attachments (message_id);
CREATE INDEX idx_attachments_file ON chat_message_attachments (file_id);


CREATE TABLE chat_search_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  query VARCHAR(1000) NOT NULL,
  conversation_id BIGINT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_search_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_search_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_search_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE SET NULL
);

CREATE INDEX idx_search_history_user ON chat_search_history (user_id, created_at);
CREATE INDEX idx_search_history_org ON chat_search_history (organization_id, created_at);

CREATE TABLE chat_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  feedback_type ENUM('thumbs_up','thumbs_down','rating','report') NOT NULL,
  rating TINYINT NULL,                 -- 1..5 if type=rating
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_message_feedback UNIQUE (message_id, user_id),
  CONSTRAINT fk_feedback_message FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_message ON chat_feedback (message_id);
CREATE INDEX idx_feedback_user ON chat_feedback (user_id);


CREATE TABLE departments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  manager_id BIGINT NULL,          -- references organization_employees
  budget DECIMAL(15,2) DEFAULT NULL,
  headcount_limit INT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_dept_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES organization_employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE UNIQUE INDEX uq_dept_name ON departments (organization_id, name);
CREATE UNIQUE INDEX uq_dept_code ON departments (organization_id, code);
CREATE INDEX idx_dept_manager ON departments(manager_id);
CREATE INDEX idx_dept_parent ON departments(parent_id);


-- ---------- USER DEPARTMENTS ----------
CREATE TABLE user_departments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  role VARCHAR(50) DEFAULT NULL,
  start_date DATE DEFAULT (CURRENT_DATE),
  end_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_userdept_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_userdept_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT uq_user_dept UNIQUE (user_id, department_id, start_date),
  CONSTRAINT chk_user_dept_dates CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- DEPARTMENT PERMISSIONS ----------
CREATE TABLE department_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  department_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  permission_type ENUM('view','manage','admin','member') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_deptperm_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT fk_deptperm_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_dept_permission (department_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ---------- DEPARTMENT FOLDERS ----------
CREATE TABLE department_folders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  department_id BIGINT NOT NULL,
  folder_id BIGINT NOT NULL,
  access_level ENUM('read','write','admin') NOT NULL DEFAULT 'read',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_deptfolder_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT fk_deptfolder_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  UNIQUE KEY uq_dept_folder (department_id, folder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TABLE image_metadata (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,

  width INT NOT NULL,
  height INT NOT NULL,
  color_space ENUM('RGB','RGBA','CMYK','Grayscale','LAB','HSV','YCbCr') DEFAULT 'RGB',
  color_depth INT DEFAULT NULL,
  has_transparency TINYINT(1) DEFAULT 0,
  has_alpha_channel TINYINT(1) DEFAULT 0,

  format VARCHAR(50) NOT NULL,
  compression VARCHAR(50) DEFAULT NULL,
  quality INT DEFAULT NULL,
  dpi_x DECIMAL(8,2) DEFAULT NULL,
  dpi_y DECIMAL(8,2) DEFAULT NULL,
  orientation ENUM('landscape','portrait','square','unknown') DEFAULT 'unknown',

  camera_make VARCHAR(100) DEFAULT NULL,
  camera_model VARCHAR(100) DEFAULT NULL,
  lens_model VARCHAR(255) DEFAULT NULL,
  focal_length DECIMAL(8,2) DEFAULT NULL,
  aperture DECIMAL(5,2) DEFAULT NULL,
  shutter_speed VARCHAR(50) DEFAULT NULL,
  iso_speed INT DEFAULT NULL,
  flash_used TINYINT(1) DEFAULT NULL,
  date_taken DATETIME DEFAULT NULL,

  gps_latitude DECIMAL(10,8) DEFAULT NULL,
  gps_longitude DECIMAL(11,8) DEFAULT NULL,
  gps_altitude DECIMAL(10,2) DEFAULT NULL,

  dominant_colors JSON DEFAULT NULL,
  is_photograph TINYINT(1) DEFAULT NULL,
  has_faces TINYINT(1) DEFAULT NULL,
  face_count INT DEFAULT NULL,
  has_text TINYINT(1) DEFAULT NULL,

  thumbnail_url VARCHAR(1000) DEFAULT NULL,
  thumbnail_width INT DEFAULT NULL,
  thumbnail_height INT DEFAULT NULL,
  preview_url VARCHAR(1000) DEFAULT NULL,

  exif_data_json JSON DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_image_metadata_file FOREIGN KEY (file_id)
      REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_image_metadata_file (file_id)
);

CREATE INDEX idx_image_file ON image_metadata(file_id);
CREATE INDEX idx_image_dimensions ON image_metadata(width, height);
CREATE INDEX idx_image_camera ON image_metadata(camera_make, camera_model);
CREATE INDEX idx_image_date_taken ON image_metadata(date_taken);
CREATE INDEX idx_image_format ON image_metadata(format);


CREATE TABLE video_metadata (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,

  duration_seconds DECIMAL(10,3) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  aspect_ratio VARCHAR(10) DEFAULT NULL,
  frame_rate DECIMAL(8,3) DEFAULT NULL,
  total_frames BIGINT DEFAULT NULL,

  video_codec VARCHAR(50) DEFAULT NULL,
  video_codec_profile VARCHAR(50) DEFAULT NULL,
  video_bitrate INT DEFAULT NULL,
  video_bitrate_mode ENUM('CBR','VBR','ABR') DEFAULT NULL,

  has_audio TINYINT(1) DEFAULT 1,
  audio_codec VARCHAR(50) DEFAULT NULL,
  audio_bitrate INT DEFAULT NULL,
  audio_sample_rate INT DEFAULT NULL,
  audio_channels INT DEFAULT NULL,
  audio_channel_layout VARCHAR(50) DEFAULT NULL,
  audio_bit_depth INT DEFAULT NULL,

  has_subtitles TINYINT(1) DEFAULT 0,
  subtitle_tracks JSON DEFAULT NULL,
  has_captions TINYINT(1) DEFAULT 0,

  container_format VARCHAR(50) DEFAULT NULL,
  file_size_bytes BIGINT DEFAULT NULL,

  resolution_category ENUM('SD','HD','FullHD','2K','4K','8K','other') DEFAULT NULL,
  is_hdr TINYINT(1) DEFAULT 0,
  color_space VARCHAR(50) DEFAULT NULL,

  thumbnail_url VARCHAR(1000) DEFAULT NULL,
  thumbnail_count INT DEFAULT NULL,
  preview_url VARCHAR(1000) DEFAULT NULL,
  preview_duration_seconds INT DEFAULT NULL,

  title VARCHAR(500) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  creation_date DATETIME DEFAULT NULL,
  author VARCHAR(255) DEFAULT NULL,

  custom_metadata JSON DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_video_metadata_file FOREIGN KEY (file_id)
      REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_video_metadata_file (file_id)
);

CREATE INDEX idx_video_file ON video_metadata(file_id);
CREATE INDEX idx_video_codec ON video_metadata(video_codec);
CREATE INDEX idx_video_resolution ON video_metadata(width, height);
CREATE INDEX idx_video_duration ON video_metadata(duration_seconds);
CREATE INDEX idx_video_resolution_category ON video_metadata(resolution_category);

CREATE TABLE audio_metadata (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,

  duration_seconds DECIMAL(10,3) NOT NULL,

  bitrate INT DEFAULT NULL,
  sample_rate INT DEFAULT NULL,
  channels INT DEFAULT NULL,
  channel_layout VARCHAR(50) DEFAULT NULL,
  bit_depth INT DEFAULT NULL,

  codec VARCHAR(50) DEFAULT NULL,
  codec_profile VARCHAR(50) DEFAULT NULL,
  compression_ratio DECIMAL(5,2) DEFAULT NULL,
  is_lossless TINYINT(1) DEFAULT 0,

  title VARCHAR(500) DEFAULT NULL,
  artist VARCHAR(255) DEFAULT NULL,
  album VARCHAR(255) DEFAULT NULL,
  album_artist VARCHAR(255) DEFAULT NULL,
  genre VARCHAR(100) DEFAULT NULL,
  year INT DEFAULT NULL,
  track_number INT DEFAULT NULL,
  total_tracks INT DEFAULT NULL,
  disc_number INT DEFAULT NULL,
  composer VARCHAR(255) DEFAULT NULL,
  lyricist VARCHAR(255) DEFAULT NULL,

  comment TEXT DEFAULT NULL,
  copyright VARCHAR(255) DEFAULT NULL,
  publisher VARCHAR(255) DEFAULT NULL,
  bpm INT DEFAULT NULL,
  `key` VARCHAR(10) DEFAULT NULL,

  has_album_art TINYINT(1) DEFAULT 0,
  album_art_url VARCHAR(1000) DEFAULT NULL,
  album_art_mime_type VARCHAR(100) DEFAULT NULL,

  has_lyrics TINYINT(1) DEFAULT NULL,
  lyrics TEXT DEFAULT NULL,
  language VARCHAR(10) DEFAULT NULL,

  replaygain_track_gain DECIMAL(6,2) DEFAULT NULL,
  replaygain_album_gain DECIMAL(6,2) DEFAULT NULL,

  full_metadata_json JSON DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_audio_metadata_file FOREIGN KEY (file_id)
      REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_audio_metadata_file (file_id)
);

CREATE INDEX idx_audio_file ON audio_metadata(file_id);
CREATE INDEX idx_audio_codec ON audio_metadata(codec);
CREATE INDEX idx_audio_artist ON audio_metadata(artist);
CREATE INDEX idx_audio_album ON audio_metadata(album);
CREATE INDEX idx_audio_genre ON audio_metadata(genre);
CREATE INDEX idx_audio_year ON audio_metadata(year);

CREATE FULLTEXT INDEX ft_audio_title ON audio_metadata(title);
CREATE FULLTEXT INDEX ft_audio_album ON audio_metadata(album);

CREATE TABLE multimedia_processing_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,

  processing_type ENUM('thumbnail','preview','transcode','extract_metadata','analyze','ocr') NOT NULL,
  status ENUM('pending','processing','completed','failed','cancelled') DEFAULT 'pending',

  priority INT DEFAULT 5,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  error_message TEXT DEFAULT NULL,
  error_code VARCHAR(100) DEFAULT NULL,

  processing_options JSON DEFAULT NULL,
  output_files JSON DEFAULT NULL,

  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_multimedia_job_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_multimedia_job_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_multimedia_job_file ON multimedia_processing_jobs(file_id);
CREATE INDEX idx_multimedia_job_status ON multimedia_processing_jobs(status);
CREATE INDEX idx_multimedia_job_priority ON multimedia_processing_jobs(priority, created_at);


CREATE TABLE multimedia_thumbnails (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,

  thumbnail_type ENUM('image','video','audio_art','document_preview') NOT NULL,
  size_category ENUM('small','medium','large','original') DEFAULT 'medium',

  width INT DEFAULT NULL,
  height INT DEFAULT NULL,

  storage_key VARCHAR(1000) NOT NULL,
  storage_url VARCHAR(1000) DEFAULT NULL,

  file_size_bytes BIGINT DEFAULT NULL,
  format VARCHAR(50) DEFAULT NULL,
  quality INT DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_thumbnail_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_thumbnail_file ON multimedia_thumbnails(file_id);
CREATE INDEX idx_thumbnail_type ON multimedia_thumbnails(thumbnail_type);
CREATE INDEX idx_thumbnail_size ON multimedia_thumbnails(size_category);


CREATE TABLE storage_configurations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,

  storage_type ENUM('s3','local','hybrid') NOT NULL DEFAULT 's3',
  is_active TINYINT(1) NOT NULL DEFAULT 1,

  -- =========================
  -- S3 CONFIGURATION
  -- =========================
  s3_bucket_name VARCHAR(255) DEFAULT NULL,
  s3_region VARCHAR(50) DEFAULT NULL,
  s3_access_key_id VARCHAR(255) DEFAULT NULL,        -- encrypted at app level
  s3_secret_access_key VARCHAR(500) DEFAULT NULL,    -- encrypted at app level
  s3_endpoint_url VARCHAR(500) DEFAULT NULL,
  s3_use_path_style TINYINT(1) DEFAULT 0,
  s3_encryption_type ENUM('none','AES256','aws:kms') DEFAULT 'AES256',
  s3_kms_key_id VARCHAR(255) DEFAULT NULL,

  -- =========================
  -- LOCAL / OFFLINE STORAGE
  -- =========================
  local_storage_path VARCHAR(1000) DEFAULT NULL,
  local_backup_enabled TINYINT(1) DEFAULT 0,
  local_backup_path VARCHAR(1000) DEFAULT NULL,

  -- =========================
  -- HYBRID MODE
  -- =========================
  hybrid_primary_storage ENUM('s3','local') DEFAULT 's3',
  hybrid_sync_enabled TINYINT(1) DEFAULT 0,
  hybrid_sync_interval_minutes INT DEFAULT 60,

  -- =========================
  -- LIMITS & POLICIES
  -- =========================
  max_file_size_bytes BIGINT UNSIGNED DEFAULT 10737418240,
  allowed_mime_types JSON DEFAULT NULL,
  storage_quota_bytes BIGINT UNSIGNED DEFAULT NULL,
  storage_used_bytes BIGINT UNSIGNED DEFAULT 0,

  -- =========================
  -- LIFECYCLE MANAGEMENT
  -- =========================
  auto_delete_after_days INT DEFAULT NULL,
  transition_to_glacier_days INT DEFAULT NULL,
  transition_to_deep_archive_days INT DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- =========================
  -- CONSTRAINTS
  -- =========================
  CONSTRAINT fk_storage_config_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_storage_config_org UNIQUE (organization_id),

  CONSTRAINT chk_hybrid_interval
    CHECK (hybrid_sync_interval_minutes > 0),

  CONSTRAINT chk_quota_positive
    CHECK (storage_quota_bytes IS NULL OR storage_quota_bytes > 0),

  CONSTRAINT chk_json_mime_types
    CHECK (allowed_mime_types IS NULL OR JSON_VALID(allowed_mime_types))
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;
-- Lookup active storage per org (MOST COMMON QUERY)
CREATE INDEX idx_storage_org_active
  ON storage_configurations (organization_id, is_active);

-- Admin dashboards & filters
CREATE INDEX idx_storage_type
  ON storage_configurations (storage_type);

-- Hybrid sync scheduler
CREATE INDEX idx_storage_hybrid_sync
  ON storage_configurations (hybrid_sync_enabled, hybrid_sync_interval_minutes);

CREATE INDEX idx_storage_config_type ON storage_configurations(storage_type);
CREATE INDEX idx_storage_config_active ON storage_configurations(is_active);


ALTER TABLE files
  ADD COLUMN storage_mode ENUM('remote','offline','hybrid') NOT NULL DEFAULT 'remote',
  ADD COLUMN storage_provider ENUM('s3','local','s3_compatible') NOT NULL DEFAULT 's3',

  ADD COLUMN s3_bucket VARCHAR(255) DEFAULT NULL,
  ADD COLUMN s3_key VARCHAR(1000) DEFAULT NULL,
  ADD COLUMN s3_region VARCHAR(50) DEFAULT NULL,

  ADD COLUMN local_path VARCHAR(1000) DEFAULT NULL,

  ADD COLUMN presigned_url VARCHAR(2000) DEFAULT NULL,
  ADD COLUMN presigned_url_expires_at TIMESTAMP NULL DEFAULT NULL,

  ADD COLUMN storage_config_id BIGINT DEFAULT NULL,

  ADD CONSTRAINT fk_files_storage_config
    FOREIGN KEY (storage_config_id)
    REFERENCES storage_configurations(id)
    ON DELETE SET NULL;

CREATE INDEX idx_files_storage_mode ON files(storage_mode);
CREATE INDEX idx_files_storage_provider ON files(storage_provider);
CREATE INDEX idx_files_s3_bucket ON files(s3_bucket);
CREATE INDEX idx_files_s3_key ON files(s3_key(255));
CREATE INDEX idx_files_local_path ON files(local_path(255));
CREATE INDEX idx_files_storage_config ON files(storage_config_id);


CREATE TABLE file_storage_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,

  storage_type ENUM('s3','local','s3_compatible','cdn') NOT NULL,
  storage_provider VARCHAR(100),
  location_path VARCHAR(1000) NOT NULL,

  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  is_backup TINYINT(1) NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,

  storage_class VARCHAR(50),
  checksum_sha256 CHAR(64),
  size_bytes BIGINT UNSIGNED,

  metadata JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_storage_loc_file
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
CREATE INDEX idx_storage_loc_file ON file_storage_locations(file_id);
CREATE INDEX idx_storage_loc_type ON file_storage_locations(storage_type);
CREATE INDEX idx_storage_loc_primary ON file_storage_locations(file_id, is_primary);
CREATE INDEX idx_storage_loc_backup ON file_storage_locations(is_backup);

CREATE TABLE storage_sync_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  file_id BIGINT NULL,  -- NULL = full org sync

  sync_type ENUM('full','incremental','file') NOT NULL,
  source_storage ENUM('s3','local') NOT NULL,
  target_storage ENUM('s3','local') NOT NULL,

  status ENUM('pending','running','completed','failed','cancelled')
         NOT NULL DEFAULT 'pending',

  progress_percent TINYINT UNSIGNED DEFAULT 0 CHECK (progress_percent <= 100),
  files_processed INT UNSIGNED DEFAULT 0,
  files_total INT UNSIGNED DEFAULT NULL,

  error_message TEXT DEFAULT NULL,

  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_sync_job_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

  CONSTRAINT fk_sync_job_file
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
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

ALTER TABLE storage_usage_stats
ADD COLUMN updated_at TIMESTAMP
DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE TABLE presigned_url_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,

  url_type ENUM('download','upload','thumbnail','preview') NOT NULL DEFAULT 'download',
  presigned_url VARCHAR(2000) NOT NULL,
  expires_at TIMESTAMP NOT NULL,

  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_presigned_org FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,

  CONSTRAINT fk_presigned_file FOREIGN KEY (file_id)
    REFERENCES files(id) ON DELETE CASCADE,

  CONSTRAINT uq_presigned_file_type UNIQUE (file_id, url_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_presigned_org ON presigned_url_cache(organization_id);
CREATE INDEX idx_presigned_file ON presigned_url_cache(file_id);
CREATE INDEX idx_presigned_expires ON presigned_url_cache(expires_at);
CREATE INDEX idx_presigned_type ON presigned_url_cache(url_type);
CREATE INDEX idx_presigned_active ON presigned_url_cache(is_active);


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

-- ============================================
-- TEXT EXTRACTION & INDEXING SCHEMA
-- ============================================
-- Schema for tracking text extraction from various file types
-- Supports PDF, DOCX, images (OCR), and other document formats

-- TEXT EXTRACTION JOBS
CREATE TABLE text_extraction_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  status ENUM('pending','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  extraction_method ENUM('tesseract','pytesseract','pdfplumber','pdfminer','docx','pptx','xlsx','textract','custom') NOT NULL,
  priority INT DEFAULT 5,  -- 1-10, higher = more priority
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  error_message TEXT DEFAULT NULL,
  error_code VARCHAR(100) DEFAULT NULL,
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_extraction_job_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_extraction_job_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_extraction_job_file ON text_extraction_jobs(file_id);
CREATE INDEX idx_extraction_job_status ON text_extraction_jobs(status);
CREATE INDEX idx_extraction_job_org ON text_extraction_jobs(organization_id);
CREATE INDEX idx_extraction_job_priority ON text_extraction_jobs(priority DESC, created_at);


CREATE TABLE extracted_text_content (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  extraction_job_id BIGINT NULL,

  content_type ENUM('full_text','page','section','ocr','metadata')
    NOT NULL DEFAULT 'full_text',

  page_number INT DEFAULT NULL,
  section_name VARCHAR(255) DEFAULT NULL,

  extracted_text LONGTEXT NOT NULL,
  text_hash CHAR(64) DEFAULT NULL,

  language VARCHAR(10) DEFAULT NULL,
  confidence_score DECIMAL(5,2) DEFAULT NULL,

  word_count INT DEFAULT NULL,
  character_count INT DEFAULT NULL,

  extraction_metadata JSON DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Safe uniqueness handling
  page_number_safe INT
    GENERATED ALWAYS AS (IFNULL(page_number, -1)) STORED,

  CONSTRAINT fk_extracted_text_file
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,

  CONSTRAINT fk_extracted_text_job
    FOREIGN KEY (extraction_job_id)
    REFERENCES text_extraction_jobs(id) ON DELETE SET NULL,

  UNIQUE KEY uq_extracted_text_file_page
    (file_id, page_number_safe, content_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_extracted_text_file ON extracted_text_content(file_id);
CREATE INDEX idx_extracted_text_job ON extracted_text_content(extraction_job_id);
CREATE INDEX idx_extracted_text_type ON extracted_text_content(content_type);
CREATE FULLTEXT INDEX ft_extracted_text ON extracted_text_content(extracted_text);

ALTER TABLE text_extraction_jobs
ADD CONSTRAINT chk_extraction_priority CHECK (priority BETWEEN 1 AND 10);

ALTER TABLE storage_sync_jobs
ADD COLUMN triggered_by BIGINT NULL,
ADD CONSTRAINT fk_sync_job_emp
FOREIGN KEY (triggered_by) REFERENCES organization_employees(id) ON DELETE SET NULL;

CREATE INDEX idx_storage_op_employee ON storage_operations_log(employee_id);

-- DOCUMENT METADATA (PDF, DOCX, etc.)
CREATE TABLE document_metadata (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  document_type ENUM('pdf','docx','pptx','xlsx','odt','rtf','txt','html','markdown') NOT NULL,
  
  -- Common metadata
  title VARCHAR(500) DEFAULT NULL,
  author VARCHAR(255) DEFAULT NULL,
  subject VARCHAR(500) DEFAULT NULL,
  keywords TEXT DEFAULT NULL,
  creator VARCHAR(255) DEFAULT NULL,  -- application that created the document
  producer VARCHAR(255) DEFAULT NULL,  -- tool that produced the PDF
  created_date DATETIME DEFAULT NULL,
  modified_date DATETIME DEFAULT NULL,
  
  -- Document structure
  page_count INT DEFAULT NULL,
  word_count INT DEFAULT NULL,
  character_count INT DEFAULT NULL,
  paragraph_count INT DEFAULT NULL,
  has_images TINYINT(1) DEFAULT 0,
  has_tables TINYINT(1) DEFAULT 0,
  has_forms TINYINT(1) DEFAULT 0,
  has_links TINYINT(1) DEFAULT 0,
  has_bookmarks TINYINT(1) DEFAULT 0,
  
  -- Security
  is_encrypted TINYINT(1) DEFAULT 0,
  is_password_protected TINYINT(1) DEFAULT 0,
  encryption_method VARCHAR(100) DEFAULT NULL,
  permissions_allowed JSON DEFAULT NULL,  -- printing, copying, etc.
  
  -- PDF-specific
  pdf_version VARCHAR(10) DEFAULT NULL,
  pdf_linearized TINYINT(1) DEFAULT 0,
  
  -- Additional metadata (JSON for flexibility)
  custom_metadata JSON DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_doc_metadata_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_doc_metadata_file (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_doc_metadata_file ON document_metadata(file_id);
CREATE INDEX idx_doc_metadata_type ON document_metadata(document_type);
CREATE INDEX idx_doc_metadata_author ON document_metadata(author);
CREATE FULLTEXT INDEX ft_doc_metadata_title ON document_metadata(title);
CREATE FULLTEXT INDEX ft_doc_metadata_subject ON document_metadata(subject);

CREATE INDEX idx_doc_encrypted ON document_metadata(is_encrypted);


-- OCR RESULTS (for images and scanned documents)
CREATE TABLE ocr_results (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  extraction_job_id BIGINT NULL,
  ocr_engine ENUM('tesseract','aws_textract','google_vision','azure_vision','custom') NOT NULL DEFAULT 'tesseract',
  language VARCHAR(10) DEFAULT 'en',  -- ISO 639-1
  confidence_score DECIMAL(5,2) DEFAULT NULL,  -- overall confidence 0-100
  word_count INT DEFAULT NULL,
  detected_text_regions INT DEFAULT NULL,  -- number of text regions detected
  processing_time_ms INT DEFAULT NULL,
  ocr_text LONGTEXT DEFAULT NULL,  -- full OCR text
  ocr_data_json JSON DEFAULT NULL,  -- structured OCR data (bounding boxes, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_ocr_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_ocr_job FOREIGN KEY (extraction_job_id) REFERENCES text_extraction_jobs(id) ON DELETE SET NULL,
  UNIQUE KEY uq_ocr_file_engine (file_id, ocr_engine)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_ocr_file ON ocr_results(file_id);
CREATE INDEX idx_ocr_engine ON ocr_results(ocr_engine);
CREATE INDEX idx_ocr_language ON ocr_results(language);
CREATE FULLTEXT INDEX ft_ocr_text ON ocr_results(ocr_text);

-- TEXT EXTRACTION STATISTICS
CREATE TABLE text_extraction_stats (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  file_id BIGINT NULL,  -- null = organization-level stats
  extraction_method VARCHAR(50) NOT NULL,
  total_extractions INT DEFAULT 0,
  successful_extractions INT DEFAULT 0,
  failed_extractions INT DEFAULT 0,
  average_confidence DECIMAL(5,2) DEFAULT NULL,
  average_processing_time_ms INT DEFAULT NULL,
  total_text_extracted BIGINT DEFAULT 0,  -- total characters extracted
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_extraction_stats_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_extraction_stats_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_extraction_stats_org ON text_extraction_stats(organization_id);
CREATE INDEX idx_extraction_stats_file ON text_extraction_stats(file_id);
CREATE INDEX idx_extraction_stats_period ON text_extraction_stats(period_start, period_end);


ALTER TABLE text_extraction_stats
ADD CONSTRAINT chk_extraction_stats_period
CHECK (period_end >= period_start);

CREATE INDEX idx_doc_metadata_created_date
ON document_metadata(created_date);

ALTER TABLE text_extraction_stats
ADD COLUMN locked_at TIMESTAMP NULL,
ADD COLUMN locked_by VARCHAR(100) NULL;


-- SEARCH INDEX STATUS (tracks Elasticsearch indexing)
CREATE TABLE search_index_status (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  index_name VARCHAR(255) NOT NULL DEFAULT 'files',
  index_status ENUM('pending','indexing','indexed','failed','needs_reindex') NOT NULL DEFAULT 'pending',
  index_version INT DEFAULT 1,
  indexed_at TIMESTAMP NULL DEFAULT NULL,
  last_indexed_at TIMESTAMP NULL DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  document_id VARCHAR(255) DEFAULT NULL,  -- Elasticsearch document ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_index_status_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_index_status_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_index_status_file_index (file_id, index_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_index_status_file ON search_index_status(file_id);
CREATE INDEX idx_index_status_org ON search_index_status(organization_id);
CREATE INDEX idx_index_status_status ON search_index_status(index_status);
CREATE INDEX idx_index_status_index_name ON search_index_status(index_name);
CREATE INDEX idx_index_status_reindex
ON search_index_status(index_status, organization_id);

CREATE FULLTEXT INDEX ft_doc_keywords ON document_metadata(keywords);
CREATE INDEX idx_extraction_job_file_status
ON text_extraction_jobs(file_id, status);

ALTER TABLE presigned_url_cache
ADD UNIQUE KEY uq_presigned_active (file_id, url_type, expires_at);


ALTER TABLE organization_employees
  DROP COLUMN department,
  ADD COLUMN department_id BIGINT NULL,
  ADD CONSTRAINT fk_emp_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE SET NULL;