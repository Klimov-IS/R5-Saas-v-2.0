/**
 * ChatRepository — SQL encapsulation for chat-related queries.
 *
 * All raw SQL for chats, chat_messages used by core/services
 * lives here. Services import these functions instead of using
 * `query()` directly.
 *
 * PR-12: Extract from ChatService, ChatStatusService
 */
import { query } from '@/db/client';

/**
 * Get chat with enriched data for detail view.
 * 6-table JOIN: chats → stores → review_chat_links → reviews → products → product_rules.
 */
export async function findChatDetailById(chatId: string, accessibleStoreIds: string[]) {
  const result = await query(
    `SELECT c.*, s.name as store_name,
       rcl.review_rating, rcl.review_date, rcl.chat_url,
       r.text as review_text,
       r.complaint_status, r.review_status_wb, r.product_status_by_review as product_status,
       pr.offer_compensation, pr.max_compensation,
       pr.compensation_type, pr.compensation_by,
       pr.chat_strategy::text as chat_strategy,
       pr.comment as product_comment
     FROM chats c
     JOIN stores s ON c.store_id = s.id
     LEFT JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
     LEFT JOIN reviews r ON rcl.review_id = r.id
     LEFT JOIN products p ON p.store_id = c.store_id
       AND ((c.marketplace = 'wb' AND c.product_nm_id = p.wb_product_id)
         OR (c.marketplace = 'ozon' AND (c.product_nm_id = p.ozon_sku OR c.product_nm_id = p.ozon_fbs_sku)))
     LEFT JOIN product_rules pr ON p.id = pr.product_id
     WHERE c.id = $1 AND c.store_id = ANY($2::text[])`,
    [chatId, accessibleStoreIds]
  );
  return result.rows[0] || null;
}

/**
 * Get last N messages for a chat (newest first, then reversed for chronological display).
 */
export async function findLastMessages(chatId: string, limit: number = 200) {
  const result = await query(
    `SELECT * FROM (
       SELECT id, text, sender, timestamp, is_auto_reply, download_id
       FROM chat_messages
       WHERE chat_id = $1
       ORDER BY timestamp DESC
       LIMIT $2
     ) sub ORDER BY timestamp ASC`,
    [chatId, limit]
  );
  return result.rows;
}

/**
 * Get chat with minimal fields for send operation.
 * Access-checked via store_id.
 */
export async function findChatForSend(chatId: string, accessibleStoreIds: string[]) {
  const result = await query(
    `SELECT c.id, c.store_id, c.reply_sign, c.owner_id
     FROM chats c
     WHERE c.id = $1 AND c.store_id = ANY($2::text[])`,
    [chatId, accessibleStoreIds]
  );
  return result.rows[0] || null;
}

/**
 * Get chat with store's AI instructions for AI reply generation.
 * Access-checked via store_id.
 */
export async function findChatWithAiInstructions(chatId: string, accessibleStoreIds: string[]) {
  const result = await query(
    `SELECT c.*, s.name as store_name, s.ai_instructions
     FROM chats c
     JOIN stores s ON c.store_id = s.id
     WHERE c.id = $1 AND c.store_id = ANY($2::text[])`,
    [chatId, accessibleStoreIds]
  );
  return result.rows[0] || null;
}

/**
 * Get messages for AI context building with optional windowing.
 *
 * When limit is specified, returns the last N messages in chronological order
 * (subquery DESC → outer ASC). Also returns totalCount for summary header.
 *
 * When limit is 0 or undefined, returns ALL messages (legacy behavior).
 */
export async function findMessagesForAi(
  chatId: string,
  limit?: number
): Promise<{ rows: any[]; totalCount: number }> {
  // Get total count
  const countResult = await query(
    'SELECT COUNT(*)::int as cnt FROM chat_messages WHERE chat_id = $1',
    [chatId]
  );
  const totalCount = countResult.rows[0]?.cnt || 0;

  // Fetch messages (windowed or all)
  if (limit && limit > 0 && totalCount > limit) {
    const result = await query(
      `SELECT text, sender, timestamp FROM (
         SELECT text, sender, timestamp
         FROM chat_messages
         WHERE chat_id = $1
         ORDER BY timestamp DESC
         LIMIT $2
       ) sub ORDER BY timestamp ASC`,
      [chatId, limit]
    );
    return { rows: result.rows, totalCount };
  }

  // No windowing needed
  const result = await query(
    `SELECT text, sender, timestamp
     FROM chat_messages
     WHERE chat_id = $1
     ORDER BY timestamp ASC`,
    [chatId]
  );
  return { rows: result.rows, totalCount };
}

/**
 * Verify chat exists and is accessible by store_id.
 * Returns true if chat is accessible.
 */
export async function verifyChatAccess(chatId: string, accessibleStoreIds: string[]): Promise<boolean> {
  const result = await query(
    'SELECT id FROM chats WHERE id = $1 AND store_id = ANY($2::text[])',
    [chatId, accessibleStoreIds]
  );
  return !!result.rows[0];
}

/**
 * Get chat with fields needed for sequence operations (store_id, owner_id, tag).
 * Access-checked via store_id.
 */
export async function findChatForSequence(chatId: string, accessibleStoreIds: string[]) {
  const result = await query(
    'SELECT id, store_id, owner_id, tag, last_message_date, last_message_sender FROM chats WHERE id = $1 AND store_id = ANY($2::text[])',
    [chatId, accessibleStoreIds]
  );
  return result.rows[0] || null;
}
