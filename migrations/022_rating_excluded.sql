-- ============================================
-- Migration 022: Add rating_excluded column
-- Date: 2026-02-21
-- Description: Support WB "transparent rating" feature.
--   When WB excludes a review from product rating calculation,
--   Chrome Extension detects this and sends ratingExcluded: true.
--   Reviews with rating_excluded = TRUE are removed from all
--   task queues (complaints, chats, status parsing) because
--   the business goal (removing bad review impact) is achieved.
--
--   rating_excluded is SEPARATE from review_status_wb — a review
--   can be 'visible' but excluded from rating.
-- ============================================

-- 1. Add to reviews table (main table)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS rating_excluded BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add to review_statuses_from_extension table (staging table)
ALTER TABLE review_statuses_from_extension
  ADD COLUMN IF NOT EXISTS rating_excluded BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Partial index: fast lookup of excluded reviews per store
CREATE INDEX IF NOT EXISTS idx_reviews_rating_excluded
  ON reviews(store_id) WHERE rating_excluded = TRUE;
