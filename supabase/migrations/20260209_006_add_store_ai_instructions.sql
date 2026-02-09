-- Migration 006: Add ai_instructions field to stores table
-- Purpose: Per-store AI personalization - free-form instructions injected into system prompt
-- Date: 2026-02-09

ALTER TABLE stores ADD COLUMN IF NOT EXISTS ai_instructions TEXT NULL;

COMMENT ON COLUMN stores.ai_instructions IS
  'AI instructions for this store: tone, return policies, compensation rules, restrictions. Injected into system prompt for all AI flows.';
