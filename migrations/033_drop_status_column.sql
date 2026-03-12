-- Migration 033: Drop stores.status column (FINAL CLEANUP)
--
-- IMPORTANT: Run this migration ONLY after 1-2 days of stable operation
-- with is_active field. All code must already be using is_active instead of status.
--
-- Pre-flight check: grep -rn "stores.status\|s\.status\|store\.status" src/
-- Should return ZERO results for store status (only chat/sequence statuses).

-- Step 1: Drop CHECK constraint from migration 028
ALTER TABLE stores DROP CONSTRAINT IF EXISTS chk_store_status;

-- Step 2: Drop old index
DROP INDEX IF EXISTS idx_stores_status;

-- Step 3: Drop the status column
ALTER TABLE stores DROP COLUMN IF EXISTS status;

-- ROLLBACK (data will be lost — use stage to reconstruct if needed):
-- ALTER TABLE stores ADD COLUMN status VARCHAR(20) DEFAULT 'active';
-- UPDATE stores SET status = CASE WHEN is_active = TRUE THEN 'active' ELSE 'stopped' END;
