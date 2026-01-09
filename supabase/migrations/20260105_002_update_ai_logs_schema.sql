-- ============================================
-- Update ai_logs table structure
-- Date: 2026-01-05
-- Description: Update ai_logs to match AILog interface in helpers.ts
-- ============================================

-- Drop old table (if data exists, this would need a more careful migration)
DROP TABLE IF EXISTS ai_logs CASCADE;

-- Recreate with proper structure
CREATE TABLE ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,  -- e.g., 'chat', 'review', 'question'
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- e.g., 'classify-chat-tag', 'generate-review-reply'
  prompt TEXT,
  response TEXT,
  model TEXT DEFAULT 'deepseek-chat',
  tokens_used INTEGER,
  cost NUMERIC(10, 6),
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for fast queries
CREATE INDEX idx_ai_logs_store ON ai_logs(store_id);
CREATE INDEX idx_ai_logs_owner ON ai_logs(owner_id);
CREATE INDEX idx_ai_logs_entity ON ai_logs(entity_type, entity_id);
CREATE INDEX idx_ai_logs_action ON ai_logs(action);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at DESC);
CREATE INDEX idx_ai_logs_error ON ai_logs(error) WHERE error IS NOT NULL;

COMMENT ON TABLE ai_logs IS 'Logs of AI API calls (Deepseek)';
COMMENT ON COLUMN ai_logs.entity_type IS 'Type of entity: chat, review, question';
COMMENT ON COLUMN ai_logs.action IS 'AI operation: classify-chat-tag, generate-review-reply, etc.';
COMMENT ON COLUMN ai_logs.tokens_used IS 'Total tokens used in this request';
COMMENT ON COLUMN ai_logs.cost IS 'Cost in USD for this request';
