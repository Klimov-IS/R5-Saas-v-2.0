-- ============================================================================
-- Migration: Rename legacy_tag back to tag
-- Date: 2026-02-09
-- Purpose: The column was renamed tag → legacy_tag in migration 003 when
--          Kanban statuses were added. However, 'tag' is still actively used
--          for AI classification (deletion_candidate, spam, etc.) and is NOT
--          deprecated. Renaming back to 'tag' aligns DB, backend types,
--          and all API routes.
-- ============================================================================

-- Rename column (metadata-only, instant, no data rewrite)
ALTER TABLE chats RENAME COLUMN legacy_tag TO tag;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'chats' AND column_name = 'tag';

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
-- ALTER TABLE chats RENAME COLUMN tag TO legacy_tag;
