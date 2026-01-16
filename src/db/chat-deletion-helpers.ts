/**
 * Chat Deletion Workflow Helpers
 *
 * Database helpers for negative review deletion automation
 * Business Goal: 600₽ ROI per successfully deleted review
 *
 * Created: 2026-01-16
 * Part of: AI Agent Stage 1 - Foundation
 */

import { query } from './client';
import type { Chat, ChatMessage, ProductRule } from './helpers';

// ============================================================================
// Types
// ============================================================================

/**
 * Chat with product and rules - used for deletion workflow
 */
export interface ChatWithProductRules extends Chat {
  product_id: string | null;
  product_name: string | null;
  product_vendor_code: string | null;
  product_rule: ProductRule | null;
}

/**
 * Deletion intent analysis result from trigger phrase detection
 */
export interface DeletionIntentAnalysis {
  isDeletionCandidate: boolean;
  confidence: number;
  triggers: string[];
  rawScore: number;
}

/**
 * Chat classification payload for AI
 */
export interface ChatClassificationContext {
  chatId: string;
  chatHistory: string;
  lastMessageText: string;
  productName: string | null;
  productRules: ProductRule | null;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get chats eligible for deletion workflow
 *
 * Filters:
 * - Product has work_in_chats = true
 * - Product has offer_compensation = true
 * - Chat tag is 'untagged', 'active', or 'deletion_candidate'
 * - Last message from client (seller needs to respond)
 *
 * @param storeId - Store ID
 * @param limit - Max number of chats to return (default: 50)
 * @returns Array of chats with product rules
 */
export async function getChatsEligibleForDeletion(
  storeId: string,
  limit: number = 50
): Promise<ChatWithProductRules[]> {
  const sql = `
    SELECT
      c.*,
      p.id as product_id,
      p.name as product_name,
      p.vendor_code as product_vendor_code,
      row_to_json(pr.*) as product_rule
    FROM chats c
    LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND c.store_id = p.store_id
    LEFT JOIN product_rules pr ON p.id = pr.product_id
    WHERE c.store_id = $1
      AND pr.work_in_chats = true
      AND pr.offer_compensation = true
      AND c.tag IN ('untagged', 'active', 'deletion_candidate')
      AND c.last_message_sender = 'client'
    ORDER BY c.last_message_date DESC
    LIMIT $2
  `;

  const result = await query<ChatWithProductRules & { product_rule: string }>(
    sql,
    [storeId, limit]
  );

  // Parse product_rule JSON
  return result.rows.map(row => ({
    ...row,
    product_rule: row.product_rule ? JSON.parse(row.product_rule) : null
  }));
}

/**
 * Get all messages for a chat (for AI context)
 *
 * @param chatId - Chat ID
 * @returns Array of messages ordered by timestamp ASC
 */
export async function getChatMessagesFormatted(chatId: string): Promise<string> {
  const sql = `
    SELECT
      sender,
      text,
      timestamp
    FROM chat_messages
    WHERE chat_id = $1
    ORDER BY timestamp ASC
  `;

  const result = await query<ChatMessage>(sql, [chatId]);

  // Format as conversation string for AI
  return result.rows
    .map(msg => {
      const sender = msg.sender === 'client' ? 'Клиент' : 'Продавец';
      const time = new Date(msg.timestamp).toLocaleString('ru-RU');
      return `[${time}] ${sender}: ${msg.text || '(без текста)'}`;
    })
    .join('\n');
}

/**
 * Get chats by tag with pagination
 *
 * @param storeId - Store ID
 * @param tag - Chat tag to filter by
 * @param options - Pagination options
 * @returns Array of chats
 */
export async function getChatsByTag(
  storeId: string,
  tag: string | string[],
  options?: { limit?: number; offset?: number }
): Promise<Chat[]> {
  const tags = Array.isArray(tag) ? tag : [tag];

  const sql = `
    SELECT
      c.*,
      p.name as product_name,
      p.vendor_code as product_vendor_code
    FROM chats c
    LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND c.store_id = p.store_id
    WHERE c.store_id = $1
      AND c.tag = ANY($2)
    ORDER BY c.last_message_date DESC
    LIMIT $3
    OFFSET $4
  `;

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const result = await query<Chat>(sql, [storeId, tags, limit, offset]);
  return result.rows;
}

/**
 * Get deletion workflow stats for a store
 *
 * Returns count of chats at each stage:
 * - deletion_candidate
 * - deletion_offered
 * - deletion_agreed
 * - deletion_confirmed
 *
 * @param storeId - Store ID
 * @returns Stats object
 */
export async function getDeletionWorkflowStats(storeId: string): Promise<{
  candidates: number;
  offered: number;
  agreed: number;
  confirmed: number;
  refundRequested: number;
  totalRevenue: number; // confirmed × 600₽
}> {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE tag = 'deletion_candidate') as candidates,
      COUNT(*) FILTER (WHERE tag = 'deletion_offered') as offered,
      COUNT(*) FILTER (WHERE tag = 'deletion_agreed') as agreed,
      COUNT(*) FILTER (WHERE tag = 'deletion_confirmed') as confirmed,
      COUNT(*) FILTER (WHERE tag = 'refund_requested') as refund_requested
    FROM chats
    WHERE store_id = $1
  `;

  const result = await query<{
    candidates: string;
    offered: string;
    agreed: string;
    confirmed: string;
    refund_requested: string;
  }>(sql, [storeId]);

  const stats = result.rows[0];
  const confirmed = parseInt(stats.confirmed, 10);

  return {
    candidates: parseInt(stats.candidates, 10),
    offered: parseInt(stats.offered, 10),
    agreed: parseInt(stats.agreed, 10),
    confirmed,
    refundRequested: parseInt(stats.refund_requested, 10),
    totalRevenue: confirmed * 600, // 600₽ per deletion
  };
}

// ============================================================================
// Trigger Phrase Detection
// ============================================================================

/**
 * Detect deletion intent using regex patterns
 * Based on DELETION_TRIGGER_PHRASES.md
 *
 * @param messageText - Chat message text
 * @returns Analysis result
 */
export function detectDeletionIntent(messageText: string): DeletionIntentAnalysis {
  const text = messageText.toLowerCase();
  const triggers: string[] = [];
  let maxConfidence = 0;

  // Anti-pattern: Spam (check first)
  if (/[А-ЯЁ\s]{10,}/.test(messageText)) { // ALL CAPS
    return {
      isDeletionCandidate: false,
      confidence: 0,
      triggers: ['spam_caps'],
      rawScore: 0,
    };
  }

  // Priority 1: Direct deletion promises (95-98%)
  if (/удал[юуьа]\s*отзыв/.test(text)) {
    triggers.push('delete_promise');
    maxConfidence = Math.max(maxConfidence, 0.98);
  }
  if (/убер[уюа]\s*отзыв/.test(text)) {
    triggers.push('remove_promise');
    maxConfidence = Math.max(maxConfidence, 0.98);
  }
  if (/измен[юуьа]\s*отзыв/.test(text)) {
    triggers.push('modify_promise');
    maxConfidence = Math.max(maxConfidence, 0.95);
  }
  if (/исправл[юуьа]\s*отзыв/.test(text)) {
    triggers.push('fix_promise');
    maxConfidence = Math.max(maxConfidence, 0.95);
  }

  // Star rating promises
  if (/поставл[юуьа]\s*5/.test(text)) {
    triggers.push('5star_promise');
    maxConfidence = Math.max(maxConfidence, 0.96);
  }
  if (/измен[юуьа].*5/.test(text)) {
    triggers.push('change_to_5');
    maxConfidence = Math.max(maxConfidence, 0.96);
  }
  if (/повыш[уюа]\s*оценк/.test(text)) {
    triggers.push('raise_rating');
    maxConfidence = Math.max(maxConfidence, 0.94);
  }

  // Priority 2: Compensation requests (85-92%)
  if (/верните\s*деньги/.test(text)) {
    triggers.push('refund_request');
    maxConfidence = Math.max(maxConfidence, 0.92);
  }
  if (/хочу\s*возврат/.test(text)) {
    triggers.push('want_refund');
    maxConfidence = Math.max(maxConfidence, 0.90);
  }
  if (/компенсаци/.test(text)) {
    triggers.push('compensation');
    maxConfidence = Math.max(maxConfidence, 0.85);
  }
  if (/кешб[эе]к/.test(text)) {
    triggers.push('cashback');
    maxConfidence = Math.max(maxConfidence, 0.84);
  }

  // Combined patterns (highest accuracy)
  if (/(верн[иьа]те.*деньги|возврат).*(удал|измен|убер).*отзыв/.test(text)) {
    triggers.push('money_plus_deletion');
    maxConfidence = Math.max(maxConfidence, 0.96);
  }
  if (/(если|при условии).*(поставл[юуьа]|измен[юуьа]).*5/.test(text)) {
    triggers.push('condition_5stars');
    maxConfidence = Math.max(maxConfidence, 0.94);
  }

  // Priority 3: Negative sentiment (escalation risk)
  if (/брак/.test(text)) {
    triggers.push('defect');
    maxConfidence = Math.max(maxConfidence, 0.82);
  }
  if (/дефект/.test(text)) {
    triggers.push('defect');
    maxConfidence = Math.max(maxConfidence, 0.82);
  }
  if (/не\s*работает/.test(text)) {
    triggers.push('not_working');
    maxConfidence = Math.max(maxConfidence, 0.78);
  }

  return {
    isDeletionCandidate: maxConfidence >= 0.80,
    confidence: maxConfidence,
    triggers,
    rawScore: maxConfidence,
  };
}

/**
 * Analyze chat and get classification context for AI
 *
 * @param chatId - Chat ID
 * @returns Context object for AI classification
 */
export async function getChatClassificationContext(
  chatId: string
): Promise<ChatClassificationContext | null> {
  const sql = `
    SELECT
      c.*,
      p.id as product_id,
      p.name as product_name,
      row_to_json(pr.*) as product_rule
    FROM chats c
    LEFT JOIN products p ON c.product_nm_id = p.wb_product_id AND c.store_id = p.store_id
    LEFT JOIN product_rules pr ON p.id = pr.product_id
    WHERE c.id = $1
  `;

  const result = await query<Chat & { product_rule: string; product_name: string }>(
    sql,
    [chatId]
  );

  if (result.rows.length === 0) return null;

  const chat = result.rows[0];
  const chatHistory = await getChatMessagesFormatted(chatId);
  const productRule = chat.product_rule ? JSON.parse(chat.product_rule) : null;

  return {
    chatId: chat.id,
    chatHistory,
    lastMessageText: chat.last_message_text || '',
    productName: chat.product_name,
    productRules: productRule,
  };
}

// ============================================================================
// Update Functions
// ============================================================================

/**
 * Update chat tag with timestamp
 *
 * @param chatId - Chat ID
 * @param tag - New tag
 * @returns Updated chat
 */
export async function updateChatTagWithTimestamp(
  chatId: string,
  tag: string
): Promise<Chat | null> {
  const sql = `
    UPDATE chats
    SET tag = $1,
        tag_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await query<Chat>(sql, [tag, chatId]);
  return result.rows[0] || null;
}

/**
 * Bulk update chat tags based on deletion intent analysis
 *
 * @param storeId - Store ID
 * @param confidenceThreshold - Minimum confidence to auto-tag (default: 0.85)
 * @returns Number of chats updated
 */
export async function bulkTagDeletionCandidates(
  storeId: string,
  confidenceThreshold: number = 0.85
): Promise<number> {
  // Get all untagged/active chats
  const chats = await getChatsByTag(storeId, ['untagged', 'active']);

  let updatedCount = 0;

  for (const chat of chats) {
    if (!chat.last_message_text) continue;

    const analysis = detectDeletionIntent(chat.last_message_text);

    if (analysis.isDeletionCandidate && analysis.confidence >= confidenceThreshold) {
      await updateChatTagWithTimestamp(chat.id, 'deletion_candidate');
      updatedCount++;
    }
  }

  return updatedCount;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Get conversion funnel metrics
 *
 * @param storeId - Store ID
 * @param timeRange - Optional time range in days (default: 30)
 * @returns Funnel metrics
 */
export async function getDeletionFunnelMetrics(
  storeId: string,
  timeRange?: number
): Promise<{
  totalChats: number;
  candidates: number;
  offered: number;
  agreed: number;
  confirmed: number;
  conversionRate: {
    candidateToOffered: number;
    offeredToAgreed: number;
    agreedToConfirmed: number;
    overall: number;
  };
  revenue: number;
}> {
  const timeFilter = timeRange
    ? `AND c.created_at >= NOW() - INTERVAL '${timeRange} days'`
    : '';

  const sql = `
    SELECT
      COUNT(*) as total_chats,
      COUNT(*) FILTER (WHERE tag = 'deletion_candidate') as candidates,
      COUNT(*) FILTER (WHERE tag = 'deletion_offered') as offered,
      COUNT(*) FILTER (WHERE tag = 'deletion_agreed') as agreed,
      COUNT(*) FILTER (WHERE tag = 'deletion_confirmed') as confirmed
    FROM chats c
    WHERE c.store_id = $1
      ${timeFilter}
  `;

  const result = await query<{
    total_chats: string;
    candidates: string;
    offered: string;
    agreed: string;
    confirmed: string;
  }>(sql, [storeId]);

  const data = result.rows[0];
  const totalChats = parseInt(data.total_chats, 10);
  const candidates = parseInt(data.candidates, 10);
  const offered = parseInt(data.offered, 10);
  const agreed = parseInt(data.agreed, 10);
  const confirmed = parseInt(data.confirmed, 10);

  return {
    totalChats,
    candidates,
    offered,
    agreed,
    confirmed,
    conversionRate: {
      candidateToOffered: candidates > 0 ? offered / candidates : 0,
      offeredToAgreed: offered > 0 ? agreed / offered : 0,
      agreedToConfirmed: agreed > 0 ? confirmed / agreed : 0,
      overall: totalChats > 0 ? confirmed / totalChats : 0,
    },
    revenue: confirmed * 600, // 600₽ per deletion
  };
}

/**
 * Get most common trigger phrases from analyzed chats
 *
 * @param storeId - Store ID
 * @returns Trigger phrase frequency map
 */
export async function getTriggerPhraseStats(
  storeId: string
): Promise<Record<string, number>> {
  const chats = await getChatsByTag(storeId, 'deletion_candidate');
  const triggerCounts: Record<string, number> = {};

  for (const chat of chats) {
    if (!chat.last_message_text) continue;

    const analysis = detectDeletionIntent(chat.last_message_text);

    for (const trigger of analysis.triggers) {
      triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
    }
  }

  return triggerCounts;
}
