-- Migration 009: Telegram Mini App Integration
-- Date: 2026-02-10
-- Description: Tables for linking TG accounts to R5 users and tracking notifications

-- Table 1: Telegram user <-> R5 user mapping (1:1)
CREATE TABLE IF NOT EXISTS telegram_users (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_id              BIGINT NOT NULL,
  telegram_username        TEXT,
  chat_id                  BIGINT NOT NULL,
  is_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  linked_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_users_user ON telegram_users(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_users_tg ON telegram_users(telegram_id);

-- Table 2: Notification log (dedup + debugging)
CREATE TABLE IF NOT EXISTS telegram_notifications_log (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  telegram_user_id  TEXT NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
  chat_id           TEXT NOT NULL,
  store_id          TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'client_reply',
  message_text      TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tg_message_id     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tg_notif_user ON telegram_notifications_log(telegram_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tg_notif_chat ON telegram_notifications_log(chat_id, sent_at DESC);
