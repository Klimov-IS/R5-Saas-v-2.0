-- Migration: Fix chat tag constraint to support deletion workflow
-- Created: 2026-01-16
-- Purpose: Update CHECK constraint on chats.tag to include new deletion workflow values
-- IMPORTANT: This keeps tag as TEXT type but adds proper validation

-- ============================================================================
-- Step 1: Drop existing check constraint (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'chats_tag_check'
      AND table_name = 'chats'
  ) THEN
    ALTER TABLE chats DROP CONSTRAINT chats_tag_check;
    RAISE NOTICE 'Dropped existing chats_tag_check constraint';
  ELSE
    RAISE NOTICE 'No existing chats_tag_check constraint found';
  END IF;
END $$;

-- ============================================================================
-- Step 2: Add new CHECK constraint with all 12 tag values
-- ============================================================================

ALTER TABLE chats
ADD CONSTRAINT chats_tag_check CHECK (
  tag IN (
    -- Original 6 tags
    'untagged',
    'active',
    'successful',
    'unsuccessful',
    'no_reply',
    'completed',
    -- New 6 deletion workflow tags
    'deletion_candidate',
    'deletion_offered',
    'deletion_agreed',
    'deletion_confirmed',
    'refund_requested',
    'spam'
  )
);

-- ============================================================================
-- Step 3: Add tag update timestamp column (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'tag_updated_at'
  ) THEN
    ALTER TABLE chats ADD COLUMN tag_updated_at TIMESTAMPTZ NULL;
    RAISE NOTICE 'Added tag_updated_at column';
  ELSE
    RAISE NOTICE 'tag_updated_at column already exists';
  END IF;
END $$;

-- ============================================================================
-- Step 4: Create indexes for deletion workflow queries
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
-- Step 5: Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN chats.tag IS 'Chat classification tag. Values: untagged, active, successful, unsuccessful, no_reply, completed, deletion_candidate, deletion_offered, deletion_agreed, deletion_confirmed, refund_requested, spam';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  -- Check constraint exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'chats_tag_check'
      AND table_name = 'chats'
  ) THEN
    RAISE NOTICE '✅ SUCCESS: chats_tag_check constraint created with 12 tag values!';
  ELSE
    RAISE WARNING '⚠️  WARNING: chats_tag_check constraint not found!';
  END IF;
END $$;
