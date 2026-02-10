-- Migration 008: Remove 'resolved' status, keep 4 statuses
-- Date: 2026-02-10
-- Description: Merge 'resolved' into 'in_progress' or 'closed', update CHECK constraint
-- New order: inbox → awaiting_reply → in_progress → closed

-- Step 1: Move 'resolved' chats WITH completion_reason → 'closed'
UPDATE chats
SET status = 'closed', status_updated_at = NOW()
WHERE status = 'resolved' AND completion_reason IS NOT NULL;

-- Step 2: Move 'resolved' chats WITHOUT completion_reason → 'in_progress'
UPDATE chats
SET status = 'in_progress', status_updated_at = NOW()
WHERE status = 'resolved' AND completion_reason IS NULL;

-- Step 3: Verify no 'resolved' chats remain
-- SELECT COUNT(*) FROM chats WHERE status = 'resolved';  -- Should be 0

-- Step 4: Drop old CHECK constraint and add new one (4 statuses only)
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_status_check;
ALTER TABLE chats ADD CONSTRAINT chats_status_check
  CHECK (status IN ('inbox', 'in_progress', 'awaiting_reply', 'closed'));
