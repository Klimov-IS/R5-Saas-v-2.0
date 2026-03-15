-- Migration 034: Add composite index for extension tasks queries
--
-- This index covers the common review-side filters from statusParses/pendingChats
-- queries used by the extension API. Combined with the new product_id = ANY(...)
-- query pattern, this enables efficient index scans instead of sequential scans
-- on the 3.7M-row reviews table.
--
-- The index is partial (marketplace='wb', rating_excluded=false, non-excluded statuses,
-- chat_status unknown/null) which keeps it small and efficient.
--
-- Expected improvement: statusParses query from 5-30s → <500ms
--
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run this migration outside of a transaction or use the script below.

-- Drop if exists (for idempotency)
DROP INDEX IF EXISTS idx_reviews_tasks_eligible;

-- Composite partial index for extension tasks queries
CREATE INDEX CONCURRENTLY idx_reviews_tasks_eligible
ON reviews(store_id, product_id, rating, date ASC)
WHERE marketplace = 'wb'
  AND rating_excluded = FALSE
  AND review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
  AND (chat_status_by_review IS NULL OR chat_status_by_review = 'unknown');
