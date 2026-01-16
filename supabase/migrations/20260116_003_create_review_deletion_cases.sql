-- Migration: Create review_deletion_cases tracking table
-- Created: 2026-01-16
-- Purpose: Track deletion workflow from candidate → confirmed (Stage 3)

-- ============================================================================
-- Step 1: Create ENUM for deletion case status
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deletion_case_status') THEN
    CREATE TYPE deletion_case_status AS ENUM (
      'offer_generated',     -- AI generated offer message
      'offer_sent',          -- Offer sent to client
      'client_replied',      -- Client responded (checking for agreement)
      'agreed',              -- Client agreed to delete
      'refund_processing',   -- Seller processing refund/cashback
      'refund_completed',    -- Refund sent to client
      'deletion_pending',    -- Waiting for review deletion
      'deletion_confirmed',  -- Review deleted (confirmed via WB API/manual)
      'failed',              -- Failed (client refused or timeout)
      'cancelled'            -- Cancelled by seller/system
    );
  END IF;
END $$;

-- ============================================================================
-- Step 2: Create review_deletion_cases table
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_deletion_cases (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- References
  store_id                TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id                 TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  review_id               TEXT NULL REFERENCES reviews(id) ON DELETE SET NULL,
  product_id              TEXT NULL REFERENCES products(id) ON DELETE SET NULL,

  -- Case details
  status                  deletion_case_status NOT NULL DEFAULT 'offer_generated',

  -- Offer details
  offer_amount            INTEGER NOT NULL,  -- Rubles
  compensation_type       TEXT NOT NULL,     -- 'cashback' | 'refund'
  offer_message           TEXT NOT NULL,     -- AI-generated message
  offer_strategy          TEXT NULL,         -- 'upgrade_to_5' | 'delete' | 'both'

  -- Client interaction
  client_name             TEXT NOT NULL,
  client_response         TEXT NULL,         -- Last message from client
  client_agreed_at        TIMESTAMP WITHOUT TIME ZONE NULL,

  -- Review details
  review_rating           INTEGER NULL,      -- 1-5 stars
  review_text             TEXT NULL,
  review_status_before    TEXT NULL,         -- Status before deletion
  review_deleted_at       TIMESTAMP WITHOUT TIME ZONE NULL,

  -- Financial tracking
  refund_processed_at     TIMESTAMP WITHOUT TIME ZONE NULL,
  refund_amount           INTEGER NULL,      -- Actual refund sent (may differ from offer)
  revenue_charged         INTEGER NULL,      -- 600₽ charged to seller (if confirmed)
  revenue_charged_at      TIMESTAMP WITHOUT TIME ZONE NULL,

  -- AI metadata
  ai_confidence           DECIMAL(3,2) NULL, -- 0.00-1.00
  ai_estimated_success    DECIMAL(3,2) NULL, -- AI prediction
  triggers_detected       TEXT[] NULL,       -- Array of trigger phrases

  -- Workflow tracking
  offer_generated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  offer_sent_at           TIMESTAMP WITHOUT TIME ZONE NULL,
  last_updated_at         TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),

  -- Failure tracking
  failed_at               TIMESTAMP WITHOUT TIME ZONE NULL,
  failure_reason          TEXT NULL,

  -- Metadata
  metadata                JSONB NULL,

  created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Step 3: Create indexes for common queries
-- ============================================================================

-- Lookup by chat_id (primary use case)
CREATE INDEX IF NOT EXISTS idx_deletion_cases_chat
ON review_deletion_cases(chat_id);

-- Filter by store and status
CREATE INDEX IF NOT EXISTS idx_deletion_cases_store_status
ON review_deletion_cases(store_id, status, created_at DESC);

-- Find pending deletions (for CRON job)
CREATE INDEX IF NOT EXISTS idx_deletion_cases_pending_deletion
ON review_deletion_cases(status, review_id)
WHERE status = 'deletion_pending';

-- Revenue tracking
CREATE INDEX IF NOT EXISTS idx_deletion_cases_revenue
ON review_deletion_cases(store_id, status, revenue_charged_at DESC)
WHERE status = 'deletion_confirmed';

-- Analytics: conversion funnel
CREATE INDEX IF NOT EXISTS idx_deletion_cases_created_at
ON review_deletion_cases(store_id, created_at DESC);

-- ============================================================================
-- Step 4: Create trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_deletion_case_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_deletion_case_updated_at ON review_deletion_cases;
CREATE TRIGGER trigger_update_deletion_case_updated_at
  BEFORE UPDATE ON review_deletion_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_deletion_case_updated_at();

-- ============================================================================
-- Step 5: Add constraints
-- ============================================================================

-- Ensure offer_amount is positive
ALTER TABLE review_deletion_cases
ADD CONSTRAINT check_offer_amount_positive
CHECK (offer_amount > 0);

-- Ensure revenue is 600 rubles if charged
ALTER TABLE review_deletion_cases
ADD CONSTRAINT check_revenue_amount
CHECK (revenue_charged IS NULL OR revenue_charged = 600);

-- Ensure refund doesn't exceed offer
ALTER TABLE review_deletion_cases
ADD CONSTRAINT check_refund_not_exceed_offer
CHECK (refund_amount IS NULL OR refund_amount <= offer_amount);

-- ============================================================================
-- Step 6: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE review_deletion_cases IS 'Tracks deletion workflow from AI offer generation to confirmed deletion. Business model: 600₽ revenue per confirmed deletion.';
COMMENT ON COLUMN review_deletion_cases.offer_amount IS 'Compensation offered to client (from product_rules.max_compensation)';
COMMENT ON COLUMN review_deletion_cases.revenue_charged IS 'Always 600₽ when status=deletion_confirmed';
COMMENT ON COLUMN review_deletion_cases.ai_confidence IS 'AI classification confidence (from classify-chat-deletion)';
COMMENT ON COLUMN review_deletion_cases.ai_estimated_success IS 'AI prediction of offer acceptance rate';

-- ============================================================================
-- Step 7: Sample query for analytics dashboard
-- ============================================================================

-- Deletion funnel metrics
COMMENT ON TABLE review_deletion_cases IS 'Deletion funnel metrics:
SELECT
  status,
  COUNT(*) as count,
  AVG(offer_amount) as avg_offer,
  SUM(revenue_charged) as total_revenue
FROM review_deletion_cases
WHERE store_id = ''xxx''
  AND created_at >= NOW() - INTERVAL ''30 days''
GROUP BY status
ORDER BY
  CASE status
    WHEN ''offer_generated'' THEN 1
    WHEN ''offer_sent'' THEN 2
    WHEN ''client_replied'' THEN 3
    WHEN ''agreed'' THEN 4
    WHEN ''refund_completed'' THEN 5
    WHEN ''deletion_confirmed'' THEN 6
    ELSE 99
  END;
';

-- ============================================================================
-- Verification
-- ============================================================================

-- Check table exists
-- SELECT * FROM review_deletion_cases LIMIT 1;

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'review_deletion_cases';
