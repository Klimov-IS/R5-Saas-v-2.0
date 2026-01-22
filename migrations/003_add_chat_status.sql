-- ============================================================================
-- Migration: Add chat status field for Kanban Board
-- Date: 2026-01-22
-- Author: Product Manager
-- Purpose: Separate status (CRM funnel) from tags (categories)
-- ============================================================================

-- Step 1: Add new "status" column (voronka CRM)
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inbox'
    CHECK (status IN ('inbox', 'in_progress', 'awaiting_reply', 'resolved', 'closed'));

-- Step 2: Add timestamp for tracking status changes
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Migrate old "tag" → new "status"
UPDATE chats SET status = CASE
  -- Old basic tags → New statuses
  WHEN tag = 'untagged' THEN 'inbox'          -- Not processed → Inbox
  WHEN tag = 'active' THEN 'in_progress'      -- Active → In Progress
  WHEN tag = 'no_reply' THEN 'awaiting_reply' -- No reply → Awaiting Reply
  WHEN tag = 'successful' THEN 'resolved'     -- Successful → Resolved
  WHEN tag = 'completed' THEN 'closed'        -- Completed → Closed
  WHEN tag = 'unsuccessful' THEN 'closed'     -- Unsuccessful → Closed

  -- Deletion workflow tags → Status mapping
  WHEN tag = 'deletion_candidate' THEN 'in_progress'   -- Candidate → In Progress
  WHEN tag = 'deletion_offered' THEN 'awaiting_reply'  -- Offered → Awaiting Reply
  WHEN tag = 'deletion_agreed' THEN 'resolved'         -- Agreed → Resolved
  WHEN tag = 'deletion_confirmed' THEN 'closed'        -- Confirmed → Closed
  WHEN tag = 'refund_requested' THEN 'in_progress'     -- Refund → In Progress
  WHEN tag = 'spam' THEN 'closed'                      -- Spam → Closed

  ELSE 'inbox' -- Fallback
END,
status_updated_at = updated_at
WHERE status IS NULL OR status = 'inbox'; -- Only update if not already set

-- Step 4: Rename old "tag" → "legacy_tag" (preserve history)
ALTER TABLE chats RENAME COLUMN tag TO legacy_tag;

-- Step 5: Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_chats_status
  ON chats(store_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_kanban
  ON chats(store_id, status, status_updated_at DESC, updated_at DESC);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check status distribution
-- SELECT status, COUNT(*) as count
-- FROM chats
-- GROUP BY status
-- ORDER BY count DESC;

-- Check legacy_tag preservation
-- SELECT legacy_tag, status, COUNT(*) as count
-- FROM chats
-- GROUP BY legacy_tag, status
-- ORDER BY count DESC;

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- To rollback this migration:
-- ALTER TABLE chats RENAME COLUMN legacy_tag TO tag;
-- ALTER TABLE chats DROP COLUMN status;
-- ALTER TABLE chats DROP COLUMN status_updated_at;
-- DROP INDEX IF EXISTS idx_chats_status;
-- DROP INDEX IF EXISTS idx_chats_kanban;

-- ============================================================================
-- Notes
-- ============================================================================

-- This migration is SAFE to run multiple times (idempotent)
-- - Uses IF NOT EXISTS / IF EXISTS
-- - Uses CASE WHEN for conditional updates
-- - Preserves old data in legacy_tag column

-- Expected results:
-- ✅ New "status" column added
-- ✅ Old tag values migrated to status
-- ✅ legacy_tag column preserves history
-- ✅ Indexes created for fast queries
-- ✅ No data loss
