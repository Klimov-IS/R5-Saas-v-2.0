-- ============================================================================
-- Migration: Add completion_reason field for closed chats
-- Date: 2026-01-24
-- Author: Product Manager
-- Purpose: Categorize reasons for closing chats (CRM analytics)
-- ============================================================================

-- Step 1: Add "completion_reason" column
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS completion_reason TEXT
    CHECK (completion_reason IN (
      'review_deleted',    -- отзыв удален
      'review_upgraded',   -- отзыв дополнен
      'no_reply',          -- нет ответа
      'old_dialog',        -- старый диалог
      'not_our_issue',     -- не наш вопрос
      'spam',              -- спам
      'negative',          -- негатив
      'other'              -- другое
    ));

-- Step 2: Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_chats_completion_reason
  ON chats(store_id, completion_reason, status, status_updated_at DESC)
  WHERE completion_reason IS NOT NULL;

-- Step 3: Create composite index for closed chats analytics
CREATE INDEX IF NOT EXISTS idx_chats_closed_analytics
  ON chats(store_id, status, completion_reason, status_updated_at DESC)
  WHERE status = 'closed';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check completion_reason distribution for closed chats
-- SELECT completion_reason, COUNT(*) as count
-- FROM chats
-- WHERE status = 'closed'
-- GROUP BY completion_reason
-- ORDER BY count DESC;

-- Check closed chats without completion_reason (legacy data)
-- SELECT COUNT(*) as legacy_closed_without_reason
-- FROM chats
-- WHERE status = 'closed' AND completion_reason IS NULL;

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_chats_completion_reason;
-- DROP INDEX IF EXISTS idx_chats_closed_analytics;
-- ALTER TABLE chats DROP COLUMN IF EXISTS completion_reason;

-- ============================================================================
-- Notes
-- ============================================================================

-- This migration is SAFE to run multiple times (idempotent)
-- - Uses IF NOT EXISTS / IF EXISTS
-- - Uses CHECK constraint for valid values only
-- - Indexes created with partial WHERE for performance
-- - NULL allowed (for legacy closed chats without reason)

-- Expected results:
-- ✅ New "completion_reason" column added
-- ✅ 8 possible values enforced by CHECK constraint
-- ✅ Indexes created for fast analytics queries
-- ✅ No data loss (NULL allowed for existing closed chats)
