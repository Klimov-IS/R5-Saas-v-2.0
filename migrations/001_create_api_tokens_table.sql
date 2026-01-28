-- Migration: Create api_tokens table for Chrome Extension authentication
-- Created: 2026-01-28
-- Description: Stores API tokens for Chrome Extension authentication with Bearer tokens

-- Create api_tokens table
CREATE TABLE IF NOT EXISTS api_tokens (
  id VARCHAR(255) PRIMARY KEY DEFAULT ('token_' || gen_random_uuid()::text),
  store_id VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  CONSTRAINT fk_api_tokens_store
    FOREIGN KEY (store_id)
    REFERENCES stores(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_store_id ON api_tokens(store_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_is_active ON api_tokens(is_active);

-- Add comment
COMMENT ON TABLE api_tokens IS 'API tokens for Chrome Extension authentication';
COMMENT ON COLUMN api_tokens.token IS 'Bearer token value (should be randomly generated, min 32 chars)';
COMMENT ON COLUMN api_tokens.name IS 'Human-readable name for token identification';
COMMENT ON COLUMN api_tokens.is_active IS 'Flag to disable token without deleting';
COMMENT ON COLUMN api_tokens.last_used_at IS 'Automatically updated on each API request';

-- Example: Generate a token for a store
-- INSERT INTO api_tokens (store_id, token, name)
-- VALUES (
--   'cm5abc123',
--   encode(gen_random_bytes(32), 'hex'),  -- 64-character random token
--   'Chrome Extension - Production'
-- );
