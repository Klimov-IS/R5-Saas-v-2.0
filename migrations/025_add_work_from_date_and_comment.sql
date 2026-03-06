-- Migration 025: Add work_from_date and comment to product_rules
-- work_from_date: per-product cutoff date for review processing (replaces global COMPLAINT_CUTOFF_DATE)
-- comment: manual manager note, displayed in Google Sheets (replaces manual column U comments)

ALTER TABLE product_rules ADD COLUMN IF NOT EXISTS work_from_date DATE DEFAULT '2023-10-01';
ALTER TABLE product_rules ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL;

COMMENT ON COLUMN product_rules.work_from_date IS 'Date from which reviews are processed for this product (default: Oct 1, 2023 — WB cutoff)';
COMMENT ON COLUMN product_rules.comment IS 'Manual manager comment, displayed in Google Sheets sync';
