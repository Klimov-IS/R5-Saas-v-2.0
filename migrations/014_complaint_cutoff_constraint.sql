-- Migration 014: Add CHECK constraint to prevent complaints on reviews before WB cutoff date
--
-- WB rule: complaints can only be submitted for reviews from October 1, 2023 onwards.
-- This constraint provides defense-in-depth — even if application code fails to filter,
-- the database will reject the INSERT.
--
-- Prerequisite: Run cleanup-pre-cutoff-complaints.mjs first to delete existing violations.
--
-- Related: TASK-20260215-complaint-system-fixes

ALTER TABLE review_complaints
ADD CONSTRAINT check_review_date_after_cutoff
CHECK (review_date >= '2023-10-01');
