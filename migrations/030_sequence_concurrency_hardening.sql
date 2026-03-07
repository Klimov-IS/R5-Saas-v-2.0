-- ============================================================================
-- Migration 030: Sequence Concurrency Hardening
-- Date: 2026-03-07
-- Source: Backend Concurrency Audit (TASK-docs-004, Sprint 005)
-- ============================================================================
--
-- Addresses:
--   C-1: No UNIQUE constraint on active sequences per chat
--   H-2: Cron double-advance risk after PM2 restart
--
-- Changes:
--   1. UNIQUE partial index: one active sequence per chat
--   2. processing_locked_at column: row-level lock for cron processor
-- ============================================================================

-- 1. Enforce: only ONE active sequence per chat at any time.
--    Prevents TOCTOU race in startSequence() where two concurrent requests
--    could both pass the "no active sequence" check and INSERT.
--    Application code catches unique_violation (23505) and returns 409.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sequences_one_active_per_chat
  ON chat_auto_sequences (chat_id)
  WHERE status = 'active';

-- 2. Row-level processing lock for auto-sequence cron processor.
--    Prevents double-send when PM2 restarts while cron is mid-execution.
--    Lock acquired atomically before processing each sequence:
--      UPDATE ... SET processing_locked_at = NOW()
--      WHERE (processing_locked_at IS NULL OR processing_locked_at < NOW() - INTERVAL '10 minutes')
--    10-minute TTL ensures auto-unlock on crash.
ALTER TABLE chat_auto_sequences
  ADD COLUMN IF NOT EXISTS processing_locked_at TIMESTAMPTZ;

-- ============================================================================
-- Verification (run after migration):
--
-- 1. Check UNIQUE index exists:
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'chat_auto_sequences'
--      AND indexname = 'idx_sequences_one_active_per_chat';
--    Expected: 1 row
--
-- 2. Check column exists:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'chat_auto_sequences'
--      AND column_name = 'processing_locked_at';
--    Expected: 1 row
--
-- 3. Test UNIQUE constraint:
--    INSERT INTO chat_auto_sequences (chat_id, store_id, owner_id, sequence_type, messages, max_steps, status)
--    VALUES ('test_chat', 'test_store', 'test_owner', 'test', '[]', 1, 'active');
--    -- second insert should fail:
--    INSERT INTO chat_auto_sequences (chat_id, store_id, owner_id, sequence_type, messages, max_steps, status)
--    VALUES ('test_chat', 'test_store', 'test_owner', 'test2', '[]', 1, 'active');
--    -- Expected: ERROR duplicate key value violates unique constraint
--    -- Cleanup: DELETE FROM chat_auto_sequences WHERE chat_id = 'test_chat';
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_sequences_one_active_per_chat;
--   ALTER TABLE chat_auto_sequences DROP COLUMN IF EXISTS processing_locked_at;
-- ============================================================================
