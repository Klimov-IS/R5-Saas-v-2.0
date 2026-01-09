-- Migration: Add composite indexes for query optimization
-- Date: 2026-01-07
-- Purpose: Speed up filtered queries on reviews and chats pages
-- Expected improvement: 50-70% faster queries with filters

-- ============================================================================
-- REVIEWS INDEXES
-- ============================================================================

-- Index for filtering reviews by store and rating
-- Use case: /api/stores/[storeId]/reviews?rating=1-2
CREATE INDEX IF NOT EXISTS idx_reviews_store_rating
ON reviews(store_id, rating);

COMMENT ON INDEX idx_reviews_store_rating IS
  'Composite index for filtering reviews by store and rating (e.g., rating=1-2)';

-- Index for filtering reviews by store and answer status
-- Use case: /api/stores/[storeId]/reviews?hasAnswer=no
CREATE INDEX IF NOT EXISTS idx_reviews_store_answer
ON reviews(store_id, answer)
WHERE answer IS NULL;

COMMENT ON INDEX idx_reviews_store_answer IS
  'Partial index for unanswered reviews (answer IS NULL)';

-- Index for sorting reviews by date (most common sort)
-- Use case: /api/stores/[storeId]/reviews ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_reviews_store_date
ON reviews(store_id, created_at DESC);

COMMENT ON INDEX idx_reviews_store_date IS
  'Composite index for sorting reviews by date within a store';

-- Composite index for rating filter + date sort (most common combination)
CREATE INDEX IF NOT EXISTS idx_reviews_store_rating_date
ON reviews(store_id, rating, created_at DESC);

COMMENT ON INDEX idx_reviews_store_rating_date IS
  'Optimized for filtering by rating and sorting by date simultaneously';

-- ============================================================================
-- CHATS INDEXES
-- ============================================================================

-- Index for filtering chats by store and tag
-- Use case: /api/stores/[storeId]/chats?tag=active
CREATE INDEX IF NOT EXISTS idx_chats_store_tag
ON chats(store_id, tag);

COMMENT ON INDEX idx_chats_store_tag IS
  'Composite index for filtering chats by tag (active, successful, etc.)';

-- Index for sorting chats by last message date
-- Use case: /api/stores/[storeId]/chats ORDER BY last_message_date DESC
CREATE INDEX IF NOT EXISTS idx_chats_store_date
ON chats(store_id, last_message_date DESC);

COMMENT ON INDEX idx_chats_store_date IS
  'Composite index for sorting chats by last message date';

-- Composite index for tag filter + date sort
CREATE INDEX IF NOT EXISTS idx_chats_store_tag_date
ON chats(store_id, tag, last_message_date DESC);

COMMENT ON INDEX idx_chats_store_tag_date IS
  'Optimized for filtering by tag and sorting by date simultaneously';

-- ============================================================================
-- PRODUCTS INDEXES
-- ============================================================================

-- Index for active products filter
-- Use case: /api/stores/[storeId]/products WHERE is_active = true
CREATE INDEX IF NOT EXISTS idx_products_store_active
ON products(store_id, is_active)
WHERE is_active = true;

COMMENT ON INDEX idx_products_store_active IS
  'Partial index for active products only';

-- ============================================================================
-- AI LOGS INDEXES
-- ============================================================================

-- Index for filtering AI logs by store and date range
-- Use case: Dashboard showing recent AI activity
CREATE INDEX IF NOT EXISTS idx_ai_logs_store_date
ON ai_logs(store_id, created_at DESC);

COMMENT ON INDEX idx_ai_logs_store_date IS
  'Composite index for filtering AI logs by store and sorting by date';

-- Index for filtering AI logs by error status
-- Use case: Finding failed AI operations (where error IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_ai_logs_store_error
ON ai_logs(store_id, created_at DESC)
WHERE error IS NOT NULL;

COMMENT ON INDEX idx_ai_logs_store_error IS
  'Partial index for failed AI operations (error IS NOT NULL)';

-- ============================================================================
-- PRODUCT RULES INDEXES
-- ============================================================================

-- Index for looking up rules by product
-- Use case: /api/stores/[storeId]/products-rules
CREATE INDEX IF NOT EXISTS idx_product_rules_product
ON product_rules(product_id);

COMMENT ON INDEX idx_product_rules_product IS
  'Index for fast lookup of rules by product_id';

-- Index for looking up all rules for a store
CREATE INDEX IF NOT EXISTS idx_product_rules_store
ON product_rules(store_id);

COMMENT ON INDEX idx_product_rules_store IS
  'Index for fast lookup of all rules within a store';

-- ============================================================================
-- ANALYSIS
-- ============================================================================

-- Check index sizes after creation:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Check index usage statistics:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan,
--   idx_tup_read,
--   idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;
