-- ============================================
-- Performance optimization: Add index on user_settings.api_key
-- Date: 2026-01-06
-- Description: Speed up API key verification from 1.3s to <50ms
-- ============================================

-- Add index on api_key column for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_api_key ON user_settings(api_key);

COMMENT ON INDEX idx_user_settings_api_key IS 'Performance optimization: Speeds up API key verification queries';

-- Verify index was created
-- You can check with: \d user_settings
