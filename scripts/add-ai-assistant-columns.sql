-- Add AI Assistant columns and tables to existing MySQL database
-- These support the enhanced AI analytics features

-- Add AI columns to existing files table (with error handling)
-- Check and add ai_processed column
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND column_name = 'ai_processed') = 0,
  'ALTER TABLE files ADD COLUMN ai_processed BOOLEAN DEFAULT FALSE',
  'SELECT "ai_processed column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ai_summary column
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND column_name = 'ai_summary') = 0,
  'ALTER TABLE files ADD COLUMN ai_summary TEXT',
  'SELECT "ai_summary column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ai_insights column
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND column_name = 'ai_insights') = 0,
  'ALTER TABLE files ADD COLUMN ai_insights JSON',
  'SELECT "ai_insights column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ai_suggested_questions column
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND column_name = 'ai_suggested_questions') = 0,
  'ALTER TABLE files ADD COLUMN ai_suggested_questions JSON',
  'SELECT "ai_suggested_questions column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ai_data_type column
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND column_name = 'ai_data_type') = 0,
  'ALTER TABLE files ADD COLUMN ai_data_type VARCHAR(50)',
  'SELECT "ai_data_type column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ready_for_analysis column
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND column_name = 'ready_for_analysis') = 0,
  'ALTER TABLE files ADD COLUMN ready_for_analysis BOOLEAN DEFAULT FALSE',
  'SELECT "ready_for_analysis column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ai_processed_at column
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND column_name = 'ai_processed_at') = 0,
  'ALTER TABLE files ADD COLUMN ai_processed_at TIMESTAMP NULL',
  'SELECT "ai_processed_at column already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create AI conversation history table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  messages JSON NOT NULL,
  document_ids JSON,
  insights JSON,
  context_type ENUM('HR', 'Sales', 'Finance', 'General') DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_ai_conv_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_conv_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE
);

-- Create indexes for ai_conversations
CREATE INDEX IF NOT EXISTS idx_ai_conv_user_org ON ai_conversations(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_org_updated ON ai_conversations(organization_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_conv_id ON ai_conversations(conversation_id);

-- Create AI document summaries table (replaces MongoDB document summaries)
CREATE TABLE IF NOT EXISTS ai_document_summaries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  key_insights JSON,
  embedding_vector JSON, -- Store embedding as JSON array
  data_type ENUM('sales', 'financial', 'hr', 'operational', 'mixed') DEFAULT 'mixed',
  metrics JSON, -- Store calculated metrics
  trends JSON, -- Store trend analysis
  anomalies JSON, -- Store detected anomalies
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_ai_doc_sum_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_doc_sum_file FOREIGN KEY (document_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Create indexes for ai_document_summaries
CREATE INDEX IF NOT EXISTS idx_ai_doc_sum_org ON ai_document_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_doc_sum_type ON ai_document_summaries(data_type);
CREATE INDEX IF NOT EXISTS idx_ai_doc_sum_created ON ai_document_summaries(created_at);

-- Create unique constraint for ai_document_summaries
ALTER TABLE ai_document_summaries ADD CONSTRAINT uq_ai_doc_summary UNIQUE (document_id, organization_id);

-- Create AI analytics cache table (for performance)
CREATE TABLE IF NOT EXISTS ai_analytics_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL,
  organization_id BIGINT NOT NULL,
  query_hash VARCHAR(64) NOT NULL, -- SHA256 hash of query parameters
  result_data JSON NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_ai_cache_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create indexes for ai_analytics_cache
CREATE INDEX IF NOT EXISTS idx_ai_cache_org_expires ON ai_analytics_cache(organization_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_analytics_cache(query_hash);

-- Create unique constraint for ai_analytics_cache
ALTER TABLE ai_analytics_cache ADD CONSTRAINT uq_ai_cache_key UNIQUE (cache_key, organization_id);

-- Create AI embeddings cache table (replaces Redis embeddings)
CREATE TABLE IF NOT EXISTS ai_embeddings_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  text_hash VARCHAR(64) NOT NULL, -- SHA256 hash of text
  embedding_vector JSON NOT NULL, -- Store as JSON array
  model_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Create indexes for ai_embeddings_cache
CREATE INDEX IF NOT EXISTS idx_ai_embedding_expires ON ai_embeddings_cache(expires_at);

-- Create unique constraint for ai_embeddings_cache
ALTER TABLE ai_embeddings_cache ADD CONSTRAINT uq_ai_embedding_hash UNIQUE (text_hash, model_name);

-- Create AI rate limiting table (replaces Redis rate limiting)
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  
  CONSTRAINT fk_ai_rate_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_rate_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE
);

-- Create indexes for ai_rate_limits
CREATE INDEX IF NOT EXISTS idx_ai_rate_window ON ai_rate_limits(window_end);

-- Create unique constraint for ai_rate_limits
ALTER TABLE ai_rate_limits ADD CONSTRAINT uq_ai_rate_user_window UNIQUE (user_id, organization_id, window_start);

-- Create indexes for AI queries on files table
CREATE INDEX IF NOT EXISTS idx_files_ai_processed ON files(ai_processed, organization_id);
CREATE INDEX IF NOT EXISTS idx_files_ready_for_analysis ON files(ready_for_analysis, organization_id);
CREATE INDEX IF NOT EXISTS idx_files_ai_data_type ON files(ai_data_type);
CREATE INDEX IF NOT EXISTS idx_files_ai_processed_at ON files(ai_processed_at);

-- Add fulltext index for AI search (check if it exists first)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.statistics 
   WHERE table_schema = DATABASE() AND table_name = 'files' AND index_name = 'ft_files_ai_search') = 0,
  'ALTER TABLE files ADD FULLTEXT INDEX ft_files_ai_search (name, ai_summary, ai_description)',
  'SELECT "Fulltext index already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'AI Assistant MySQL database setup completed successfully' as result;