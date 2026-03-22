-- Migration 038: Per-rating compensation amounts
-- Allows different compensation amounts for 1★, 2★, 3★ reviews per product
-- When per_rating_compensation = false (default), max_compensation is used for all ratings

ALTER TABLE product_rules
  ADD COLUMN IF NOT EXISTS per_rating_compensation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS compensation_1star TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_2star TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_3star TEXT DEFAULT NULL;
