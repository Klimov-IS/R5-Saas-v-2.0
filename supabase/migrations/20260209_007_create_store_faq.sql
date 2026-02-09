-- Migration 007: Create store_faq table for per-store FAQ knowledge base
-- Purpose: Structured Q&A entries injected into AI context for better responses
-- Date: 2026-02-09

CREATE TABLE IF NOT EXISTS store_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_faq_store_id ON store_faq(store_id);
