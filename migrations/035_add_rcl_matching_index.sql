-- Migration 035: Add composite index for review_chat_links matching
--
-- Problem: /tasks Query B and C use NOT EXISTS with date range scan:
--   WHERE rcl.store_id = r.store_id
--     AND rcl.review_nm_id = p.wb_product_id
--     AND rcl.review_rating = r.rating
--     AND rcl.review_date BETWEEN r.date - 2min AND r.date + 2min
--
-- Without index: sequential scan on review_chat_links per reviews row → spikes 13-21s
-- With index: index scan → <100ms
--
-- Table is small (~700 rows), index overhead negligible.
--
-- Sprint-012 TASK-003

-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
DROP INDEX IF EXISTS idx_rcl_matching;

CREATE INDEX CONCURRENTLY idx_rcl_matching
ON review_chat_links(store_id, review_nm_id, review_rating, review_date);
