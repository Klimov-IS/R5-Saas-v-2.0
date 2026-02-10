-- Migration 007: Add is_auto_reply field to chat_messages
-- Purpose: Distinguish automated (bot/sequence) messages from manual manager messages
-- Safe: DEFAULT FALSE, no data loss

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_auto_reply BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: mark existing auto-sequence messages
UPDATE chat_messages SET is_auto_reply = TRUE WHERE id LIKE 'auto_%';

-- Index for potential future analytics queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_auto ON chat_messages(chat_id, is_auto_reply) WHERE is_auto_reply = TRUE;
