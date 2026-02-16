-- Migration 016: Review-Chat Links (Sprint 002)
--
-- Purpose: Create table to store review↔chat associations created by Chrome Extension.
-- The extension opens chats from the WB reviews page and reports the link back to backend.
--
-- Key design:
-- - review_id nullable (matched asynchronously via fuzzy date/rating)
-- - chat_id nullable (populated by dialogue sync reconciliation)
-- - UNIQUE(store_id, review_key) prevents duplicates per review
-- - Status tracks extension workflow progress

CREATE TABLE IF NOT EXISTS review_chat_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Review side (from extension)
  review_id TEXT REFERENCES reviews(id) ON DELETE SET NULL,
  review_key TEXT NOT NULL,
  review_nm_id TEXT NOT NULL,
  review_rating INTEGER NOT NULL,
  review_date TIMESTAMPTZ NOT NULL,

  -- Chat side (from extension + reconciliation)
  chat_id TEXT REFERENCES chats(id) ON DELETE SET NULL,
  chat_url TEXT NOT NULL,
  system_message_text TEXT,
  parsed_nm_id TEXT,
  parsed_product_title TEXT,

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'chat_opened'
    CHECK (status IN (
      'chat_opened',
      'anchor_found',
      'anchor_not_found',
      'message_sent',
      'message_skipped',
      'message_failed',
      'completed',
      'error'
    )),
  message_type TEXT CHECK (message_type IN ('A', 'B') OR message_type IS NULL),
  message_text TEXT,
  message_sent_at TIMESTAMPTZ,

  -- Error tracking
  error_code TEXT,
  error_message TEXT,
  error_stage TEXT,

  -- Timestamps
  opened_at TIMESTAMPTZ NOT NULL,
  anchor_found_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One review = one chat link per store
  UNIQUE(store_id, review_key)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_rcl_store ON review_chat_links(store_id);
CREATE INDEX IF NOT EXISTS idx_rcl_review ON review_chat_links(review_id) WHERE review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rcl_chat ON review_chat_links(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rcl_status ON review_chat_links(store_id, status);
CREATE INDEX IF NOT EXISTS idx_rcl_chat_url ON review_chat_links(chat_url);
CREATE INDEX IF NOT EXISTS idx_rcl_review_key ON review_chat_links(store_id, review_key);
