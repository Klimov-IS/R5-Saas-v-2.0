-- Migration 023: Align review statuses 1:1 with WB
--
-- Problems fixed:
-- 1. "Снят с публикации" was mapped to 'deleted' → should be 'unpublished'
-- 2. "Временно скрыт" (218 reviews) had no mapping → new ENUM 'temporarily_hidden'
-- 3. "Исключён из рейтинга" had no mapping (ENUM 'excluded' existed but wasn't used)
-- 4. "Возврат" and "Запрошен возврат" had no ENUM values
-- 5. ~2756 reviews wrongly marked 'deleted' need backfill to 'unpublished'

-- Step 1: Add 'temporarily_hidden' to review_status_wb ENUM
ALTER TYPE review_status_wb ADD VALUE IF NOT EXISTS 'temporarily_hidden';

-- Step 2: Add 'returned' and 'return_requested' to product_status_by_review ENUM
ALTER TYPE product_status_by_review ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE product_status_by_review ADD VALUE IF NOT EXISTS 'return_requested';

-- Step 3: Backfill wrongly-marked reviews
-- Reviews marked 'deleted' by extension mapping ("Снят с публикации" → 'deleted')
-- should be 'unpublished'. True deletions have deleted_from_wb_at set by full sync.
-- Discriminator: deleted_from_wb_at IS NULL = set by extension (wrong), NOT NULL = set by full sync (correct)
UPDATE reviews
SET review_status_wb = 'unpublished', updated_at = NOW()
WHERE review_status_wb = 'deleted'
  AND deleted_from_wb_at IS NULL;
