-- Migration 040: Drop reviews_archive table
-- Sprint-016: DB Optimization — remove 5-star reviews storage (3.2M rows, ~3.4 GB)
-- Keep only the count per store in stores.review_count_5star
--
-- IMPORTANT: Run AFTER deploying code changes that remove all reviews_archive references
--
-- Step 1: Add counter column
ALTER TABLE stores ADD COLUMN IF NOT EXISTS review_count_5star INTEGER NOT NULL DEFAULT 0;

-- Step 2: Populate from reviews_archive
UPDATE stores s SET review_count_5star = COALESCE((
  SELECT COUNT(*) FROM reviews_archive WHERE store_id = s.id
), 0);

-- Step 3: Drop the UNION ALL view (must drop before table)
DROP VIEW IF EXISTS reviews_all;

-- Step 4: Drop the archive table
DROP TABLE IF EXISTS reviews_archive;

-- Step 5: Remove the CHECK constraint on reviews table that restricts to 1-4 stars
-- (no longer needed since we skip 5-star in code, but keep for safety)
-- The CHECK constraint rating BETWEEN 1 AND 4 stays — it's still correct.
