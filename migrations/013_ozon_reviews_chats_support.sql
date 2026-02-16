-- ============================================
-- Migration 013: OZON Reviews & Chats Support
-- Date: 2026-02-16
-- Sprint: 002-003 (OZON Reviews + Chats)
-- Description:
--   Add marketplace discriminator and OZON-specific fields to
--   reviews, chats, and chat_messages tables.
--   Existing WB data gets marketplace='wb' by default.
-- ============================================

-- ============================================================================
-- 1. Reviews: marketplace + OZON fields
-- ============================================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS marketplace TEXT NOT NULL DEFAULT 'wb';

-- OZON review status (PROCESSED / UNPROCESSED) — WB uses different workflow
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ozon_review_status TEXT;

-- OZON order status (DELIVERED / CANCELLED)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ozon_order_status TEXT;

-- Whether review participates in seller rating
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_rating_participant BOOLEAN;

-- OZON engagement metrics
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS likes_amount INT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS dislikes_amount INT;

-- OZON SKU (for product linking — separate from product_id)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ozon_sku TEXT;

-- OZON comment tracking (seller's reply)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ozon_comment_id TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ozon_comments_amount INT;

-- ============================================================================
-- 2. Chats: marketplace + OZON fields
-- ============================================================================

ALTER TABLE chats ADD COLUMN IF NOT EXISTS marketplace TEXT NOT NULL DEFAULT 'wb';

-- OZON chat type (BUYER_SELLER, SELLER_SUPPORT, UNSPECIFIED)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS ozon_chat_type TEXT;

-- OZON chat status (OPENED, CLOSED)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS ozon_chat_status TEXT;

-- OZON unread tracking
ALTER TABLE chats ADD COLUMN IF NOT EXISTS ozon_unread_count INT;

-- OZON last message ID (for incremental history fetch)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS ozon_last_message_id TEXT;

-- ============================================================================
-- 3. Chat messages: marketplace
-- ============================================================================

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS marketplace TEXT NOT NULL DEFAULT 'wb';

-- ============================================================================
-- 4. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reviews_marketplace ON reviews(marketplace);
CREATE INDEX IF NOT EXISTS idx_reviews_ozon_sku ON reviews(ozon_sku) WHERE ozon_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chats_marketplace ON chats(marketplace);
CREATE INDEX IF NOT EXISTS idx_chat_messages_marketplace ON chat_messages(marketplace);
