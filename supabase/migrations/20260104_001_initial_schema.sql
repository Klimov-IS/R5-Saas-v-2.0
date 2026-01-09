-- ============================================
-- WB Reputation Manager: Initial Schema Migration
-- Date: 2026-01-04
-- Description: Full database schema migrated from Firebase Firestore
-- ============================================

-- ============================================
-- Helper Functions
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Table: users
-- User profiles (Firebase Authentication)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,  -- Firebase UID
  email TEXT NOT NULL UNIQUE,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_approved ON users(is_approved);

COMMENT ON TABLE users IS 'User profiles from Firebase Authentication';
COMMENT ON COLUMN users.id IS 'Firebase UID';
COMMENT ON COLUMN users.is_approved IS 'Whether user is approved by admin';

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: user_settings
-- User AI settings and API keys
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,  -- User ID (same as users.id)

  -- Deepseek AI
  deepseek_api_key TEXT,
  api_key TEXT,  -- Legacy/alternative API key
  ai_concurrency INTEGER DEFAULT 5,

  -- AI Prompts
  prompt_chat_reply TEXT,
  prompt_chat_tag TEXT,
  prompt_question_reply TEXT,
  prompt_review_complaint TEXT,
  prompt_review_reply TEXT,

  -- Legacy OpenAI fields (kept for migration compatibility)
  openai_api_key TEXT,
  assistant_chat_reply TEXT,
  assistant_chat_tag TEXT,
  assistant_question_reply TEXT,
  assistant_review_complaint TEXT,
  assistant_review_reply TEXT,

  -- No-reply automation (set 1)
  no_reply_messages JSONB DEFAULT '[]'::jsonb,
  no_reply_trigger_phrase TEXT,
  no_reply_stop_message TEXT,

  -- No-reply automation (set 2)
  no_reply_messages2 JSONB DEFAULT '[]'::jsonb,
  no_reply_trigger_phrase2 TEXT,
  no_reply_stop_message2 TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE user_settings IS 'User AI settings and API keys';
COMMENT ON COLUMN user_settings.deepseek_api_key IS 'Deepseek API key for AI generation';
COMMENT ON COLUMN user_settings.no_reply_messages IS 'Messages to send for no-reply automation (JSON array)';

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: stores
-- Wildberries stores
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  -- API Tokens
  api_token TEXT NOT NULL,  -- Universal token
  content_api_token TEXT,   -- For products
  feedbacks_api_token TEXT, -- For reviews and questions
  chat_api_token TEXT,      -- For chats

  -- Auto no-reply feature
  is_auto_no_reply_enabled BOOLEAN DEFAULT FALSE,

  -- Product sync status
  last_product_update_status TEXT CHECK (last_product_update_status IN ('idle', 'pending', 'success', 'error')),
  last_product_update_date TIMESTAMPTZ,
  last_product_update_error TEXT,

  -- Review sync status
  last_review_update_status TEXT CHECK (last_review_update_status IN ('idle', 'pending', 'success', 'error')),
  last_review_update_date TIMESTAMPTZ,
  last_review_update_error TEXT,

  -- Chat sync status
  last_chat_update_status TEXT CHECK (last_chat_update_status IN ('idle', 'pending', 'success', 'error')),
  last_chat_update_date TIMESTAMPTZ,
  last_chat_update_next TEXT,  -- Cursor for pagination
  last_chat_update_error TEXT,

  -- Question sync status
  last_question_update_status TEXT CHECK (last_question_update_status IN ('idle', 'pending', 'success', 'error')),
  last_question_update_date TIMESTAMPTZ,
  last_question_update_error TEXT,

  -- Denormalized stats
  total_reviews INTEGER DEFAULT 0,
  total_chats INTEGER DEFAULT 0,
  chat_tag_counts JSONB DEFAULT '{}'::jsonb,  -- { "active": 10, "no_reply": 5, ... }

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_name ON stores(name);

COMMENT ON TABLE stores IS 'Wildberries stores';
COMMENT ON COLUMN stores.api_token IS 'Universal WB API token';
COMMENT ON COLUMN stores.chat_tag_counts IS 'Chat tag counts (JSON object)';

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: products
-- Products from WB Content API
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  -- Product data
  name TEXT NOT NULL,
  wb_product_id TEXT NOT NULL,  -- nmID from WB
  vendor_code TEXT NOT NULL,
  price INTEGER,
  image_url TEXT,

  -- Stats and settings
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  compensation_method TEXT,

  -- Metadata
  wb_api_data JSONB,  -- Full JSON from WB API
  last_review_update_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_wb_id ON products(wb_product_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX idx_products_unique_wb_id ON products(store_id, wb_product_id);

COMMENT ON TABLE products IS 'Products from WB Content API';
COMMENT ON COLUMN products.wb_product_id IS 'nmID from Wildberries';
COMMENT ON COLUMN products.wb_api_data IS 'Full JSON response from WB API';

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: reviews
-- Product reviews from WB Feedbacks API
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  store_id TEXT NOT NULL,  -- Denormalized for faster queries
  owner_id TEXT NOT NULL,

  -- Review content
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  pros TEXT,
  cons TEXT,
  author TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,

  -- Answer from seller
  answer JSONB,  -- { "text": "...", "state": "..." }

  -- Media
  photo_links JSONB,  -- Array of photo URLs
  video JSONB,

  -- WB complaint valuations
  supplier_feedback_valuation INTEGER,
  supplier_product_valuation INTEGER,

  -- Manual complaint
  complaint_text TEXT,
  complaint_sent_date TIMESTAMPTZ,

  -- AI draft reply
  draft_reply TEXT,
  draft_reply_thread_id TEXT,

  -- Denormalized fields for querying
  is_product_active BOOLEAN DEFAULT TRUE,
  has_answer BOOLEAN DEFAULT FALSE,
  has_complaint BOOLEAN DEFAULT FALSE,
  has_complaint_draft BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for fast queries (matching Firestore indexes)
CREATE INDEX idx_reviews_store_date ON reviews(store_id, date DESC);
CREATE INDEX idx_reviews_store_rating_date ON reviews(store_id, rating, date DESC);
CREATE INDEX idx_reviews_store_answer_date ON reviews(store_id, has_answer, date DESC);
CREATE INDEX idx_reviews_store_complaint_date ON reviews(store_id, has_complaint_draft, date DESC);
CREATE INDEX idx_reviews_product ON reviews(product_id);

COMMENT ON TABLE reviews IS 'Product reviews from WB Feedbacks API';
COMMENT ON COLUMN reviews.answer IS 'Seller answer (JSON object with text and state)';
COMMENT ON COLUMN reviews.has_answer IS 'Denormalized: whether review has an answer';
COMMENT ON COLUMN reviews.has_complaint IS 'Denormalized: whether complaint was sent';

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: chats
-- Customer chats from WB Chat API
-- ============================================
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,  -- WB chatID
  store_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  -- Client info
  client_name TEXT NOT NULL,
  reply_sign TEXT NOT NULL,

  -- Product info
  product_nm_id TEXT,
  product_name TEXT,
  product_vendor_code TEXT,

  -- Last message
  last_message_date TIMESTAMPTZ,
  last_message_text TEXT,
  last_message_sender TEXT CHECK (last_message_sender IN ('client', 'seller')),

  -- Chat tag (AI classification)
  tag TEXT NOT NULL DEFAULT 'untagged' CHECK (tag IN ('untagged', 'active', 'successful', 'unsuccessful', 'no_reply', 'completed')),
  tag_update_date TIMESTAMPTZ,

  -- AI draft reply
  draft_reply TEXT,
  draft_reply_thread_id TEXT,

  -- No-reply automation
  sent_no_reply_messages JSONB DEFAULT '[]'::jsonb,
  sent_no_reply_messages2 JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chats_store ON chats(store_id);
CREATE INDEX idx_chats_store_tag ON chats(store_id, tag);
CREATE INDEX idx_chats_last_message ON chats(last_message_date DESC);
CREATE INDEX idx_chats_product ON chats(product_nm_id) WHERE product_nm_id IS NOT NULL;

COMMENT ON TABLE chats IS 'Customer chats from WB Chat API';
COMMENT ON COLUMN chats.id IS 'WB chatID';
COMMENT ON COLUMN chats.tag IS 'AI-classified chat tag';
COMMENT ON COLUMN chats.sent_no_reply_messages IS 'Sent no-reply messages (JSON array)';

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: chat_messages
-- Messages in customer chats
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,  -- WB eventID
  chat_id TEXT NOT NULL,
  store_id TEXT NOT NULL,  -- Denormalized
  owner_id TEXT NOT NULL,

  -- Message data
  text TEXT,
  sender TEXT NOT NULL CHECK (sender IN ('client', 'seller')),
  timestamp TIMESTAMPTZ NOT NULL,
  download_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id, timestamp ASC);
CREATE INDEX idx_chat_messages_store ON chat_messages(store_id);

COMMENT ON TABLE chat_messages IS 'Messages in customer chats';
COMMENT ON COLUMN chat_messages.id IS 'WB eventID';

-- ============================================
-- Table: questions
-- Customer questions from WB Questions API
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  -- Question data
  text TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL,
  was_viewed BOOLEAN DEFAULT FALSE,
  is_answered BOOLEAN DEFAULT FALSE,

  -- Answer from seller
  answer JSONB,  -- { "text": "...", "editable": true, "createDate": "..." }

  -- Product details
  product_nm_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_supplier_article TEXT,
  product_brand_name TEXT,

  -- AI draft reply
  draft_reply_thread_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_questions_store ON questions(store_id);
CREATE INDEX idx_questions_store_answered ON questions(store_id, is_answered);
CREATE INDEX idx_questions_created ON questions(created_date DESC);
CREATE INDEX idx_questions_product ON questions(product_nm_id);

COMMENT ON TABLE questions IS 'Customer questions from WB Questions API';
COMMENT ON COLUMN questions.answer IS 'Seller answer (JSON object)';

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: ai_logs
-- Logs of AI API calls
-- ============================================
CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Log data
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation TEXT NOT NULL,  -- e.g., "generate-review-reply"
  system_prompt TEXT NOT NULL,
  user_content TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ai_logs_timestamp ON ai_logs(timestamp DESC);
CREATE INDEX idx_ai_logs_operation ON ai_logs(operation);
CREATE INDEX idx_ai_logs_status ON ai_logs(status);

COMMENT ON TABLE ai_logs IS 'Logs of AI API calls (Deepseek)';
COMMENT ON COLUMN ai_logs.operation IS 'Type of AI operation (e.g., generate-review-reply)';

-- ============================================
-- Summary
-- ============================================

-- Tables created:
-- 1. users (3 columns + metadata)
-- 2. user_settings (20+ columns)
-- 3. stores (20+ columns + denormalized stats)
-- 4. products (13 columns + WB data)
-- 5. reviews (23 columns + denormalized fields)
-- 6. chats (16 columns + AI tags)
-- 7. chat_messages (8 columns)
-- 8. questions (14 columns)
-- 9. ai_logs (7 columns)

-- Foreign Keys:
-- - user_settings → users
-- - stores → users (owner)
-- - products → stores, users
-- - reviews → products, stores, users
-- - chats → stores, users
-- - chat_messages → chats, stores, users
-- - questions → stores, users

-- Indexes: 30+ indexes for fast queries

-- Ready for data migration from Firebase!
