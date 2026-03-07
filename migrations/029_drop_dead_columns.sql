-- ============================================================================
-- Migration 029: Drop Dead Columns
-- Date: 2026-03-06
-- Source: P4 Legacy Column Audit (TASK-docs-003, Sprint 005)
-- ============================================================================
-- Removes 14 columns confirmed dead by code audit:
--   - No reads in src/ (data comes from JOINs or is never accessed)
--   - No writes in src/ (never inserted or updated)
-- ============================================================================

-- ============================================================================
-- REVIEWS TABLE: Drop 4 dead columns
-- ============================================================================

-- draft_reply_thread_id: OpenAI Assistants thread ID — never implemented for reviews
-- Zero reads, zero writes in entire codebase
ALTER TABLE reviews DROP COLUMN IF EXISTS draft_reply_thread_id;

-- complaint_generated_at: Data comes from JOIN alias rc.generated_at AS complaint_generated_at
-- No code writes to reviews.complaint_generated_at directly
ALTER TABLE reviews DROP COLUMN IF EXISTS complaint_generated_at;

-- complaint_reason_id: Data comes from JOIN alias rc.reason_id AS complaint_reason_id
-- No code writes to reviews.complaint_reason_id directly
ALTER TABLE reviews DROP COLUMN IF EXISTS complaint_reason_id;

-- complaint_category: Data comes from JOIN alias rc.reason_name AS complaint_category
-- No code writes to reviews.complaint_category directly
ALTER TABLE reviews DROP COLUMN IF EXISTS complaint_category;

-- ============================================================================
-- CHATS TABLE: Drop 2 dead JSONB columns
-- ============================================================================

-- sent_no_reply_messages: Legacy auto-reply tracker, superseded by chat_auto_sequences table
-- Zero references in src/ code
ALTER TABLE chats DROP COLUMN IF EXISTS sent_no_reply_messages;

-- sent_no_reply_messages2: Legacy auto-reply tracker set 2, superseded by chat_auto_sequences
-- Zero references in src/ code
ALTER TABLE chats DROP COLUMN IF EXISTS sent_no_reply_messages2;

-- ============================================================================
-- USER_SETTINGS TABLE: Drop 8 dead columns
-- ============================================================================

-- no_reply_messages: Legacy auto-reply message templates, replaced by hardcoded auto-sequence-templates.ts
-- In TypeScript type but never read at runtime
ALTER TABLE user_settings DROP COLUMN IF EXISTS no_reply_messages;

-- no_reply_messages2: Same as above, set 2
ALTER TABLE user_settings DROP COLUMN IF EXISTS no_reply_messages2;

-- no_reply_trigger_phrase2: Dead, only v1 (no_reply_trigger_phrase) read by scripts
ALTER TABLE user_settings DROP COLUMN IF EXISTS no_reply_trigger_phrase2;

-- assistant_chat_reply: OpenAI Assistants deprecated, AI uses Deepseek directly
ALTER TABLE user_settings DROP COLUMN IF EXISTS assistant_chat_reply;

-- assistant_chat_tag: OpenAI Assistants deprecated
ALTER TABLE user_settings DROP COLUMN IF EXISTS assistant_chat_tag;

-- assistant_question_reply: OpenAI Assistants deprecated
ALTER TABLE user_settings DROP COLUMN IF EXISTS assistant_question_reply;

-- assistant_review_complaint: OpenAI Assistants deprecated
ALTER TABLE user_settings DROP COLUMN IF EXISTS assistant_review_complaint;

-- assistant_review_reply: OpenAI Assistants deprecated
ALTER TABLE user_settings DROP COLUMN IF EXISTS assistant_review_reply;

-- ============================================================================
-- Verification: run after migration
-- ============================================================================

-- Check reviews columns are gone:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'reviews' AND column_name IN ('draft_reply_thread_id', 'complaint_generated_at', 'complaint_reason_id', 'complaint_category');
-- Expected: 0 rows

-- Check chats columns are gone:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'chats' AND column_name IN ('sent_no_reply_messages', 'sent_no_reply_messages2');
-- Expected: 0 rows

-- Check user_settings columns are gone:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_settings' AND column_name IN ('no_reply_messages', 'no_reply_messages2', 'no_reply_trigger_phrase2', 'assistant_chat_reply', 'assistant_chat_tag', 'assistant_question_reply', 'assistant_review_complaint', 'assistant_review_reply');
-- Expected: 0 rows

-- ============================================================================
-- Rollback (add columns back — data will be lost!)
-- ============================================================================
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS draft_reply_thread_id TEXT NULL;
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS complaint_generated_at TIMESTAMPTZ NULL;
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS complaint_reason_id INTEGER NULL;
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS complaint_category TEXT NULL;
-- ALTER TABLE chats ADD COLUMN IF NOT EXISTS sent_no_reply_messages JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE chats ADD COLUMN IF NOT EXISTS sent_no_reply_messages2 JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS no_reply_messages JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS no_reply_messages2 JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS no_reply_trigger_phrase2 TEXT NULL;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS assistant_chat_reply TEXT NULL;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS assistant_chat_tag TEXT NULL;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS assistant_question_reply TEXT NULL;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS assistant_review_complaint TEXT NULL;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS assistant_review_reply TEXT NULL;
