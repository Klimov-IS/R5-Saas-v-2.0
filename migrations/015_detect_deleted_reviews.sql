-- Migration 015: Detect deleted reviews + new statuses
-- Date: 2026-02-15
--
-- Changes:
-- 1. Add 'deleted' to review_status_wb ENUM
-- 2. Add 'not_applicable' to complaint_status ENUM
-- 3. Update review_complaints CHECK constraint
-- 4. Add deleted_from_wb_at column to reviews
-- 5. Add index for deleted reviews

-- Step 1: Add 'deleted' to review_status_wb ENUM
ALTER TYPE review_status_wb ADD VALUE IF NOT EXISTS 'deleted';

-- Step 2: Add 'not_applicable' to complaint_status ENUM
ALTER TYPE complaint_status ADD VALUE IF NOT EXISTS 'not_applicable';

-- Step 3: Update CHECK constraint on review_complaints.status
ALTER TABLE review_complaints DROP CONSTRAINT IF EXISTS review_complaints_status_check;
ALTER TABLE review_complaints ADD CONSTRAINT review_complaints_status_check
    CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'pending', 'reconsidered', 'not_applicable'));

-- Step 4: Add deleted_from_wb_at column
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_from_wb_at TIMESTAMPTZ;

-- Step 5: Partial index for finding deleted reviews
CREATE INDEX IF NOT EXISTS idx_reviews_deleted
    ON reviews(store_id, deleted_from_wb_at DESC)
    WHERE deleted_from_wb_at IS NOT NULL;
