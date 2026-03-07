-- ============================================================================
-- Migration 028: Schema Integrity Improvements
-- Date: 2026-03-06
-- Source: DB Audit Report (TASK-docs-003, Sprint 005)
-- ============================================================================
-- P2: Add missing FK constraints (store_faq, store_guides, chat_auto_sequences)
-- P3: Add stores.status CHECK constraint
-- P5: Align questions table (add marketplace, fix product_nm_id type)
-- P6: Add missing indexes for performance
-- ============================================================================

-- ============================================================================
-- SAFETY: Check for orphan records before adding FKs
-- Run these SELECT queries first to verify 0 results:
--
-- SELECT sf.id FROM store_faq sf LEFT JOIN stores s ON s.id = sf.store_id WHERE s.id IS NULL;
-- SELECT sg.id FROM store_guides sg LEFT JOIN stores s ON s.id = sg.store_id WHERE s.id IS NULL;
-- SELECT cas.id FROM chat_auto_sequences cas LEFT JOIN stores s ON s.id = cas.store_id WHERE s.id IS NULL;
-- SELECT cas.id FROM chat_auto_sequences cas LEFT JOIN users u ON u.id = cas.owner_id WHERE u.id IS NULL;
-- ============================================================================

-- ============================================================================
-- P2: Add missing Foreign Key constraints
-- ============================================================================

-- store_faq.store_id → stores(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_store_faq_store' AND table_name = 'store_faq'
  ) THEN
    -- Delete orphans first (if any)
    DELETE FROM store_faq WHERE store_id NOT IN (SELECT id FROM stores);
    ALTER TABLE store_faq
      ADD CONSTRAINT fk_store_faq_store
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
  END IF;
END $$;

-- store_guides.store_id → stores(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_store_guides_store' AND table_name = 'store_guides'
  ) THEN
    DELETE FROM store_guides WHERE store_id NOT IN (SELECT id FROM stores);
    ALTER TABLE store_guides
      ADD CONSTRAINT fk_store_guides_store
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
  END IF;
END $$;

-- chat_auto_sequences.store_id → stores(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sequences_store' AND table_name = 'chat_auto_sequences'
  ) THEN
    DELETE FROM chat_auto_sequences WHERE store_id NOT IN (SELECT id FROM stores);
    ALTER TABLE chat_auto_sequences
      ADD CONSTRAINT fk_sequences_store
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- P3: Add stores.status CHECK constraint
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_store_status' AND table_name = 'stores'
  ) THEN
    -- Fix any invalid values first
    UPDATE stores SET status = 'active'
    WHERE status NOT IN ('active', 'paused', 'stopped', 'trial', 'archived');

    ALTER TABLE stores ADD CONSTRAINT chk_store_status
      CHECK (status IN ('active', 'paused', 'stopped', 'trial', 'archived'));
  END IF;
END $$;

-- ============================================================================
-- P5: Align questions table with multi-marketplace standard
-- ============================================================================

-- Add marketplace column (consistent with products, reviews, chats)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS marketplace TEXT NOT NULL DEFAULT 'wb';

-- Fix product_nm_id type: INTEGER → TEXT (consistent with products.wb_product_id and chats.product_nm_id)
-- PostgreSQL handles INTEGER→TEXT cast gracefully
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'questions' AND column_name = 'product_nm_id';

  IF col_type = 'integer' THEN
    ALTER TABLE questions ALTER COLUMN product_nm_id TYPE TEXT USING product_nm_id::TEXT;
  END IF;
END $$;

-- ============================================================================
-- P6: Add missing indexes for performance
-- ============================================================================

-- TG queue: chats by store + status + recency (high-frequency query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_store_status_date
  ON chats(store_id, status, last_message_date DESC);

-- Cron: sequences by store (for batch processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sequences_store
  ON chat_auto_sequences(store_id);

-- Analytics: status history by change source
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_csh_source
  ON chat_status_history(change_source, created_at DESC);

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================

-- Verify FKs:
-- SELECT tc.constraint_name, tc.table_name
-- FROM information_schema.table_constraints tc
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('store_faq', 'store_guides', 'chat_auto_sequences');

-- Verify CHECK:
-- SELECT tc.constraint_name, tc.table_name
-- FROM information_schema.table_constraints tc
-- WHERE tc.constraint_type = 'CHECK' AND tc.table_name = 'stores';

-- Verify questions.product_nm_id type:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'questions' AND column_name = 'product_nm_id';

-- ============================================================================
-- Rollback
-- ============================================================================
-- ALTER TABLE store_faq DROP CONSTRAINT IF EXISTS fk_store_faq_store;
-- ALTER TABLE store_guides DROP CONSTRAINT IF EXISTS fk_store_guides_store;
-- ALTER TABLE chat_auto_sequences DROP CONSTRAINT IF EXISTS fk_sequences_store;
-- ALTER TABLE stores DROP CONSTRAINT IF EXISTS chk_store_status;
-- ALTER TABLE questions DROP COLUMN IF EXISTS marketplace;
-- ALTER TABLE questions ALTER COLUMN product_nm_id TYPE INTEGER USING product_nm_id::INTEGER;
-- DROP INDEX IF EXISTS idx_chats_store_status_date;
-- DROP INDEX IF EXISTS idx_sequences_store;
-- DROP INDEX IF EXISTS idx_csh_source;
