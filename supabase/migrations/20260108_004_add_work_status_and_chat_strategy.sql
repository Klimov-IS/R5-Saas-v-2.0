-- ============================================
-- Add work_status and chat_strategy fields
-- Date: 2026-01-08
-- Description: Adds work_status to products table and chat_strategy to product_rules
-- ============================================

-- ============================================
-- Part 1: Add work_status to products table
-- ============================================

-- Create ENUM type for work_status
DO $$ BEGIN
  CREATE TYPE work_status_enum AS ENUM ('not_working', 'active', 'paused', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add work_status column with default 'not_working'
ALTER TABLE products
ADD COLUMN IF NOT EXISTS work_status work_status_enum DEFAULT 'not_working';

-- Migrate existing data: is_active = true → 'active', false → 'not_working'
UPDATE products
SET work_status = CASE
  WHEN is_active = true THEN 'active'::work_status_enum
  ELSE 'not_working'::work_status_enum
END
WHERE work_status IS NULL OR work_status = 'not_working'::work_status_enum;

-- Add index for filtering by work_status
CREATE INDEX IF NOT EXISTS idx_products_work_status ON products(work_status);

-- Add comment
COMMENT ON COLUMN products.work_status IS 'Статус работы с товаром: not_working, active, paused, completed';

-- Note: is_active field is kept for backward compatibility
-- It can be removed in a future migration after frontend is updated

-- ============================================
-- Part 2: Add chat_strategy to product_rules
-- ============================================

-- Create ENUM type for chat_strategy
DO $$ BEGIN
  CREATE TYPE chat_strategy_enum AS ENUM ('upgrade_to_5', 'delete', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add chat_strategy column with default 'both'
ALTER TABLE product_rules
ADD COLUMN IF NOT EXISTS chat_strategy chat_strategy_enum DEFAULT 'both';

-- Add index for filtering by chat_strategy
CREATE INDEX IF NOT EXISTS idx_product_rules_chat_strategy ON product_rules(chat_strategy);

-- Add comment
COMMENT ON COLUMN product_rules.chat_strategy IS 'Стратегия работы в чатах: upgrade_to_5 (просить дополнить до 5⭐), delete (просить удалить), both (и то, и другое)';

-- ============================================
-- Summary
-- ============================================
-- Added:
-- 1. work_status column to products table (ENUM: not_working, active, paused, completed)
-- 2. Migration of is_active → work_status
-- 3. chat_strategy column to product_rules (ENUM: upgrade_to_5, delete, both)
-- 4. Indexes for both new columns
-- 5. Comments for documentation
