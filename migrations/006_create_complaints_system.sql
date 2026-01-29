/**
 * Migration: Create Complaints System Tables
 *
 * This migration creates tables for tracking WB review complaints.
 * Each approved complaint = 600₽ revenue.
 *
 * Tables:
 * - clients: WB seller cabinets/clients
 * - client_articles: Articles (products) per client
 * - complaints: Individual complaint records (MAIN MONETIZATION TABLE!)
 * - complaints_stats_daily: Daily aggregated statistics
 * - complaints_report_log: Extension session logs
 *
 * Phase 1: Dual-write (Extension writes to both Sheets and DB)
 * Phase 2: Historical data migration from Google Sheets
 * Phase 3: DB becomes primary source
 */

-- ============================================================================
-- 1. CLIENTS TABLE (WB Seller Cabinets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  client_name VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

  -- Relations
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL, -- References users.id (but not FK to allow flexibility)

  -- Google Integration (optional, for backwards compatibility)
  drive_folder_id VARCHAR(255),
  screenshots_folder_id VARCHAR(255),
  report_sheet_id VARCHAR(255),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clients_store_id ON clients(store_id);
CREATE INDEX idx_clients_owner_id ON clients(owner_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_client_name ON clients(client_name);

COMMENT ON TABLE clients IS 'WB seller cabinets (кабинеты). Each client can have multiple articles.';
COMMENT ON COLUMN clients.client_name IS 'Unique name of the WB seller cabinet';
COMMENT ON COLUMN clients.status IS 'active = actively checking complaints, inactive = paused';
COMMENT ON COLUMN clients.report_sheet_id IS 'Legacy: Google Sheet ID for reports (Phase 1 only)';

-- ============================================================================
-- 2. CLIENT_ARTICLES TABLE (Articles per client)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article VARCHAR(50) NOT NULL, -- WB article number (артикул)
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

  -- Optional: link to products table
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint: one article per client
  UNIQUE(client_id, article)
);

-- Indexes
CREATE INDEX idx_client_articles_client_id ON client_articles(client_id);
CREATE INDEX idx_client_articles_status ON client_articles(status);
CREATE INDEX idx_client_articles_product_id ON client_articles(product_id);
CREATE INDEX idx_client_articles_article ON client_articles(article);

COMMENT ON TABLE client_articles IS 'WB articles (артикулы) that are being monitored for complaints';
COMMENT ON COLUMN client_articles.article IS 'WB product article number (nmId)';
COMMENT ON COLUMN client_articles.status IS 'active = currently monitoring, inactive = paused';

-- ============================================================================
-- 3. COMPLAINTS TABLE (MAIN MONETIZATION TABLE!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article VARCHAR(50) NOT NULL,
  review_id VARCHAR(255), -- WB Review ID (if known)
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,

  -- Complaint data
  check_date DATE NOT NULL, -- When approved complaint was found by extension
  complaint_submit_date DATE NOT NULL, -- When complaint was submitted to WB
  review_date DATE, -- When review was posted
  review_rating INT CHECK (review_rating >= 1 AND review_rating <= 5),

  -- Status (CRITICAL!)
  status VARCHAR(50) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected', 'pending')),

  -- Revenue (CRITICAL - MAIN MONETIZATION!)
  revenue_amount DECIMAL(10, 2) DEFAULT 600.00, -- 600₽ per approved complaint
  is_paid BOOLEAN DEFAULT FALSE, -- Has manager/client been paid?
  payment_date TIMESTAMP,

  -- Screenshot evidence
  screenshot_filename VARCHAR(255),
  screenshot_drive_url TEXT,
  screenshot_drive_path TEXT,

  -- Metadata
  found_by_extension BOOLEAN DEFAULT TRUE, -- Found by extension vs manual entry
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- CRITICAL: Prevent duplicates (one complaint per unique combination)
  UNIQUE(client_id, article, complaint_submit_date, review_date)
);

-- Indexes
CREATE INDEX idx_complaints_client_id ON complaints(client_id);
CREATE INDEX idx_complaints_store_id ON complaints(store_id);
CREATE INDEX idx_complaints_owner_id ON complaints(owner_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_check_date ON complaints(check_date);
CREATE INDEX idx_complaints_complaint_submit_date ON complaints(complaint_submit_date);
CREATE INDEX idx_complaints_is_paid ON complaints(is_paid);
CREATE INDEX idx_complaints_article ON complaints(article);
CREATE INDEX idx_complaints_revenue_amount ON complaints(revenue_amount);

COMMENT ON TABLE complaints IS 'MAIN MONETIZATION TABLE: Individual approved complaints. Each record = 600₽ revenue!';
COMMENT ON COLUMN complaints.status IS 'approved = 600₽ revenue, rejected = 0₽, pending = waiting for WB decision';
COMMENT ON COLUMN complaints.revenue_amount IS 'Revenue per approved complaint (default 600₽, configurable)';
COMMENT ON COLUMN complaints.is_paid IS 'Whether manager/client has been paid for this complaint';
COMMENT ON COLUMN complaints.check_date IS 'When extension found the approved complaint';
COMMENT ON COLUMN complaints.complaint_submit_date IS 'When complaint was originally submitted to WB';

-- ============================================================================
-- 4. COMPLAINTS_STATS_DAILY TABLE (Daily aggregated statistics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaints_stats_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Group by
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article VARCHAR(50) NOT NULL,
  complaint_date DATE NOT NULL, -- Date of complaint submission

  -- Statistics
  total_complaints INT NOT NULL DEFAULT 0,
  approved_complaints INT NOT NULL DEFAULT 0,
  rejected_complaints INT NOT NULL DEFAULT 0,
  pending_complaints INT NOT NULL DEFAULT 0,

  -- Revenue (computed field)
  revenue_total DECIMAL(10, 2) DEFAULT 0.00, -- approved_complaints × 600₽

  -- Check metadata (for UPSERT logic)
  last_check_at TIMESTAMP NOT NULL,
  check_count INT NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- CRITICAL: One stats row per (client + article + date)
  UNIQUE(client_id, article, complaint_date)
);

-- Indexes
CREATE INDEX idx_stats_client_id ON complaints_stats_daily(client_id);
CREATE INDEX idx_stats_complaint_date ON complaints_stats_daily(complaint_date);
CREATE INDEX idx_stats_article ON complaints_stats_daily(article);
CREATE INDEX idx_stats_revenue_total ON complaints_stats_daily(revenue_total);

COMMENT ON TABLE complaints_stats_daily IS 'Daily aggregated statistics for complaints. UPSERT on each extension check.';
COMMENT ON COLUMN complaints_stats_daily.revenue_total IS 'Total revenue for this date (approved_complaints × 600₽)';
COMMENT ON COLUMN complaints_stats_daily.check_count IS 'How many times extension checked this (client+article+date)';

-- ============================================================================
-- 5. COMPLAINTS_REPORT_LOG TABLE (Extension session logs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaints_report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,

  -- Session parameters
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  articles_checked INT NOT NULL DEFAULT 0,

  -- Results
  total_complaints_found INT NOT NULL DEFAULT 0,
  approved_found INT NOT NULL DEFAULT 0,
  rejected_found INT NOT NULL DEFAULT 0,
  pending_found INT NOT NULL DEFAULT 0,
  screenshots_saved INT NOT NULL DEFAULT 0,
  screenshots_skipped INT NOT NULL DEFAULT 0, -- Duplicates

  -- Revenue for this session
  session_revenue DECIMAL(10, 2) DEFAULT 0.00, -- approved_found × 600₽

  -- Session metadata
  duration_seconds INT, -- How long the check took
  errors TEXT[], -- Array of error messages (if any)

  -- Timestamps
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_report_log_client_id ON complaints_report_log(client_id);
CREATE INDEX idx_report_log_owner_id ON complaints_report_log(owner_id);
CREATE INDEX idx_report_log_started_at ON complaints_report_log(started_at);
CREATE INDEX idx_report_log_store_id ON complaints_report_log(store_id);

COMMENT ON TABLE complaints_report_log IS 'Logs of extension checking sessions. Tracks performance and results.';
COMMENT ON COLUMN complaints_report_log.session_revenue IS 'Revenue generated during this session (approved × 600₽)';
COMMENT ON COLUMN complaints_report_log.screenshots_skipped IS 'Duplicates found (already recorded complaints)';

-- ============================================================================
-- 6. ADD EXTENSION API KEY TO USER_SETTINGS
-- ============================================================================

-- Add column for extension authentication
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS extension_api_key VARCHAR(255);

COMMENT ON COLUMN user_settings.extension_api_key IS 'API key for Chrome extension authentication (format: ext_xxxxxxxxxxxx)';

-- ============================================================================
-- 7. HELPER VIEWS FOR REPORTING
-- ============================================================================

-- View: Total revenue by client
CREATE OR REPLACE VIEW v_complaints_revenue_by_client AS
SELECT
  c.id as client_id,
  c.client_name,
  c.status as client_status,
  COUNT(co.id) as total_complaints,
  COUNT(co.id) FILTER (WHERE co.status = 'approved') as approved_count,
  COUNT(co.id) FILTER (WHERE co.status = 'rejected') as rejected_count,
  COUNT(co.id) FILTER (WHERE co.status = 'pending') as pending_count,
  SUM(co.revenue_amount) FILTER (WHERE co.status = 'approved') as total_revenue,
  SUM(co.revenue_amount) FILTER (WHERE co.status = 'approved' AND co.is_paid = true) as paid_revenue,
  SUM(co.revenue_amount) FILTER (WHERE co.status = 'approved' AND co.is_paid = false) as unpaid_revenue
FROM clients c
LEFT JOIN complaints co ON co.client_id = c.id
GROUP BY c.id, c.client_name, c.status
ORDER BY total_revenue DESC NULLS LAST;

COMMENT ON VIEW v_complaints_revenue_by_client IS 'Revenue summary by client (кабинет)';

-- View: Daily revenue trend
CREATE OR REPLACE VIEW v_complaints_revenue_daily AS
SELECT
  co.check_date,
  COUNT(co.id) as complaints_found,
  COUNT(co.id) FILTER (WHERE co.status = 'approved') as approved_count,
  SUM(co.revenue_amount) FILTER (WHERE co.status = 'approved') as daily_revenue
FROM complaints co
GROUP BY co.check_date
ORDER BY co.check_date DESC;

COMMENT ON VIEW v_complaints_revenue_daily IS 'Daily revenue trend across all clients';

-- ============================================================================
-- 8. SAMPLE DATA (for development/testing)
-- ============================================================================

-- Note: Uncomment below to insert sample data for testing

/*
-- Sample client
INSERT INTO clients (client_name, status, owner_id, notes)
VALUES ('Тестовый кабинет', 'active',
  (SELECT id FROM users LIMIT 1),
  'Sample client for testing complaints system')
ON CONFLICT (client_name) DO NOTHING;

-- Sample articles
INSERT INTO client_articles (client_id, article, status)
SELECT
  c.id,
  '12345678',
  'active'
FROM clients c
WHERE c.client_name = 'Тестовый кабинет'
ON CONFLICT (client_id, article) DO NOTHING;

-- Sample complaint (approved = 600₽!)
INSERT INTO complaints (
  client_id,
  article,
  check_date,
  complaint_submit_date,
  review_date,
  review_rating,
  status,
  revenue_amount,
  owner_id,
  found_by_extension,
  notes
)
SELECT
  c.id,
  '12345678',
  CURRENT_DATE,
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '10 days',
  2,
  'approved',
  600.00,
  (SELECT id FROM users LIMIT 1),
  true,
  'Sample approved complaint for testing'
FROM clients c
WHERE c.client_name = 'Тестовый кабинет'
ON CONFLICT (client_id, article, complaint_submit_date, review_date) DO NOTHING;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables created
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('clients', 'client_articles', 'complaints', 'complaints_stats_daily', 'complaints_report_log');

  IF table_count = 5 THEN
    RAISE NOTICE '✅ All 5 complaints system tables created successfully!';
  ELSE
    RAISE NOTICE '⚠️  Only % tables created (expected 5)', table_count;
  END IF;
END $$;
