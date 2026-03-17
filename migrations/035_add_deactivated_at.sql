-- Migration 035: Add deactivated_at timestamp to stores
-- Tracks when a store was deactivated (is_active set to FALSE)

ALTER TABLE stores ADD COLUMN deactivated_at TIMESTAMPTZ;

-- Backfill: set deactivated_at = NOW() for currently inactive stores
UPDATE stores SET deactivated_at = NOW() WHERE is_active = FALSE;
