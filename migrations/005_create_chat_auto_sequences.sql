-- ============================================================================
-- Migration: Create chat_auto_sequences table
-- Date: 2026-02-09
-- Purpose: Track automated message sequences for chats in 'awaiting_reply'
--          status. Sends 1 message/day for up to 14 days when client
--          doesn't respond to initial outreach.
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_auto_sequences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  -- Sequence configuration
  sequence_type VARCHAR(50) NOT NULL DEFAULT 'no_reply_followup',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_step INT NOT NULL DEFAULT 0,
  max_steps INT NOT NULL DEFAULT 14,

  -- State machine
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'stopped')),
  stop_reason VARCHAR(50),

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for pending sequences (cron job)
CREATE INDEX IF NOT EXISTS idx_auto_sequences_pending
  ON chat_auto_sequences(next_send_at)
  WHERE status = 'active';

-- Fast lookup by chat (check if sequence exists)
CREATE INDEX IF NOT EXISTS idx_auto_sequences_chat
  ON chat_auto_sequences(chat_id, status);

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT * FROM chat_auto_sequences LIMIT 5;
-- SELECT count(*) FROM chat_auto_sequences WHERE status = 'active';

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP TABLE IF EXISTS chat_auto_sequences;
