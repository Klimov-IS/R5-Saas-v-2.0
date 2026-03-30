-- Migration 039: Add referral column to stores
-- Tracks who referred the client (optional field)

ALTER TABLE stores ADD COLUMN IF NOT EXISTS referral TEXT DEFAULT NULL;
