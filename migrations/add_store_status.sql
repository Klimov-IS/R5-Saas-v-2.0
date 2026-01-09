-- Migration: Add status column to stores table
-- Date: 2025-01-08
-- Description: Adds status field for store lifecycle management (active, paused, stopped, trial, archived)

-- Add status column with default value 'active'
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add constraint to ensure only valid status values
ALTER TABLE stores
DROP CONSTRAINT IF EXISTS stores_status_check;

ALTER TABLE stores
ADD CONSTRAINT stores_status_check
CHECK (status IN ('active', 'paused', 'stopped', 'trial', 'archived'));

-- Add index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- Update existing stores to 'active' status if null
UPDATE stores SET status = 'active' WHERE status IS NULL;

-- Verify migration
SELECT
    COUNT(*) as total_stores,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_stores,
    COUNT(CASE WHEN status IS NULL THEN 1 END) as null_status
FROM stores;
