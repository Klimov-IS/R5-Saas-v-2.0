-- ============================================
-- Migration 012: OZON Marketplace Support
-- Date: 2026-02-12
-- Sprint: SPRINT-001-OZON-FOUNDATION (Phase 1)
-- Description:
--   Add multi-marketplace support to stores and products tables.
--   All existing data gets marketplace='wb' by default (backward compatible).
--   New columns for OZON credentials and product identifiers.
-- ============================================

-- ============================================================================
-- 1. Stores: marketplace discriminator + OZON credentials
-- ============================================================================

-- marketplace column: 'wb' or 'ozon'
ALTER TABLE stores ADD COLUMN IF NOT EXISTS marketplace TEXT NOT NULL DEFAULT 'wb';

-- OZON API credentials (only for marketplace='ozon' stores)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ozon_client_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ozon_api_key TEXT;

-- OZON subscription type (PREMIUM, PREMIUM_PLUS, PREMIUM_PRO)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ozon_subscription TEXT;

-- ============================================================================
-- 2. Products: marketplace discriminator + OZON identifiers
-- ============================================================================

-- marketplace column (matches parent store)
ALTER TABLE products ADD COLUMN IF NOT EXISTS marketplace TEXT NOT NULL DEFAULT 'wb';

-- OZON triple-ID system:
--   ozon_product_id = internal OZON ID
--   ozon_offer_id   = seller's SKU/article
--   ozon_sku        = primary SKU (FBO, source="sds")
--   ozon_fbs_sku    = FBS SKU (if available)
ALTER TABLE products ADD COLUMN IF NOT EXISTS ozon_product_id BIGINT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ozon_offer_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ozon_sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ozon_fbs_sku TEXT;

-- Description field (OZON products have rich HTML descriptions)
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================================
-- 3. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stores_marketplace ON stores(marketplace);
CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products(marketplace);
CREATE INDEX IF NOT EXISTS idx_products_ozon_product_id ON products(ozon_product_id);
CREATE INDEX IF NOT EXISTS idx_products_ozon_offer_id ON products(ozon_offer_id);

-- ============================================================================
-- 4. Constraints
-- ============================================================================

-- Ensure marketplace is valid
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_marketplace_check;
ALTER TABLE stores ADD CONSTRAINT stores_marketplace_check
  CHECK (marketplace IN ('wb', 'ozon'));

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_marketplace_check;
ALTER TABLE products ADD CONSTRAINT products_marketplace_check
  CHECK (marketplace IN ('wb', 'ozon'));
