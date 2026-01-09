-- ============================================
-- Add index on api_key for fast authentication
-- Date: 2026-01-07
-- Description: Optimize API key verification performance
-- ============================================

-- Add index on user_settings.api_key
-- This will speed up SELECT * FROM user_settings WHERE api_key = $1
-- Expected improvement: from 1.3 seconds to ~50ms
CREATE INDEX IF NOT EXISTS idx_user_settings_api_key
ON user_settings(api_key);

-- Add comment
COMMENT ON INDEX idx_user_settings_api_key IS 'Index for fast API key verification in authentication';
