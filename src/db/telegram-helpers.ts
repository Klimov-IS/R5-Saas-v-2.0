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
  marketplace: string;
  client_name: string;
  product_name: string | null;
  product_nm_id: string | null;
  last_message_text: string | null;
  last_message_date: string | null;
  last_message_sender: 'client' | 'seller' | null;
  draft_reply: string | null;
  status: string;
  tag: string | null;
  completion_reason: string | null;
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
 * Get unified chat queue across accessible stores.
 * Supports filtering by status and store IDs.
 */
export async function getUnifiedChatQueue(
  storeIds: string[],
  limit: number = 50,
  offset: number = 0,
  status?: string,
  filterStoreIds?: string[]
): Promise<QueueChat[]> {
  if (storeIds.length === 0) return [];

  const effectiveStoreIds = filterStoreIds && filterStoreIds.length > 0
    ? storeIds.filter(id => filterStoreIds.includes(id))
    : storeIds;
  if (effectiveStoreIds.length === 0) return [];

  const conditions: string[] = [
    'c.store_id = ANY($1::text[])',
    "s.status = 'active'",
    // WB: require active product rule; OZON: show all chats (99.85% have no product link)
    "(pr.work_in_chats = TRUE OR c.marketplace = 'ozon')",
  ];
  const params: any[] = [effectiveStoreIds];

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const result = await query<QueueChat>(
    `SELECT
       c.id, c.store_id, s.name as store_name, c.marketplace,
       c.client_name, c.product_name, c.product_nm_id,
       c.last_message_text, c.last_message_date, c.last_message_sender,
       c.draft_reply, c.status, c.tag, c.completion_reason
     FROM chats c
     JOIN stores s ON c.store_id = s.id
     LEFT JOIN products p ON p.store_id = c.store_id
       AND ((c.marketplace = 'wb' AND c.product_nm_id = p.wb_product_id)
         OR (c.marketplace = 'ozon' AND (c.product_nm_id = p.ozon_sku OR c.product_nm_id = p.ozon_fbs_sku)))
     LEFT JOIN product_rules pr ON p.id = pr.product_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.last_message_date DESC NULLS LAST
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return result.rows;
}

/**
 * Count total chats in queue for a given status filter.
 */
export async function getUnifiedChatQueueCount(
  storeIds: string[],
  status?: string,
  filterStoreIds?: string[]
): Promise<number> {
  if (storeIds.length === 0) return 0;

  const effectiveStoreIds = filterStoreIds && filterStoreIds.length > 0
    ? storeIds.filter(id => filterStoreIds.includes(id))
    : storeIds;
  if (effectiveStoreIds.length === 0) return 0;

  const conditions: string[] = [
    'c.store_id = ANY($1::text[])',
    "s.status = 'active'",
    // WB: require active product rule; OZON: show all chats (99.85% have no product link)
    "(pr.work_in_chats = TRUE OR c.marketplace = 'ozon')",
  ];
  const params: any[] = [effectiveStoreIds];

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM chats c
     JOIN stores s ON c.store_id = s.id
     LEFT JOIN products p ON p.store_id = c.store_id
       AND ((c.marketplace = 'wb' AND c.product_nm_id = p.wb_product_id)
         OR (c.marketplace = 'ozon' AND (c.product_nm_id = p.ozon_sku OR c.product_nm_id = p.ozon_fbs_sku)))
     LEFT JOIN product_rules pr ON p.id = pr.product_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Get chat counts grouped by status (for tab badges).
 * Single query instead of 4 separate count queries.
 */
export async function getUnifiedChatQueueCountsByStatus(
  storeIds: string[],
  filterStoreIds?: string[]
): Promise<Record<string, number>> {
  if (storeIds.length === 0) return { inbox: 0, in_progress: 0, awaiting_reply: 0, closed: 0 };

  const effectiveStoreIds = filterStoreIds && filterStoreIds.length > 0
    ? storeIds.filter(id => filterStoreIds.includes(id))
    : storeIds;
  if (effectiveStoreIds.length === 0) return { inbox: 0, in_progress: 0, awaiting_reply: 0, closed: 0 };

  const result = await query<{ status: string; count: string }>(
    `SELECT c.status, COUNT(*) as count
     FROM chats c
     JOIN stores s ON c.store_id = s.id
     LEFT JOIN products p ON p.store_id = c.store_id
       AND ((c.marketplace = 'wb' AND c.product_nm_id = p.wb_product_id)
         OR (c.marketplace = 'ozon' AND (c.product_nm_id = p.ozon_sku OR c.product_nm_id = p.ozon_fbs_sku)))
     LEFT JOIN product_rules pr ON p.id = pr.product_id
     WHERE c.store_id = ANY($1::text[])
       AND s.status = 'active'
       AND (pr.work_in_chats = TRUE OR c.marketplace = 'ozon')
     GROUP BY c.status`,
    [effectiveStoreIds]
  );

  const counts: Record<string, number> = {
    inbox: 0,
    in_progress: 0,
    awaiting_reply: 0,
    closed: 0,
  };
  result.rows.forEach(row => {
    counts[row.status] = parseInt(row.count, 10);
  });
  return counts;
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
