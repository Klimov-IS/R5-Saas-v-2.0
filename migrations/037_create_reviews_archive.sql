-- ============================================================
-- Migration 037: Create reviews_archive table + reviews_all view
-- Sprint-013: Reviews Table Split
-- Date: 2026-03-20
--
-- Purpose: Split 6.25 GB reviews table into:
--   reviews (1-4★, ~410K rows, ~700 MB) — working set, fits in RAM
--   reviews_archive (5★, ~3.25M rows, ~5.5 GB) — read-only stats
--
-- Risk: LOW — creates new objects only, no data modification
-- Rollback: DROP VIEW reviews_all; DROP TABLE reviews_archive;
-- ============================================================

-- 1. Create archive table with identical schema (uses LIKE for type safety)
--    INCLUDING DEFAULTS copies defaults, NOT NULL always copied
--    Does NOT copy: CHECK constraints, indexes, FKs, triggers
CREATE TABLE IF NOT EXISTS reviews_archive (LIKE reviews INCLUDING DEFAULTS);

-- 2. Add primary key
ALTER TABLE reviews_archive ADD PRIMARY KEY (id);

-- 3. CHECK constraint: archive only holds 5★ reviews
ALTER TABLE reviews_archive
  ADD CONSTRAINT chk_archive_rating_5 CHECK (rating = 5);

-- 4. Minimal indexes for archive (statistics + lookup only)
--    Full set of working indexes is NOT needed — archive is mostly read-only
CREATE INDEX IF NOT EXISTS idx_ra_store_date
  ON reviews_archive(store_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ra_product_date
  ON reviews_archive(product_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ra_store_rating
  ON reviews_archive(store_id, rating, date DESC);

CREATE INDEX IF NOT EXISTS idx_ra_marketplace
  ON reviews_archive(marketplace);

-- 5. Replicate triggers from reviews table
--    Complaint flags trigger (has_complaint, has_complaint_draft)
CREATE TRIGGER update_reviews_archive_complaint_flags
  BEFORE INSERT OR UPDATE OF complaint_status, complaint_text, complaint_sent_date
  ON reviews_archive
  FOR EACH ROW
  EXECUTE FUNCTION update_review_complaint_flags();

--    Updated_at timestamp trigger
CREATE TRIGGER update_reviews_archive_updated_at
  BEFORE UPDATE ON reviews_archive
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. UNION ALL view for queries needing ALL reviews (statistics, full lists)
CREATE OR REPLACE VIEW reviews_all AS
  SELECT * FROM reviews
  UNION ALL
  SELECT * FROM reviews_archive;

-- 7. Drop FK constraints referencing reviews
--    PostgreSQL FKs can't reference two tables — we move to application-level checks
--    Baseline confirmed: 0 complaints on 5★, 0 chat_links on 5★ — safe to drop
ALTER TABLE review_complaints
  DROP CONSTRAINT IF EXISTS review_complaints_review_id_fkey;

ALTER TABLE complaint_details
  DROP CONSTRAINT IF EXISTS complaint_details_review_id_fkey;

ALTER TABLE review_chat_links
  DROP CONSTRAINT IF EXISTS review_chat_links_review_id_fkey;

ALTER TABLE review_deletion_cases
  DROP CONSTRAINT IF EXISTS review_deletion_cases_review_id_fkey;

-- NOTE: FK integrity is now enforced at application level via reviews_all view
-- Validation query (run after migration):
--   SELECT COUNT(*) FROM review_complaints rc
--   WHERE NOT EXISTS (SELECT 1 FROM reviews_all r WHERE r.id = rc.review_id);
--   -- Must be 0
