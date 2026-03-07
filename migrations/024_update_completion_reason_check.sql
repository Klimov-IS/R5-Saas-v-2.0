-- ============================================================================
-- Migration 024: Update completion_reason CHECK constraint
-- Date: 2026-03-05
-- Purpose: Add 3 missing values: review_resolved, refusal, temporarily_hidden
-- ============================================================================

-- Step 1: Drop old CHECK constraint
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_completion_reason_check;

-- Step 2: Add updated CHECK constraint with all 11 values
ALTER TABLE chats ADD CONSTRAINT chats_completion_reason_check
  CHECK (completion_reason IN (
    'review_deleted',       -- отзыв удален
    'review_upgraded',      -- отзыв дополнен
    'review_resolved',      -- не влияет на рейтинг (жалоба одобрена, исключен и т.д.)
    'refusal',              -- отказ покупателя
    'no_reply',             -- нет ответа
    'old_dialog',           -- старый диалог
    'not_our_issue',        -- не наш вопрос
    'spam',                 -- спам
    'negative',             -- негатив
    'temporarily_hidden',   -- временно скрыт
    'other'                 -- другое
  ));

-- ============================================================================
-- Rollback: restore original 8-value constraint
-- ============================================================================
-- ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_completion_reason_check;
-- ALTER TABLE chats ADD CONSTRAINT chats_completion_reason_check
--   CHECK (completion_reason IN (
--     'review_deleted', 'review_upgraded', 'no_reply', 'old_dialog',
--     'not_our_issue', 'spam', 'negative', 'other'
--   ));
