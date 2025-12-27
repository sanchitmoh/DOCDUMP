-- ============================================
-- MULTIMEDIA METADATA SCHEMA
-- ============================================
-- Schema for storing metadata for images, videos, and audio files
-- Supports EXIF, video codecs, audio tags, and more

-- IMAGE METADATA
CREATE TABLE image_metadata (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  
  -- Basic image properties
  width INT NOT NULL,
  height INT NOT NULL,
  color_space ENUM('RGB','RGBA','CMYK','Grayscale','LAB','HSV','YCbCr') DEFAULT 'RGB',
  color_depth INT DEFAULT NULL,  -- bits per channel
  has_transparency TINYINT(1) DEFAULT 0,
  has_alpha_channel TINYINT(1) DEFAULT 0,
  
  -- Image format details
  format VARCHAR(50) NOT NULL,  -- JPEG, PNG, GIF, WEBP, TIFF, etc.
  compression VARCHAR(50) DEFAULT NULL,
  quality INT DEFAULT NULL,  -- 0-100 for JPEG
  dpi_x DECIMAL(8,2) DEFAULT NULL,
  dpi_y DECIMAL(8,2) DEFAULT NULL,
  orientation ENUM('landscape','portrait','square','unknown') DEFAULT NULL,
  
  -- EXIF data (common fields)
  camera_make VARCHAR(100) DEFAULT NULL,
  camera_model VARCHAR(100) DEFAULT NULL,
  lens_model VARCHAR(255) DEFAULT NULL,
  focal_length DECIMAL(8,2) DEFAULT NULL,
  aperture DECIMAL(5,2) DEFAULT NULL,  -- f-stop
  shutter_speed VARCHAR(50) DEFAULT NULL,
  iso_speed INT DEFAULT NULL,
  flash_used TINYINT(1) DEFAULT NULL,
  date_taken DATETIME DEFAULT NULL,
  gps_latitude DECIMAL(10,8) DEFAULT NULL,
  gps_longitude DECIMAL(11,8) DEFAULT NULL,
  gps_altitude DECIMAL(10,2) DEFAULT NULL,
  
  -- Image analysis
  dominant_colors JSON DEFAULT NULL,  -- array of hex colors
  is_photograph TINYINT(1) DEFAULT NULL,  -- vs illustration/drawing
  has_faces TINYINT(1) DEFAULT NULL,
  face_count INT DEFAULT NULL,
  has_text TINYINT(1) DEFAULT NULL,  -- text in image
  
  -- Thumbnails & previews
  thumbnail_url VARCHAR(1000) DEFAULT NULL,
  thumbnail_width INT DEFAULT NULL,
  thumbnail_height INT DEFAULT NULL,
  preview_url VARCHAR(1000) DEFAULT NULL,
  
  -- Full EXIF data (stored as JSON for flexibility)
  exif_data_json JSON DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_image_metadata_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_image_metadata_file (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_image_metadata_file ON image_metadata(file_id);
CREATE INDEX idx_image_metadata_format ON image_metadata(format);
CREATE INDEX idx_image_metadata_dimensions ON image_metadata(width, height);
CREATE INDEX idx_image_metadata_camera ON image_metadata(camera_make, camera_model);
CREATE INDEX idx_image_metadata_date_taken ON image_metadata(date_taken);


-- VIDEO METADATA
CREATE TABLE video_metadata (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  
  -- Basic video properties
  duration_seconds DECIMAL(10,3) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  aspect_ratio VARCHAR(10) DEFAULT NULL,  -- e.g., "16:9", "4:3"
  frame_rate DECIMAL(8,3) DEFAULT NULL,  -- fps
  total_frames BIGINT DEFAULT NULL,
  
  -- Video codec
  video_codec VARCHAR(50) DEFAULT NULL,  -- H.264, H.265, VP9, AV1, etc.
  video_codec_profile VARCHAR(50) DEFAULT NULL,
  video_bitrate INT DEFAULT NULL,  -- bits per second
  video_bitrate_mode ENUM('CBR','VBR','ABR') DEFAULT NULL,
  
  -- Audio track(s)
  has_audio TINYINT(1) DEFAULT 1,
  audio_codec VARCHAR(50) DEFAULT NULL,  -- AAC, MP3, AC3, Opus, etc.
  audio_bitrate INT DEFAULT NULL,
  audio_sample_rate INT DEFAULT NULL,  -- Hz
  audio_channels INT DEFAULT NULL,  -- 1=mono, 2=stereo, 6=5.1, etc.
  audio_channel_layout VARCHAR(50) DEFAULT NULL,  -- mono, stereo, 5.1, etc.
  audio_bit_depth INT DEFAULT NULL,
  
  -- Subtitles & captions
  has_subtitles TINYINT(1) DEFAULT 0,
  subtitle_tracks JSON DEFAULT NULL,  -- array of subtitle track info
  has_captions TINYINT(1) DEFAULT 0,
  
  -- Container format
  container_format VARCHAR(50) DEFAULT NULL,  -- MP4, MKV, AVI, WebM, etc.
  file_size_bytes BIGINT DEFAULT NULL,
  
  -- Video quality indicators
  resolution_category ENUM('SD','HD','FullHD','2K','4K','8K','other') DEFAULT NULL,
  is_hdr TINYINT(1) DEFAULT 0,
  color_space VARCHAR(50) DEFAULT NULL,
  
  -- Thumbnails & previews
  thumbnail_url VARCHAR(1000) DEFAULT NULL,
  thumbnail_count INT DEFAULT NULL,
  preview_url VARCHAR(1000) DEFAULT NULL,
  preview_duration_seconds INT DEFAULT NULL,
  
  -- Metadata
  title VARCHAR(500) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  creation_date DATETIME DEFAULT NULL,
  author VARCHAR(255) DEFAULT NULL,
  
  -- Additional metadata
  custom_metadata JSON DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_video_metadata_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_video_metadata_file (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_video_metadata_file ON video_metadata(file_id);
CREATE INDEX idx_video_metadata_codec ON video_metadata(video_codec);
CREATE INDEX idx_video_metadata_resolution ON video_metadata(width, height);
CREATE INDEX idx_video_metadata_duration ON video_metadata(duration_seconds);
CREATE INDEX idx_video_metadata_resolution_category ON video_metadata(resolution_category);


-- AUDIO METADATA
CREATE TABLE audio_metadata (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  
  -- Basic audio properties
  duration_seconds DECIMAL(10,3) NOT NULL,
  bitrate INT DEFAULT NULL,  -- bits per second
  sample_rate INT DEFAULT NULL,  -- Hz (44100, 48000, etc.)
  channels INT DEFAULT NULL,  -- 1=mono, 2=stereo, etc.
  channel_layout VARCHAR(50) DEFAULT NULL,  -- mono, stereo, 5.1, etc.
  bit_depth INT DEFAULT NULL,  -- 16, 24, 32 bits
  
  -- Audio codec
  codec VARCHAR(50) DEFAULT NULL,  -- MP3, AAC, FLAC, Opus, Vorbis, etc.
  codec_profile VARCHAR(50) DEFAULT NULL,
  compression_ratio DECIMAL(5,2) DEFAULT NULL,
  is_lossless TINYINT(1) DEFAULT 0,
  
  -- ID3/MP3 tags (common metadata)
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
  
  -- Additional metadata
  comment TEXT DEFAULT NULL,
  copyright VARCHAR(255) DEFAULT NULL,
  publisher VARCHAR(255) DEFAULT NULL,
  bpm INT DEFAULT NULL,  -- beats per minute
  key VARCHAR(10) DEFAULT NULL,  -- musical key
  
  -- Album art
  has_album_art TINYINT(1) DEFAULT 0,
  album_art_url VARCHAR(1000) DEFAULT NULL,
  album_art_mime_type VARCHAR(100) DEFAULT NULL,
  
  -- Audio analysis
  has_lyrics TINYINT(1) DEFAULT NULL,
  lyrics TEXT DEFAULT NULL,
  language VARCHAR(10) DEFAULT NULL,
  
  -- ReplayGain (normalization)
  replaygain_track_gain DECIMAL(6,2) DEFAULT NULL,
  replaygain_album_gain DECIMAL(6,2) DEFAULT NULL,
  
  -- Full metadata (stored as JSON for flexibility)
  full_metadata_json JSON DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_audio_metadata_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_audio_metadata_file (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_audio_metadata_file ON audio_metadata(file_id);
CREATE INDEX idx_audio_metadata_codec ON audio_metadata(codec);
CREATE INDEX idx_audio_metadata_artist ON audio_metadata(artist);
CREATE INDEX idx_audio_metadata_album ON audio_metadata(album);
CREATE INDEX idx_audio_metadata_genre ON audio_metadata(genre);
CREATE INDEX idx_audio_metadata_year ON audio_metadata(year);
CREATE FULLTEXT INDEX ft_audio_title ON audio_metadata(title);
CREATE FULLTEXT INDEX ft_audio_artist ON audio_metadata(artist);
CREATE FULLTEXT INDEX ft_audio_album ON audio_metadata(album);


-- MULTIMEDIA PROCESSING JOBS
CREATE TABLE multimedia_processing_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  processing_type ENUM('thumbnail','preview','transcode','extract_metadata','analyze','ocr') NOT NULL,
  status ENUM('pending','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  priority INT DEFAULT 5,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  error_message TEXT DEFAULT NULL,
  error_code VARCHAR(100) DEFAULT NULL,
  processing_options JSON DEFAULT NULL,  -- type-specific options
  output_files JSON DEFAULT NULL,  -- generated files (thumbnails, etc.)
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_multimedia_job_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_multimedia_job_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_multimedia_job_file ON multimedia_processing_jobs(file_id);
CREATE INDEX idx_multimedia_job_status ON multimedia_processing_jobs(status);
CREATE INDEX idx_multimedia_job_type ON multimedia_processing_jobs(processing_type);
CREATE INDEX idx_multimedia_job_priority ON multimedia_processing_jobs(priority DESC, created_at);


-- THUMBNAILS & PREVIEWS (generated files)
CREATE TABLE multimedia_thumbnails (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  thumbnail_type ENUM('image','video','audio_art','document_preview') NOT NULL,
  size_category ENUM('small','medium','large','original') DEFAULT 'medium',
  width INT DEFAULT NULL,
  height INT DEFAULT NULL,
  storage_key VARCHAR(1000) NOT NULL,  -- S3 key or local path
  storage_url VARCHAR(1000) DEFAULT NULL,
  file_size_bytes BIGINT DEFAULT NULL,
  format VARCHAR(50) DEFAULT NULL,  -- JPEG, PNG, etc.
  quality INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_thumbnail_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_thumbnail_file ON multimedia_thumbnails(file_id);
CREATE INDEX idx_thumbnail_type ON multimedia_thumbnails(thumbnail_type);
CREATE INDEX idx_thumbnail_size ON multimedia_thumbnails(size_category);


