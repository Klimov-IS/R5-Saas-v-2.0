-- Migration: Create sync_logs table for tracking background sync operations
-- Date: 2026-01-18
-- Purpose: Track chat history sync progress and errors

CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  store_id VARCHAR(255),
  sync_type VARCHAR(50) NOT NULL, -- 'chat_history', 'reviews', etc.
  status VARCHAR(20) NOT NULL,     -- 'running', 'success', 'error'
  chats_total INTEGER DEFAULT 0,
  chats_synced INTEGER DEFAULT 0,
  messages_added INTEGER DEFAULT 0,
  chats_classified INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Indexes
  CONSTRAINT sync_logs_status_check CHECK (status IN ('running', 'success', 'error'))
);

-- Index for querying recent syncs
CREATE INDEX idx_sync_logs_store_type ON sync_logs(store_id, sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);

COMMENT ON TABLE sync_logs IS 'Tracks background synchronization operations (chat history, reviews, etc.)';
COMMENT ON COLUMN sync_logs.sync_type IS 'Type of sync: chat_history, reviews, products';
COMMENT ON COLUMN sync_logs.status IS 'Current status: running, success, error';
COMMENT ON COLUMN sync_logs.chats_total IS 'Total number of chats found in WB API';
COMMENT ON COLUMN sync_logs.chats_synced IS 'Number of chats successfully synced';
COMMENT ON COLUMN sync_logs.messages_added IS 'Total new messages added to database';
COMMENT ON COLUMN sync_logs.chats_classified IS 'Number of chats classified by AI';
