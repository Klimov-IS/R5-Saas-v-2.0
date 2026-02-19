-- Migration 017: Add 'opened' to chat_status_by_review ENUM + chat_status column to review_statuses_from_extension
--
-- Purpose: Support new chat button status from Chrome Extension.
-- Extension already parses and sends chatStatus, but backend was ignoring it.
--
-- Changes:
-- 1. Add 'opened' value to chat_status_by_review ENUM
-- 2. Add chat_status column to review_statuses_from_extension table
-- 3. Sync chat_status to reviews.chat_status_by_review during status sync

-- Step 1: Add 'opened' to ENUM
ALTER TYPE chat_status_by_review ADD VALUE IF NOT EXISTS 'opened';

-- Step 2: Add chat_status column to review_statuses_from_extension
ALTER TABLE review_statuses_from_extension
  ADD COLUMN IF NOT EXISTS chat_status TEXT DEFAULT NULL;

-- Step 3: Add comment
COMMENT ON COLUMN review_statuses_from_extension.chat_status IS
  'Chat button status from extension: chat_not_activated | chat_available | chat_opened | null';
