-- ============================================
-- Create product_rules table
-- Date: 2026-01-06
-- Description: Правила работы с артикулами (жалобы, чаты, компенсации)
-- ============================================

-- Create product_rules table
CREATE TABLE IF NOT EXISTS product_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL,
  store_id TEXT NOT NULL,

  -- Жалобы (Complaints)
  submit_complaints BOOLEAN DEFAULT false,
  complaint_rating_1 BOOLEAN DEFAULT false,
  complaint_rating_2 BOOLEAN DEFAULT false,
  complaint_rating_3 BOOLEAN DEFAULT false,
  complaint_rating_4 BOOLEAN DEFAULT false,

  -- Чаты (Chats)
  work_in_chats BOOLEAN DEFAULT false,
  chat_rating_1 BOOLEAN DEFAULT false,
  chat_rating_2 BOOLEAN DEFAULT false,
  chat_rating_3 BOOLEAN DEFAULT false,
  chat_rating_4 BOOLEAN DEFAULT false,

  -- Компенсация (Compensation)
  offer_compensation BOOLEAN DEFAULT false,
  compensation_type TEXT,
  max_compensation TEXT,
  compensation_by TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_rules_product_id ON product_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_product_rules_store_id ON product_rules(store_id);
CREATE INDEX IF NOT EXISTS idx_product_rules_submit_complaints ON product_rules(submit_complaints);
CREATE INDEX IF NOT EXISTS idx_product_rules_work_in_chats ON product_rules(work_in_chats);
CREATE INDEX IF NOT EXISTS idx_product_rules_offer_compensation ON product_rules(offer_compensation);

-- Add comments
COMMENT ON TABLE product_rules IS 'Правила автоматизации работы с товарами (жалобы, чаты, компенсации)';
COMMENT ON COLUMN product_rules.submit_complaints IS 'Подавать жалобы на отзывы?';
COMMENT ON COLUMN product_rules.work_in_chats IS 'Работать в чатах с клиентами?';
COMMENT ON COLUMN product_rules.offer_compensation IS 'Предлагать компенсацию покупателям?';
COMMENT ON COLUMN product_rules.compensation_type IS 'Тип компенсации: возврат, скидка, подарок';
COMMENT ON COLUMN product_rules.max_compensation IS 'Максимальная сумма компенсации';
COMMENT ON COLUMN product_rules.compensation_by IS 'Кто осуществляет компенсацию: продавец, магазин';
