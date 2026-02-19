-- Migration 019: Drop FK constraint on review_chat_links.chat_id
--
-- Problem: Extension creates review_chat_link BEFORE the chat exists in our
-- chats table (WB dialogue sync hasn't run yet). The FK causes INSERT to fail
-- with "violates foreign key constraint".
--
-- Solution: Drop FK. chat_id is just a text reference to WB chat UUID,
-- populated at creation time from the chat URL. Dialogue sync will later
-- reconcile and verify the link.

ALTER TABLE review_chat_links DROP CONSTRAINT IF EXISTS review_chat_links_chat_id_fkey;
