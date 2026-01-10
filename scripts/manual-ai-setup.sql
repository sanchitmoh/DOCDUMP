-- Manual AI Assistant Setup for MySQL
-- Run these commands one by one in your MySQL client

-- Step 1: Add AI columns to files table
-- (Run each ALTER TABLE command separately)

ALTER TABLE files ADD COLUMN ai_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN ai_summary TEXT;
ALTER TABLE files ADD COLUMN ai_insights JSON;
ALTER TABLE files ADD COLUMN ai_suggested_questions JSON;
ALTER TABLE files ADD COLUMN ai_data_type VARCHAR(50);
ALTER TABLE files ADD COLUMN ready_for_analysis BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN ai_processed_at TIMESTAMP NULL;

-- Step 2: Create AI conversations table
CREATE TABLE ai_conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  messages JSON NOT NULL,
  document_ids JSON,
  insights JSON,
  context_type ENUM('HR', 'Sales', 'Finance', 'General') DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Step 3: Create AI document summaries table
CREATE TABLE ai_document_summaries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  key_insights JSON,
  embedding_vector JSON,
  data_type ENUM('sales', 'financial', 'hr', 'operational', 'mixed') DEFAULT 'mixed',
  metrics JSON,
  trends JSON,
  anomalies JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Step 4: Create AI analytics cache table
CREATE TABLE ai_analytics_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL,
  organization_id BIGINT NOT NULL,
  query_hash VARCHAR(64) NOT NULL,
  result_data JSON NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Create AI embeddings cache table
CREATE TABLE ai_embeddings_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  text_hash VARCHAR(64) NOT NULL,
  embedding_vector JSON NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Step 6: Create AI rate limits table
CREATE TABLE ai_rate_limits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL
);

-- Step 7: Add foreign key constraints
ALTER TABLE ai_conversations ADD CONSTRAINT fk_ai_conv_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ai_conversations ADD CONSTRAINT fk_ai_conv_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE;

ALTER TABLE ai_document_summaries ADD CONSTRAINT fk_ai_doc_sum_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ai_document_summaries ADD CONSTRAINT fk_ai_doc_sum_file FOREIGN KEY (document_id) REFERENCES files(id) ON DELETE CASCADE;

ALTER TABLE ai_analytics_cache ADD CONSTRAINT fk_ai_cache_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE ai_rate_limits ADD CONSTRAINT fk_ai_rate_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ai_rate_limits ADD CONSTRAINT fk_ai_rate_user FOREIGN KEY (user_id) REFERENCES organization_employees(id) ON DELETE CASCADE;

-- Step 8: Add unique constraints
ALTER TABLE ai_document_summaries ADD CONSTRAINT uq_ai_doc_summary UNIQUE (document_id, organization_id);
ALTER TABLE ai_analytics_cache ADD CONSTRAINT uq_ai_cache_key UNIQUE (cache_key, organization_id);
ALTER TABLE ai_embeddings_cache ADD CONSTRAINT uq_ai_embedding_hash UNIQUE (text_hash, model_name);
ALTER TABLE ai_rate_limits ADD CONSTRAINT uq_ai_rate_user_window UNIQUE (user_id, organization_id, window_start);

-- Step 9: Create indexes for performance
CREATE INDEX idx_ai_conv_user_org ON ai_conversations(user_id, organization_id);
CREATE INDEX idx_ai_conv_org_updated ON ai_conversations(organization_id, updated_at);
CREATE INDEX idx_ai_conv_id ON ai_conversations(conversation_id);

CREATE INDEX idx_ai_doc_sum_org ON ai_document_summaries(organization_id);
CREATE INDEX idx_ai_doc_sum_type ON ai_document_summaries(data_type);
CREATE INDEX idx_ai_doc_sum_created ON ai_document_summaries(created_at);

CREATE INDEX idx_ai_cache_org_expires ON ai_analytics_cache(organization_id, expires_at);
CREATE INDEX idx_ai_cache_hash ON ai_analytics_cache(query_hash);

CREATE INDEX idx_ai_embedding_expires ON ai_embeddings_cache(expires_at);
CREATE INDEX idx_ai_rate_window ON ai_rate_limits(window_end);

CREATE INDEX idx_files_ai_processed ON files(ai_processed, organization_id);
CREATE INDEX idx_files_ready_for_analysis ON files(ready_for_analysis, organization_id);
CREATE INDEX idx_files_ai_data_type ON files(ai_data_type);
CREATE INDEX idx_files_ai_processed_at ON files(ai_processed_at);

-- Step 10: Add fulltext index for AI search
ALTER TABLE files ADD FULLTEXT INDEX ft_files_ai_search (name, ai_summary, ai_description);

-- Step 11: Verify setup
SELECT 'AI Assistant MySQL setup completed successfully!' as result;

-- Check what was created
SHOW TABLES LIKE 'ai_%';
DESCRIBE files;