-- Migration: Close chats with deleted/updated reviews
-- Description: Set status to 'resolved' for chats where review was deleted or updated
-- Author: Claude Code
-- Date: 2026-01-22

-- ============================================================================
-- STEP 1: Update chats with "Видим что отзыв был удален"
-- ============================================================================

UPDATE chats
SET
  status = 'resolved',
  updated_at = NOW()
WHERE
  last_message_text ILIKE '%Видим что отзыв был удален%'
  AND status != 'resolved';

-- ============================================================================
-- STEP 2: Update chats with "Видим что отзыв был дополнен"
-- ============================================================================

UPDATE chats
SET
  status = 'resolved',
  updated_at = NOW()
WHERE
  last_message_text ILIKE '%Видим что отзыв был дополнен%'
  AND status != 'resolved';

-- ============================================================================
-- VERIFICATION QUERIES (for manual check after migration)
-- ============================================================================

-- Check how many chats were updated
-- SELECT
--   COUNT(*) as total_resolved_chats
-- FROM chats
-- WHERE
--   (last_message_text ILIKE '%Видим что отзыв был удален%'
--    OR last_message_text ILIKE '%Видим что отзыв был дополнен%')
--   AND status = 'resolved';

-- Check status distribution for these chats
-- SELECT
--   status,
--   COUNT(*) as count
-- FROM chats
-- WHERE
--   last_message_text ILIKE '%Видим что отзыв был удален%'
--   OR last_message_text ILIKE '%Видим что отзыв был дополнен%'
-- GROUP BY status
-- ORDER BY count DESC;
