-- ============================================
-- Review Complaints Table Migration
-- Date: 2026-01-09
-- Description: Dedicated table for review complaints with full analytics
-- Relationship: 1:1 with reviews (one complaint per review)
-- ============================================

-- ============================================
-- Table: review_complaints
-- Жалобы на отзывы с полной аналитикой и отчетностью
-- ============================================
CREATE TABLE IF NOT EXISTS review_complaints (
  -- Primary & Foreign Keys
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  review_id TEXT NOT NULL UNIQUE,  -- 1:1 relationship with reviews
  store_id TEXT NOT NULL,  -- Denormalized for fast queries
  owner_id TEXT NOT NULL,
  product_id TEXT NOT NULL,  -- Denormalized for analytics

  -- Complaint Content
  complaint_text TEXT NOT NULL,  -- Extracted plain text from AI response
  reason_id INTEGER NOT NULL,  -- WB category ID (11-20)
  reason_name TEXT NOT NULL,  -- WB category name (e.g., "Отзыв не относится к товару")

  -- Complaint Status Lifecycle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'pending')),

  -- Draft stage
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When AI generated
  regenerated_count INTEGER DEFAULT 0,  -- How many times regenerated
  last_regenerated_at TIMESTAMPTZ,  -- Last regeneration timestamp

  -- Sent stage
  sent_at TIMESTAMPTZ,  -- When marked as sent to WB
  sent_by_user_id TEXT,  -- Who sent it (manual action)

  -- WB moderation result
  moderated_at TIMESTAMPTZ,  -- When WB reviewed the complaint
  wb_response TEXT,  -- WB moderation response/reason (if any)

  -- AI Generation Metadata (for cost tracking & optimization)
  ai_model TEXT DEFAULT 'deepseek-chat',  -- Model used
  ai_prompt_tokens INTEGER,  -- Input tokens used
  ai_completion_tokens INTEGER,  -- Output tokens generated
  ai_total_tokens INTEGER,  -- Total tokens
  ai_cost_usd DECIMAL(10, 6),  -- Cost in USD ($0.14 per 1M input tokens)
  generation_duration_ms INTEGER,  -- Time to generate in milliseconds

  -- Review snapshot (for historical reference)
  review_rating INTEGER NOT NULL,  -- Review rating at time of generation
  review_text TEXT NOT NULL,  -- Review text snapshot
  review_date TIMESTAMPTZ NOT NULL,  -- Review date

  -- Product snapshot (for analytics)
  product_name TEXT,
  product_vendor_code TEXT,
  product_is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Foreign Keys
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- Indexes for Analytics & Performance
-- ============================================

-- Primary queries
CREATE INDEX idx_complaints_review ON review_complaints(review_id);
CREATE INDEX idx_complaints_store_status ON review_complaints(store_id, status, created_at DESC);
CREATE INDEX idx_complaints_owner_status ON review_complaints(owner_id, status, created_at DESC);

-- Analytics queries
CREATE INDEX idx_complaints_store_generated ON review_complaints(store_id, generated_at DESC);
CREATE INDEX idx_complaints_store_sent ON review_complaints(store_id, sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_complaints_status_moderated ON review_complaints(status, moderated_at DESC) WHERE moderated_at IS NOT NULL;
CREATE INDEX idx_complaints_reason ON review_complaints(reason_id, reason_name);
CREATE INDEX idx_complaints_product ON review_complaints(product_id, status);

-- Cost tracking queries
CREATE INDEX idx_complaints_cost_date ON review_complaints(generated_at DESC, ai_cost_usd) WHERE ai_cost_usd IS NOT NULL;

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE review_complaints IS 'Жалобы на отзывы с полной аналитикой (1:1 с reviews)';
COMMENT ON COLUMN review_complaints.review_id IS 'UNIQUE constraint ensures 1:1 relationship';
COMMENT ON COLUMN review_complaints.status IS 'draft: черновик | sent: отправлена | approved: одобрена WB | rejected: отклонена WB | pending: на рассмотрении';
COMMENT ON COLUMN review_complaints.reason_id IS 'WB complaint category ID (11-20)';
COMMENT ON COLUMN review_complaints.regenerated_count IS 'How many times user clicked "Regenerate"';
COMMENT ON COLUMN review_complaints.ai_cost_usd IS 'Deepseek cost: $0.14 per 1M input tokens, $0.28 per 1M output tokens';

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================
CREATE TRIGGER update_review_complaints_updated_at
  BEFORE UPDATE ON review_complaints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Migration: Copy existing complaints from reviews table
-- ============================================
INSERT INTO review_complaints (
  review_id,
  store_id,
  owner_id,
  product_id,
  complaint_text,
  reason_id,
  reason_name,
  status,
  generated_at,
  sent_at,
  review_rating,
  review_text,
  review_date,
  product_name,
  product_vendor_code,
  product_is_active
)
SELECT
  r.id as review_id,
  r.store_id,
  r.owner_id,
  r.product_id,

  -- Extract complaint text (remove JSON wrapper if exists)
  CASE
    WHEN r.complaint_text ~ '```json' THEN
      (regexp_match(r.complaint_text, '"complaintText":\s*"([^"]+)"'))[1]
    ELSE
      r.complaint_text
  END as complaint_text,

  -- Default values for reason (we don't have this data yet)
  11 as reason_id,
  'Отзыв не относится к товару' as reason_name,

  -- Determine status
  CASE
    WHEN r.complaint_sent_date IS NOT NULL THEN 'sent'
    WHEN r.has_complaint_draft = TRUE THEN 'draft'
    ELSE 'draft'
  END as status,

  -- Timestamps
  r.updated_at as generated_at,  -- Best guess
  r.complaint_sent_date as sent_at,

  -- Review snapshot
  r.rating as review_rating,
  r.text as review_text,
  r.date as review_date,

  -- Product snapshot (join with products table)
  p.name as product_name,
  p.vendor_code as product_vendor_code,
  r.is_product_active as product_is_active

FROM reviews r
LEFT JOIN products p ON r.product_id = p.id
WHERE r.complaint_text IS NOT NULL  -- Only migrate reviews that have complaints
ON CONFLICT (review_id) DO NOTHING;  -- Skip if already migrated

-- ============================================
-- Update reviews table denormalized fields
-- ============================================
UPDATE reviews r
SET
  has_complaint = TRUE,
  has_complaint_draft = (
    SELECT c.status = 'draft'
    FROM review_complaints c
    WHERE c.review_id = r.id
  )
WHERE r.id IN (
  SELECT review_id FROM review_complaints
);
