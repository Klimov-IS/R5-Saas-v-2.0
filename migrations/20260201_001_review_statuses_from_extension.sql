-- ============================================
-- Migration: Review Statuses from Extension
-- Date: 2026-02-01
-- Description:
--   1. Add 'reconsidered' value to complaint_status ENUM
--   2. Create table for storing review statuses parsed by Chrome Extension
-- Purpose: Optimize GPT token usage by filtering reviews that already have complaint status
-- ============================================

-- ============================================
-- Step 1: Add 'reconsidered' to complaint_status ENUM
-- ============================================
-- PostgreSQL doesn't allow easy ENUM modification, so we use ALTER TYPE ... ADD VALUE
-- This is safe and doesn't require table recreation

ALTER TYPE complaint_status ADD VALUE IF NOT EXISTS 'reconsidered';

-- ============================================
-- Step 2: Create table for Extension-parsed statuses
-- ============================================
-- This table stores review statuses parsed by Chrome Extension from WB seller cabinet.
-- Data is used to filter reviews before GPT complaint generation (saves ~80% tokens).
--
-- Key design decisions:
-- 1. Separate table (not in reviews) - Extension doesn't know our review IDs
-- 2. reviewKey for matching - composite key from productId + rating + datetime
-- 3. UPSERT logic - same review can be re-parsed with updated status

CREATE TABLE IF NOT EXISTS review_statuses_from_extension (
    id SERIAL PRIMARY KEY,

    -- Review identification (for matching with reviews table)
    review_key VARCHAR(100) NOT NULL,           -- Format: {productId}_{rating}_{datetime without seconds}
    store_id TEXT NOT NULL,                     -- Our internal store ID (e.g., '7kKX9WgLvOPiXYIHk6hi')
    product_id VARCHAR(50) NOT NULL,            -- WB product ID (nmId)
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_date TIMESTAMPTZ NOT NULL,           -- Original review date from WB

    -- Statuses parsed from WB interface
    statuses JSONB NOT NULL DEFAULT '[]',       -- Array of status strings, e.g. ["Жалоба отклонена", "Выкуп"]
    can_submit_complaint BOOLEAN NOT NULL DEFAULT true,  -- Calculated: can we submit complaint?

    -- Metadata
    parsed_at TIMESTAMPTZ NOT NULL,             -- When Extension parsed this review
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT uq_review_key_store UNIQUE (review_key, store_id),
    CONSTRAINT fk_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- ============================================
-- Step 3: Create indexes for efficient queries
-- ============================================

-- Primary query: filter by store and can_submit_complaint
CREATE INDEX idx_ext_statuses_store_can_submit
    ON review_statuses_from_extension (store_id, can_submit_complaint);

-- For matching with reviews table
CREATE INDEX idx_ext_statuses_product_rating_date
    ON review_statuses_from_extension (store_id, product_id, rating, review_date);

-- For finding recent syncs
CREATE INDEX idx_ext_statuses_parsed_at
    ON review_statuses_from_extension (parsed_at DESC);

-- For stats queries
CREATE INDEX idx_ext_statuses_store_stats
    ON review_statuses_from_extension (store_id, can_submit_complaint, parsed_at);

-- ============================================
-- Step 4: Create trigger for auto-updating updated_at
-- ============================================

CREATE TRIGGER update_review_statuses_from_extension_updated_at
    BEFORE UPDATE ON review_statuses_from_extension
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 5: Add comments for documentation
-- ============================================

COMMENT ON TABLE review_statuses_from_extension IS
    'Stores review statuses parsed by Chrome Extension from WB seller cabinet. Used to filter reviews before GPT complaint generation.';

COMMENT ON COLUMN review_statuses_from_extension.review_key IS
    'Composite key for matching: {productId}_{rating}_{datetime without seconds}. Example: 649502497_1_2026-01-07T20:09';

COMMENT ON COLUMN review_statuses_from_extension.statuses IS
    'Array of status strings from WB interface. Examples: "Жалоба отклонена", "Жалоба одобрена", "Проверяем жалобу", "Жалоба пересмотрена", "Выкуп", "Отказ"';

COMMENT ON COLUMN review_statuses_from_extension.can_submit_complaint IS
    'Calculated by Extension: true if no complaint-related status present. Used to filter reviews for GPT generation.';

COMMENT ON COLUMN review_statuses_from_extension.parsed_at IS
    'Timestamp when Extension parsed this review from WB seller cabinet';

-- ============================================
-- Migration complete!
--
-- Next steps:
-- 1. Create POST /api/extension/review-statuses endpoint
-- 2. Create GET /api/extension/review-statuses endpoint for testing
-- 3. Later: Create automation to sync statuses to main reviews table
-- ============================================
