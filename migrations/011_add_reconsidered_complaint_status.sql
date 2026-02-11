-- ============================================
-- Migration 011: Add 'reconsidered' to review_complaints status CHECK
-- Date: 2026-02-11
-- Description:
--   The review_complaints table CHECK constraint only allows:
--   'draft', 'sent', 'approved', 'rejected', 'pending'
--   But the Extension review-statuses endpoint tries to set 'reconsidered'
--   (when WB reconsiders a complaint). This migration adds the missing value.
-- ============================================

-- Drop old constraint and recreate with 'reconsidered' included
ALTER TABLE review_complaints DROP CONSTRAINT IF EXISTS review_complaints_status_check;
ALTER TABLE review_complaints ADD CONSTRAINT review_complaints_status_check
    CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'pending', 'reconsidered'));
