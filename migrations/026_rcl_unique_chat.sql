-- Migration 026: Enforce 1 chat = 1 review in review_chat_links
--
-- Business rule: 1 review = 1 chat (always, all marketplaces).
-- Bug found: 56 chats had 2 review_chat_links pointing to different reviews.
-- Root cause: no UNIQUE constraint on (chat_id, store_id).
--
-- Strategy: delete ALL duplicate records (both sides of each pair),
-- so the task reappears in Extension for correct re-linking.
-- Then add partial unique index to prevent future duplicates.

-- Step 1: Delete ALL records where (chat_id, store_id) has duplicates.
-- Both records are deleted — we don't know which one was correctly linked.
DELETE FROM review_chat_links
WHERE id IN (
  SELECT rcl.id
  FROM review_chat_links rcl
  INNER JOIN (
    SELECT chat_id, store_id
    FROM review_chat_links
    WHERE chat_id IS NOT NULL
    GROUP BY chat_id, store_id
    HAVING COUNT(*) > 1
  ) dupes ON dupes.chat_id = rcl.chat_id AND dupes.store_id = rcl.store_id
);

-- Step 2: Add partial unique index to prevent future duplicates.
-- Partial: only where chat_id IS NOT NULL (allows multiple NULL chat_id rows).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rcl_unique_chat_per_store
  ON review_chat_links (chat_id, store_id)
  WHERE chat_id IS NOT NULL;
