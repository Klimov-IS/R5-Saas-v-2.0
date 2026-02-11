/**
 * Telegram Integration Database Helpers
 *
 * CRUD operations for telegram_users and telegram_notifications_log tables.
 * Used by TG bot (linking), notification system, and Mini App auth.
 */

import { query } from './client';

// ============================================================================
// Types
// ============================================================================

export interface TelegramUser {
  id: string;
  user_id: string;
  telegram_id: number;
  telegram_username: string | null;
  chat_id: number;
  is_notifications_enabled: boolean;
  linked_at: string;
  updated_at: string;
}

export interface TelegramNotificationLog {
  id: string;
  telegram_user_id: string;
  chat_id: string;
  store_id: string;
  notification_type: string;
  message_text: string | null;
  sent_at: string;
  tg_message_id: number | null;
}

export interface QueueChat {
  id: string;
  store_id: string;
  store_name: string;
  client_name: string;
  product_name: string | null;
  product_nm_id: string | null;
  last_message_text: string | null;
  last_message_date: string | null;
  last_message_sender: 'client' | 'seller' | null;
  draft_reply: string | null;
  status: string;
  tag: string | null;
}

// ============================================================================
// Telegram Users CRUD
// ============================================================================

/**
 * Find telegram user by Telegram ID (numeric)
 */
export async function getTelegramUserByTelegramId(telegramId: number): Promise<TelegramUser | null> {
  const result = await query<TelegramUser>(
    'SELECT * FROM telegram_users WHERE telegram_id = $1',
    [telegramId]
  );
  return result.rows[0] || null;
}

/**
 * Find telegram user by R5 user ID
 */
export async function getTelegramUserByUserId(userId: string): Promise<TelegramUser | null> {
  const result = await query<TelegramUser>(
    'SELECT * FROM telegram_users WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Link a Telegram account to an R5 user
 */
export async function createTelegramUser(data: {
  userId: string;
  telegramId: number;
  telegramUsername: string | null;
  chatId: number;
}): Promise<TelegramUser> {
  const result = await query<TelegramUser>(
    `INSERT INTO telegram_users (id, user_id, telegram_id, telegram_username, chat_id)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
     RETURNING *`,
    [data.userId, data.telegramId, data.telegramUsername, data.chatId]
  );
  return result.rows[0];
}

/**
 * Update telegram user fields
 */
export async function updateTelegramUser(
  id: string,
  updates: Partial<Pick<TelegramUser, 'telegram_username' | 'is_notifications_enabled' | 'chat_id'>>
): Promise<TelegramUser | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.telegram_username !== undefined) {
    fields.push(`telegram_username = $${paramIndex++}`);
    values.push(updates.telegram_username);
  }
  if (updates.is_notifications_enabled !== undefined) {
    fields.push(`is_notifications_enabled = $${paramIndex++}`);
    values.push(updates.is_notifications_enabled);
  }
  if (updates.chat_id !== undefined) {
    fields.push(`chat_id = $${paramIndex++}`);
    values.push(updates.chat_id);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<TelegramUser>(
    `UPDATE telegram_users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete telegram user link
 */
export async function deleteTelegramUser(id: string): Promise<boolean> {
  const result = await query('DELETE FROM telegram_users WHERE id = $1', [id]);
  return (result.rowCount || 0) > 0;
}

// ============================================================================
// Notification Log
// ============================================================================

/**
 * Log a sent notification
 */
export async function logTelegramNotification(data: {
  telegramUserId: string;
  chatId: string;
  storeId: string;
  notificationType?: string;
  messageText?: string;
  tgMessageId?: number;
}): Promise<void> {
  await query(
    `INSERT INTO telegram_notifications_log
       (id, telegram_user_id, chat_id, store_id, notification_type, message_text, tg_message_id)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
    [
      data.telegramUserId,
      data.chatId,
      data.storeId,
      data.notificationType || 'client_reply',
      data.messageText || null,
      data.tgMessageId || null,
    ]
  );
}

/**
 * Check if notification was sent recently (dedup)
 */
export async function wasNotificationSentRecently(
  telegramUserId: string,
  chatId: string,
  notificationType: string,
  withinMinutes: number = 60
): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM telegram_notifications_log
       WHERE telegram_user_id = $1
         AND chat_id = $2
         AND notification_type = $3
         AND sent_at > NOW() - INTERVAL '1 minute' * $4
     ) as exists`,
    [telegramUserId, chatId, notificationType, withinMinutes]
  );
  return result.rows[0]?.exists || false;
}

// ============================================================================
// Unified Queue (cross-store)
// ============================================================================

/**
 * Get unified chat queue across all user's stores
 * Shows chats where client replied and chat is not closed
 */
export async function getUnifiedChatQueue(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<QueueChat[]> {
  const result = await query<QueueChat>(
    `SELECT
       c.id, c.store_id, s.name as store_name,
       c.client_name, c.product_name, c.product_nm_id,
       c.last_message_text, c.last_message_date, c.last_message_sender,
       c.draft_reply, c.status, c.tag
     FROM chats c
     JOIN stores s ON c.store_id = s.id
     LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND p.store_id = c.store_id
     LEFT JOIN product_rules pr ON p.id = pr.product_id
     WHERE c.owner_id = $1
       AND c.last_message_sender = 'client'
       AND c.status != 'closed'
       AND s.status = 'active'
       AND pr.work_in_chats = TRUE
     ORDER BY c.last_message_date DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

/**
 * Count total chats in queue (for pagination)
 */
export async function getUnifiedChatQueueCount(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM chats c
     JOIN stores s ON c.store_id = s.id
     LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND p.store_id = c.store_id
     LEFT JOIN product_rules pr ON p.id = pr.product_id
     WHERE c.owner_id = $1
       AND c.last_message_sender = 'client'
       AND c.status != 'closed'
       AND s.status = 'active'
       AND pr.work_in_chats = TRUE`,
    [userId]
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Get all telegram users who should be notified for a given store
 */
export async function getTelegramUserForStore(storeOwnerId: string): Promise<TelegramUser | null> {
  const result = await query<TelegramUser>(
    `SELECT tu.* FROM telegram_users tu
     WHERE tu.user_id = $1
       AND tu.is_notifications_enabled = TRUE`,
    [storeOwnerId]
  );
  return result.rows[0] || null;
}
