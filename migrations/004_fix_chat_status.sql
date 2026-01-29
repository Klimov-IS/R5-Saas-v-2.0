-- ============================================================================
-- Migration: Fix chat status mapping (corrects migration 003)
-- Date: 2026-01-22
-- Author: Product Manager
-- Purpose: Properly map legacy_tag → status for ALL existing chats
-- ============================================================================

-- Problem: Migration 003 had a bug in WHERE clause that prevented updating
-- chats that already had status = 'inbox' (which was all of them due to DEFAULT)
-- This migration fixes that by updating ALL chats unconditionally.

-- Step 1: Re-apply correct status mapping from legacy_tag to status
UPDATE chats SET status = CASE
  -- Old basic tags → New statuses
  WHEN legacy_tag = 'untagged' THEN 'inbox'          -- Not processed → Inbox
  WHEN legacy_tag = 'active' THEN 'in_progress'      -- Active → In Progress
  WHEN legacy_tag = 'no_reply' THEN 'awaiting_reply' -- No reply → Awaiting Reply
  WHEN legacy_tag = 'successful' THEN 'resolved'     -- Successful → Resolved
  WHEN legacy_tag = 'completed' THEN 'closed'        -- Completed → Closed
  WHEN legacy_tag = 'unsuccessful' THEN 'closed'     -- Unsuccessful → Closed

  -- Deletion workflow tags → Status mapping
  WHEN legacy_tag = 'deletion_candidate' THEN 'in_progress'   -- Candidate → In Progress
  WHEN legacy_tag = 'deletion_offered' THEN 'awaiting_reply'  -- Offered → Awaiting Reply
  WHEN legacy_tag = 'deletion_agreed' THEN 'resolved'         -- Agreed → Resolved
  WHEN legacy_tag = 'deletion_confirmed' THEN 'closed'        -- Confirmed → Closed
  WHEN legacy_tag = 'refund_requested' THEN 'in_progress'     -- Refund → In Progress
  WHEN legacy_tag = 'spam' THEN 'closed'                      -- Spam → Closed

  ELSE 'inbox' -- Fallback for NULL or unknown tags
END,
status_updated_at = updated_at
WHERE TRUE; -- ✅ FIX: Update ALL chats, not just WHERE status IS NULL

-- Step 2: Verify results (commented out - uncomment to check manually)
-- SELECT
--   legacy_tag,
--   status,
--   COUNT(*) as count
-- FROM chats
-- GROUP BY legacy_tag, status
-- ORDER BY legacy_tag, status;

-- ============================================================================
-- Expected results:
-- ✅ All chats now have correct status based on their legacy_tag
-- ✅ Kanban Board should display all chats in correct columns
-- ✅ No data loss
-- ============================================================================
