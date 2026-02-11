-- Migration 010: Auth System & Organization Roles
-- Date: 2026-02-11
-- Description: Organizations, role-based access, invite-only registration
-- Part of: Phase 1 — Auth backend

-- ============================================================================
-- 1. Modify users table — add password_hash and display_name
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT NULL;

-- ============================================================================
-- 2. Organizations table — groups users + stores
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  owner_id   TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Organization members with roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_members (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);

-- ============================================================================
-- 4. Manager → store access mapping
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_store_access (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id TEXT NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  store_id  TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(member_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_member_store_member ON member_store_access(member_id);

-- ============================================================================
-- 5. Invites table — invite-only registration
-- ============================================================================

CREATE TABLE IF NOT EXISTS invites (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
  token      TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- ============================================================================
-- 6. Link stores to organizations
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
