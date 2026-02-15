-- Migration 013: Optimize draft complaints counting for extension stores API
--
-- Problem: GET /api/extension/stores takes 10-30 seconds due to correlated subquery
-- with 3-table JOIN (reviews + review_complaints + products) running N times per store.
--
-- Solution: SQL rewritten to single LEFT JOIN + GROUP BY, skipping reviews table.
-- This partial index covers the new query pattern: counting draft complaints per store
-- with product work_status filtering.
--
-- Related: TASK-20260215-slow-stores-loading

-- Partial index: only draft complaints, covers (store_id, product_id) for GROUP BY + JOIN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_complaints_draft_store_product
ON review_complaints(store_id, product_id)
WHERE status = 'draft';
