-- Migration 032: Replace stores.status (VARCHAR 5-enum) with stores.is_active (BOOLEAN)
--
-- Context: stores.status has 5 values (active, paused, stopped, trial, archived),
-- but ALL business logic checks only for status = 'active'. The other 4 values
-- have no distinct behavior — they all mean "not active". The informative lifecycle
-- tracking is now handled by stores.stage (migration 031, 8 stages).
--
-- This migration adds is_active BOOLEAN alongside existing status column.
-- The status column will be dropped in migration 033 after verification.
--
-- Backfill rule: 'active' → TRUE, everything else → FALSE.

-- Step 1: Add new boolean column (safe — no existing data affected)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Step 2: Backfill from current status values
UPDATE stores SET is_active = (status = 'active');

-- Step 3: Create partial index for efficient filtering (replaces idx_stores_status)
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active) WHERE is_active = TRUE;

-- Verification query (run manually after migration):
-- SELECT status, is_active, COUNT(*) FROM stores GROUP BY status, is_active ORDER BY status;
-- Expected: active → TRUE, all others → FALSE

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_stores_is_active;
-- ALTER TABLE stores DROP COLUMN IF EXISTS is_active;
