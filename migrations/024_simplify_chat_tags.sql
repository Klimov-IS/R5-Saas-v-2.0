-- Migration 024: Simplify chat tag system (12 tags → 4 + null)
--
-- Context: AI classification (classify-chat-deletion) was wasteful — 93% of chats
-- stayed untagged. The tag system was designed before review_chat_links filtering
-- existed. Now all TG queue chats are deletion candidates by definition.
--
-- Removed tags: active, untagged, successful, unsuccessful, no_reply, completed,
--               refund_requested, spam
-- Kept tags: deletion_candidate, deletion_offered, deletion_agreed, deletion_confirmed
-- Default: NULL (new chat, not yet processed)

-- 1. Remove NOT NULL constraint and DEFAULT 'untagged' from tag column
ALTER TABLE chats ALTER COLUMN tag DROP NOT NULL;
ALTER TABLE chats ALTER COLUMN tag DROP DEFAULT;

-- 2. Convert all removed tags to NULL
UPDATE chats SET tag = NULL
WHERE tag IN ('active', 'untagged', 'successful', 'unsuccessful', 'no_reply', 'completed', 'refund_requested', 'spam');

-- 3. Drop old CHECK constraint and add new one
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_tag_check;
ALTER TABLE chats ADD CONSTRAINT chats_tag_check
  CHECK (tag IS NULL OR tag IN ('deletion_candidate', 'deletion_offered', 'deletion_agreed', 'deletion_confirmed'));
