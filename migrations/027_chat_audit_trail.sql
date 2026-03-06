-- Migration 027: Chat Audit Trail
--
-- Adds WHO changed status + full status change history.
--
-- Problem: auth.userId is extracted in every API endpoint but NOT saved to DB.
-- Cannot determine: who closed a chat, was it manual or automatic.
--
-- Changes:
--   1. chats.status_changed_by — userId of last status change (NULL = system)
--   2. chats.closure_type — 'manual' | 'auto' (NULL when not closed)
--   3. chat_status_history — immutable log of every status/tag change

-- Step 1: Add audit columns to chats
ALTER TABLE chats ADD COLUMN IF NOT EXISTS status_changed_by TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS closure_type VARCHAR(20);

-- Step 2: CHECK constraint on closure_type
ALTER TABLE chats ADD CONSTRAINT chk_closure_type
  CHECK (closure_type IS NULL OR closure_type IN ('manual', 'auto'));

-- Step 3: Create immutable status history table
CREATE TABLE IF NOT EXISTS chat_status_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  old_tag TEXT,
  new_tag TEXT,
  completion_reason TEXT,
  closure_type VARCHAR(20),
  changed_by TEXT,
  change_source VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_csh_chat
  ON chat_status_history(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_csh_store
  ON chat_status_history(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_csh_changed_by
  ON chat_status_history(changed_by)
  WHERE changed_by IS NOT NULL;
