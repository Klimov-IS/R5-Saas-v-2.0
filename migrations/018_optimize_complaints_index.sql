-- Migration 018: Optimize complaints query for extension API
-- Problem: GET /api/extension/stores/{storeId}/complaints scans ALL draft complaints
-- across all stores (~32K rows) instead of only the target store's drafts.
-- Solution: Partial index on (store_id, review_id) filtered by status='draft'
-- Expected improvement: ~777ms → ~50-80ms for largest stores

-- Index for fast store-specific draft complaint lookups
-- Used by: GET /api/extension/stores/{storeId}/complaints
-- The review_id column enables efficient JOIN to reviews table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_complaints_store_draft_review
  ON review_complaints(store_id, review_id)
  WHERE status = 'draft';

-- Comment for documentation
COMMENT ON INDEX idx_complaints_store_draft_review IS 'Optimized for extension complaints API: fast store-specific draft lookup with review_id for JOIN';
