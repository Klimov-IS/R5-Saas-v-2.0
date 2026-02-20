-- ============================================
-- Migration 020: Add filed_by and complaint_filed_date to review_complaints
-- Date: 2026-02-20
-- Description: Track who filed the complaint (R5 vs seller) and when.
--              Enables billing analytics (R5 filed + approved = billable).
-- ============================================

-- Who filed the complaint: 'r5' (via our system) or 'seller' (manually by seller)
ALTER TABLE review_complaints
  ADD COLUMN IF NOT EXISTS filed_by TEXT NULL;

-- Date when the complaint was filed on WB (parsed from WB complaints page)
ALTER TABLE review_complaints
  ADD COLUMN IF NOT EXISTS complaint_filed_date DATE NULL;

-- Also add to reviews table for denormalized fast queries
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS complaint_filed_by TEXT NULL;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS complaint_filed_date DATE NULL;

-- Index for billing analytics: R5-filed approved complaints
CREATE INDEX IF NOT EXISTS idx_rc_filed_by_status
  ON review_complaints(filed_by, status)
  WHERE filed_by = 'r5' AND status = 'approved';

-- Index on reviews for quick filtering
CREATE INDEX IF NOT EXISTS idx_reviews_complaint_filed
  ON reviews(complaint_filed_by, complaint_status)
  WHERE complaint_filed_by IS NOT NULL;

COMMENT ON COLUMN review_complaints.filed_by IS 'Who filed the complaint: r5 (via R5 system) or seller (manually by seller on WB)';
COMMENT ON COLUMN review_complaints.complaint_filed_date IS 'Date when complaint was filed on WB (from WB complaints page)';
COMMENT ON COLUMN reviews.complaint_filed_by IS 'Denormalized: who filed the complaint (r5 or seller)';
COMMENT ON COLUMN reviews.complaint_filed_date IS 'Denormalized: date complaint was filed on WB';
