-- Migration: Create chat_tag ENUM (if not exists) and convert column
-- Created: 2026-01-16
-- Purpose: Fix chat.tag column to use ENUM instead of TEXT

-- ============================================================================
-- Step 1: Create chat_tag ENUM with original 6 values
-- ============================================================================

DO $$
BEGIN
  -- Create enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_tag') THEN
    CREATE TYPE chat_tag AS ENUM (
      'untagged',
      'active',
      'successful',
      'unsuccessful',
      'no_reply',
      'completed'
    );
    RAISE NOTICE 'Created chat_tag ENUM';
  ELSE
    RAISE NOTICE 'chat_tag ENUM already exists';
  END IF;
END $$;

-- ============================================================================
-- Step 2: Convert chats.tag column from TEXT to chat_tag ENUM
-- ============================================================================

DO $$
BEGIN
  -- Check if column is TEXT type
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chats'
      AND column_name = 'tag'
      AND data_type = 'text'
  ) THEN
    -- First, update any non-standard values to 'untagged'
    UPDATE chats
    SET tag = 'untagged'
    WHERE tag NOT IN ('untagged', 'active', 'successful', 'unsuccessful', 'no_reply', 'completed');

    -- Remove DEFAULT constraint (if exists)
    ALTER TABLE chats ALTER COLUMN tag DROP DEFAULT;

    -- Convert column type using explicit casting
    ALTER TABLE chats
    ALTER COLUMN tag TYPE chat_tag USING tag::chat_tag;

    -- Restore DEFAULT to 'untagged'
    ALTER TABLE chats ALTER COLUMN tag SET DEFAULT 'untagged'::chat_tag;

    RAISE NOTICE 'Converted chats.tag from TEXT to chat_tag ENUM';
  ELSE
    RAISE NOTICE 'chats.tag is already chat_tag ENUM or does not exist';
  END IF;
END $$;

-- ============================================================================
-- Step 3: Add deletion workflow enum values (6 new values)
-- ============================================================================

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
-- Step 4: Add tag update timestamp (if not exists)
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
-- Step 5: Create indexes for deletion workflow queries
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
-- Step 6: Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN chats.tag IS 'Chat classification tag. Values: untagged, active, successful, unsuccessful, no_reply, completed, deletion_candidate, deletion_offered, deletion_agreed, deletion_confirmed, refund_requested, spam';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Verify all 12 tags exist
DO $$
DECLARE
  tag_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO tag_count
  FROM pg_enum
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'chat_tag');

  RAISE NOTICE 'chat_tag ENUM has % values', tag_count;

  IF tag_count = 12 THEN
    RAISE NOTICE '✅ SUCCESS: All 12 chat tags created successfully!';
  ELSE
    RAISE WARNING '⚠️ Expected 12 tags, found %', tag_count;
  END IF;
END $$;
