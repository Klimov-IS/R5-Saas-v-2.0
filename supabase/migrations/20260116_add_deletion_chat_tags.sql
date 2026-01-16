-- Migration: Add new chat tags for deletion workflow
-- Created: 2026-01-16
-- Purpose: Extend chat_tag enum to support negative review deletion automation

-- ============================================================================
-- Step 1: Add new enum values for deletion workflow
-- ============================================================================

-- IMPORTANT: PostgreSQL doesn't support adding multiple enum values in one statement
-- We need to add them one by one

-- Add 'deletion_candidate' - Chat identified as potential deletion opportunity
ALTER TYPE chat_tag ADD VALUE IF NOT EXISTS 'deletion_candidate';

-- Add 'deletion_offered' - Seller offered compensation for deletion
ALTER TYPE chat_tag ADD VALUE IF NOT EXISTS 'deletion_offered';

-- Add 'deletion_agreed' - Client agreed to delete/modify review
ALTER TYPE chat_tag ADD VALUE IF NOT EXISTS 'deletion_agreed';

-- Add 'deletion_confirmed' - Review actually deleted/modified (confirmed by seller)
ALTER TYPE chat_tag ADD VALUE IF NOT EXISTS 'deletion_confirmed';

-- Add 'refund_requested' - Client requested refund/compensation
ALTER TYPE chat_tag ADD VALUE IF NOT EXISTS 'refund_requested';

-- Add 'spam' - Spam or competitor messages
ALTER TYPE chat_tag ADD VALUE IF NOT EXISTS 'spam';

-- ============================================================================
-- Step 2: Add tag update timestamp (if not exists)
-- ============================================================================

-- Check if column exists, add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'tag_updated_at'
  ) THEN
    ALTER TABLE chats ADD COLUMN tag_updated_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- ============================================================================
-- Step 3: Create index for new deletion workflow queries
-- ============================================================================

-- Index for filtering deletion workflow chats
CREATE INDEX IF NOT EXISTS idx_chats_deletion_workflow
ON chats(store_id, tag, last_message_date DESC)
WHERE tag IN ('deletion_candidate', 'deletion_offered', 'deletion_agreed', 'deletion_confirmed');

-- Index for refund requests
CREATE INDEX IF NOT EXISTS idx_chats_refund_requests
ON chats(store_id, last_message_date DESC)
WHERE tag = 'refund_requested';

-- ============================================================================
-- Step 4: Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN chats.tag IS 'Chat classification tag. Values: untagged, active, successful, unsuccessful, no_reply, completed, deletion_candidate, deletion_offered, deletion_agreed, deletion_confirmed, refund_requested, spam';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this to verify migration succeeded:
-- SELECT enum_range(NULL::chat_tag);

-- Expected output should include all 12 tags:
-- {untagged,active,successful,unsuccessful,no_reply,completed,deletion_candidate,deletion_offered,deletion_agreed,deletion_confirmed,refund_requested,spam}
