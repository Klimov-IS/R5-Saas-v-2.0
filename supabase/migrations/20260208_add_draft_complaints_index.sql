-- Migration: Add index for draft complaints count query
-- Date: 2026-02-08
-- Purpose: Optimize GET /api/extension/stores endpoint (draftComplaintsCount)

-- This query needs optimization:
-- SELECT COUNT(*) FROM reviews r
-- JOIN review_complaints rc ON r.id = rc.review_id
-- JOIN products p ON r.product_id = p.id
-- WHERE r.store_id = s.id AND rc.status = 'draft' AND p.work_status = 'active'

-- Index 1: Partial index on review_complaints for drafts only
-- This is the most impactful - filters 90%+ of complaints immediately
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_complaints_draft_review
ON review_complaints(review_id)
WHERE status = 'draft';

-- Index 2: Composite index on reviews for store + product lookup
-- Helps the JOIN from reviews to products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_store_product
ON reviews(store_id, product_id);

-- Index 3: Partial index on products for active work_status
-- Filters only active products quickly
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_work_active
ON products(id)
WHERE work_status = 'active';

-- Verify indexes created
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('review_complaints', 'reviews', 'products') AND indexname LIKE '%draft%' OR indexname LIKE '%work_active%';
