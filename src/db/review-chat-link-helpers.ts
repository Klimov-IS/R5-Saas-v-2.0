/**
 * Review-Chat Link Helpers
 *
 * Database helpers for the review↔chat linking feature (Sprint 002).
 * Chrome Extension opens chats from WB reviews page and reports
 * the association to our backend via these helpers.
 *
 * @version 1.0.0
 * @date 2026-02-16
 */

import { query } from './client';

// ============================================================================
// Types
// ============================================================================

export interface ReviewChatLink {
  id: string;
  store_id: string;
  review_id: string | null;
  review_key: string;
  review_nm_id: string;
  review_rating: number;
  review_date: string;
  chat_id: string | null;
  chat_url: string;
  system_message_text: string | null;
  parsed_nm_id: string | null;
  parsed_product_title: string | null;
  status: string;
  message_type: string | null;
  message_text: string | null;
  message_sent_at: string | null;
  error_code: string | null;
  error_message: string | null;
  error_stage: string | null;
  opened_at: string;
  anchor_found_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewChatLinkInput {
  store_id: string;
  review_key: string;
  review_nm_id: string;
  review_rating: number;
  review_date: string;
  chat_url: string;
  opened_at: string;
  review_id?: string | null;
  chat_id?: string | null;
}

export interface UpdateReviewChatLinkInput {
  system_message_text?: string;
  parsed_nm_id?: string | null;
  parsed_product_title?: string | null;
  status?: string;
  anchor_found_at?: string;
  message_type?: string;
  message_text?: string;
  message_sent_at?: string;
  error_code?: string;
  error_message?: string;
  error_stage?: string;
  review_id?: string | null;
  chat_id?: string | null;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create or return existing review-chat link.
 * Uses UPSERT on (store_id, review_key) for idempotency.
 * If record already exists, returns existing without modification.
 */
export async function createReviewChatLink(
  input: CreateReviewChatLinkInput
): Promise<{ link: ReviewChatLink; created: boolean }> {
  // Check for existing record first (idempotency)
  const existing = await findLinkByStoreAndReviewKey(input.store_id, input.review_key);
  if (existing) {
    return { link: existing, created: false };
  }

  const result = await query<ReviewChatLink>(
    `INSERT INTO review_chat_links (
      store_id, review_key, review_nm_id, review_rating, review_date,
      chat_url, opened_at, review_id, chat_id, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'chat_opened')
    ON CONFLICT (store_id, review_key) DO UPDATE SET
      updated_at = NOW()
    RETURNING *`,
    [
      input.store_id,
      input.review_key,
      input.review_nm_id,
      input.review_rating,
      input.review_date,
      input.chat_url,
      input.opened_at,
      input.review_id || null,
      input.chat_id || null,
    ]
  );

  const link = result.rows[0];
  // If updated_at ≈ created_at, it was a new insert
  const created = Math.abs(
    new Date(link.created_at).getTime() - new Date(link.updated_at).getTime()
  ) < 1000;

  return { link, created };
}

/**
 * Update an existing review-chat link by ID.
 * Used for anchor, message-sent, and error stages.
 */
export async function updateReviewChatLink(
  id: string,
  updates: UpdateReviewChatLinkInput
): Promise<ReviewChatLink | null> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) return null;

  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  const result = await query<ReviewChatLink>(
    `UPDATE review_chat_links
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Find link by store + reviewKey (idempotency check).
 */
export async function findLinkByStoreAndReviewKey(
  storeId: string,
  reviewKey: string
): Promise<ReviewChatLink | null> {
  const result = await query<ReviewChatLink>(
    `SELECT * FROM review_chat_links
     WHERE store_id = $1 AND review_key = $2`,
    [storeId, reviewKey]
  );
  return result.rows[0] || null;
}

/**
 * Find link by ID.
 */
export async function findLinkById(
  id: string
): Promise<ReviewChatLink | null> {
  const result = await query<ReviewChatLink>(
    `SELECT * FROM review_chat_links WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find link by chat URL (for reconciliation from dialogue sync).
 */
export async function findLinkByChatUrl(
  chatUrl: string
): Promise<ReviewChatLink | null> {
  const result = await query<ReviewChatLink>(
    `SELECT * FROM review_chat_links WHERE chat_url = $1`,
    [chatUrl]
  );
  return result.rows[0] || null;
}

/**
 * Find pending links without chat_id for a store (batch reconciliation).
 */
export async function findPendingLinksWithoutChatId(
  storeId: string
): Promise<ReviewChatLink[]> {
  const result = await query<ReviewChatLink>(
    `SELECT * FROM review_chat_links
     WHERE store_id = $1
       AND chat_id IS NULL
       AND status NOT IN ('error')
     ORDER BY created_at DESC`,
    [storeId]
  );
  return result.rows;
}

/**
 * Fuzzy match a review by context (nmId + rating + date ±2 minutes).
 * Returns the closest matching review ID.
 */
export async function matchReviewByContext(
  storeId: string,
  nmId: string,
  rating: number,
  reviewDate: string
): Promise<string | null> {
  const result = await query<{ id: string }>(
    `SELECT r.id
     FROM reviews r
     JOIN products p ON r.product_id = p.id
     WHERE r.store_id = $1
       AND p.wb_product_id = $2
       AND r.rating = $3
       AND r.date BETWEEN ($4::timestamptz - interval '2 minutes')
                      AND ($4::timestamptz + interval '2 minutes')
     ORDER BY ABS(EXTRACT(EPOCH FROM (r.date - $4::timestamptz)))
     LIMIT 1`,
    [storeId, nmId, rating, reviewDate]
  );
  return result.rows[0]?.id || null;
}

// ============================================================================
// Aggregation queries for extension API
// ============================================================================

/**
 * Count reviews with rejected complaints that have no linked chat yet.
 * Used by GET /api/extension/chat/stores to show pendingChatsCount.
 */
export async function getPendingChatsCount(
  storeId: string
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT r.id) as count
     FROM reviews r
     JOIN review_complaints rc ON rc.review_id = r.id
     JOIN products p ON r.product_id = p.id
     JOIN product_rules pr ON pr.product_id = p.id
     WHERE r.store_id = $1
       AND rc.status = 'rejected'
       AND pr.work_in_chats = TRUE
       AND r.review_status_wb != 'deleted'
       AND r.marketplace = 'wb'
       AND NOT EXISTS (
         SELECT 1 FROM review_chat_links rcl
         WHERE rcl.store_id = r.store_id
           AND rcl.review_key LIKE r.id || '%'
       )`,
    [storeId]
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Optimized version: count pending chats using review_nm_id matching.
 * Counts reviews with rejected complaints where:
 * - product has work_in_chats = true
 * - rating matches chat_rating_* flags
 * - no existing review_chat_link for this review
 */
export async function getPendingChatsCountOptimized(
  storeId: string
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT r.id) as count
     FROM reviews r
     JOIN review_complaints rc ON rc.review_id = r.id
     JOIN products p ON r.product_id = p.id
     JOIN product_rules pr ON pr.product_id = p.id
     WHERE r.store_id = $1
       AND rc.status = 'rejected'
       AND pr.work_in_chats = TRUE
       AND r.review_status_wb != 'deleted'
       AND r.marketplace = 'wb'
       AND (
         (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
         (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
         (r.rating = 3 AND pr.chat_rating_3 = TRUE) OR
         (r.rating = 4 AND pr.chat_rating_4 = TRUE)
       )
       AND NOT EXISTS (
         SELECT 1 FROM review_chat_links rcl
         WHERE rcl.store_id = r.store_id
           AND rcl.review_nm_id = p.wb_product_id
           AND rcl.review_rating = r.rating
           AND rcl.review_date BETWEEN r.date - interval '2 minutes'
                                    AND r.date + interval '2 minutes'
       )`,
    [storeId]
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Get chat rules for a store: products with work_in_chats enabled.
 * Returns product info + starsAllowed array built from chat_rating_* flags.
 */
export async function getChatRulesForStore(
  storeId: string
): Promise<Array<{
  nmId: string;
  productTitle: string;
  isActive: boolean;
  chatEnabled: boolean;
  starsAllowed: number[];
  requiredComplaintStatus: string;
}>> {
  const result = await query<{
    wb_product_id: string;
    name: string;
    work_status: string;
    work_in_chats: boolean;
    chat_rating_1: boolean;
    chat_rating_2: boolean;
    chat_rating_3: boolean;
    chat_rating_4: boolean;
  }>(
    `SELECT
      p.wb_product_id,
      p.name,
      p.work_status,
      COALESCE(pr.work_in_chats, false) as work_in_chats,
      COALESCE(pr.chat_rating_1, false) as chat_rating_1,
      COALESCE(pr.chat_rating_2, false) as chat_rating_2,
      COALESCE(pr.chat_rating_3, false) as chat_rating_3,
      COALESCE(pr.chat_rating_4, false) as chat_rating_4
     FROM products p
     JOIN product_rules pr ON pr.product_id = p.id
     WHERE p.store_id = $1
       AND pr.work_in_chats = TRUE
       AND p.marketplace = 'wb'
     ORDER BY p.name ASC`,
    [storeId]
  );

  return result.rows.map(row => {
    const starsAllowed: number[] = [];
    if (row.chat_rating_1) starsAllowed.push(1);
    if (row.chat_rating_2) starsAllowed.push(2);
    if (row.chat_rating_3) starsAllowed.push(3);
    if (row.chat_rating_4) starsAllowed.push(4);

    return {
      nmId: row.wb_product_id,
      productTitle: row.name,
      isActive: row.work_status === 'active',
      chatEnabled: true,
      starsAllowed,
      requiredComplaintStatus: 'rejected' as const,
    };
  });
}

/**
 * Try to extract WB chat ID from a chat URL.
 * Pattern: https://seller.wildberries.ru/feedback-and-questions/chats/{chatId}
 */
export function extractChatIdFromUrl(chatUrl: string): string | null {
  const match = chatUrl.match(/\/chats\/([^/?#]+)/);
  return match?.[1] || null;
}

/**
 * Reconcile a single chat: find pending review_chat_link and set chat_id.
 * Called during dialogue sync for each synced chat.
 */
export async function reconcileChatWithLink(
  chatId: string,
  storeId: string
): Promise<boolean> {
  // Try to find a pending link that matches this chat by extracting URL pattern
  const result = await query(
    `UPDATE review_chat_links
     SET chat_id = $1, updated_at = NOW()
     WHERE store_id = $2
       AND chat_id IS NULL
       AND chat_url LIKE '%/' || $1
     RETURNING id`,
    [chatId, storeId]
  );

  return result.rows.length > 0;
}
