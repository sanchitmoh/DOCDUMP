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


-- EXTRACTED TEXT CONTENT
CREATE TABLE extracted_text_content (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  extraction_job_id BIGINT NULL,
  content_type ENUM('full_text','page','section','ocr','metadata') NOT NULL DEFAULT 'full_text',
  page_number INT DEFAULT NULL,  -- for multi-page documents
  section_name VARCHAR(255) DEFAULT NULL,
  extracted_text LONGTEXT NOT NULL,  -- actual extracted text
  text_hash CHAR(64) DEFAULT NULL,  -- SHA256 hash of text for deduplication
  language VARCHAR(10) DEFAULT NULL,  -- ISO 639-1 code (en, es, etc.)
  confidence_score DECIMAL(5,2) DEFAULT NULL,  -- 0-100, for OCR confidence
  word_count INT DEFAULT NULL,
  character_count INT DEFAULT NULL,
  extraction_metadata JSON DEFAULT NULL,  -- method-specific metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_extracted_text_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_extracted_text_job FOREIGN KEY (extraction_job_id) REFERENCES text_extraction_jobs(id) ON DELETE SET NULL,
  UNIQUE KEY uq_extracted_text_file_page (file_id, page_number, content_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_extracted_text_file ON extracted_text_content(file_id);
CREATE INDEX idx_extracted_text_job ON extracted_text_content(extraction_job_id);
CREATE INDEX idx_extracted_text_type ON extracted_text_content(content_type);
CREATE INDEX idx_extracted_text_page ON extracted_text_content(file_id, page_number);
CREATE FULLTEXT INDEX ft_extracted_text ON extracted_text_content(extracted_text);


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


