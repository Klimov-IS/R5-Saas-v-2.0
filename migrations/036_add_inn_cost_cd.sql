-- Migration 036: Add INN and cost_cd fields to stores
-- These were previously manual-only in Google Sheets.
-- Now stored in DB and synced to sheet automatically.

ALTER TABLE stores ADD COLUMN inn VARCHAR(20);
ALTER TABLE stores ADD COLUMN cost_cd VARCHAR(50);
