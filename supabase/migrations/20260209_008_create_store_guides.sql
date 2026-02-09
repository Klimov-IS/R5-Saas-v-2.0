-- Migration 008: Create store_guides table for per-store step-by-step instructions
-- Purpose: Structured guides (how to delete review, how to return, etc.) injected into AI context
-- Date: 2026-02-09

CREATE TABLE IF NOT EXISTS store_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_guides_store_id ON store_guides(store_id);
