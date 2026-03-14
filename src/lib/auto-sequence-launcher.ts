/**
 * Auto-sequence launcher: creates 30-day follow-up sequences
 * for review-linked chats when conditions are met.
 *
 * Triggered after reconcileChatWithLink() in dialogue sync Step 3.5.
 * Replaces the old trigger-phrase-based approach for WB chats.
 *
 * Conditions for auto-launch:
 * 1. buyer_messages_count == 0 (no client replies yet)
 * 2. No active/completed sequence in the same family
 * 3. Review rating <= 4 (skip 5★)
 * 4. product_rules.work_in_chats is not explicitly FALSE
 * 5. Review not "resolved" (complaint approved, excluded from rating, etc.)
 */

import * as dbHelpers from '@/db/helpers';
import { findLinkByChatId, isReviewResolvedForChat } from '@/db/review-chat-link-helpers';
import { query } from '@/db/client';
import {
  DEFAULT_FOLLOWUP_TEMPLATES_30D,
  DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D,
  getNextSlotTime,
} from '@/lib/auto-sequence-templates';
import type { ChatStatus, ChatTag } from '@/db/helpers';

/**
 * Attempt to auto-start a 30-day sequence for a review-linked chat.
 * Returns true if a sequence was created, false if conditions were not met.
 *
 * @param chatId - chat ID in "1:uuid" format (from chats table)
 * @param storeId - store ID
 */
export async function maybeStartAutoSequence(
  chatId: string,
  storeId: string
): Promise<boolean> {
  try {
    // Guard: skip if store is inactive
    const store = await dbHelpers.getStoreById(storeId);
    if (!store || !store.is_active) {
      return false;
    }

    // 1. Get review_chat_link to determine rating
    const rcl = await findLinkByChatId(chatId);
    if (!rcl) {
      // No review link — not eligible for auto-launch
      return false;
    }

    const rating = rcl.review_rating;

    // 2. Guard: skip 5★ reviews
    if (rating >= 5) {
      return false;
    }

    // 3. Check if review is resolved (complaint approved / excluded from rating)
    const { resolved, reason } = await isReviewResolvedForChat(chatId);
    if (resolved) {
      console.log(`[AUTO-SEQ] Chat ${chatId}: review resolved (${reason}), skipping`);
      return false;
    }

    // 4. Check buyer messages count
    const msgResult = await query(
      `SELECT COUNT(*) as cnt FROM chat_messages WHERE chat_id = $1 AND sender = 'client'`,
      [chatId]
    );
    const buyerMsgCount = parseInt(msgResult.rows[0]?.cnt || '0', 10);
    if (buyerMsgCount > 0) {
      // Buyer already replied — don't auto-start (manual start only)
      return false;
    }

    // 5. Deduplication: check for existing active/completed sequence in family
    const familyPrefix = rating <= 3 ? 'no_reply_followup' : 'no_reply_followup_4star';
    const hasExisting = await dbHelpers.hasCompletedSequenceFamily(chatId, familyPrefix);
    if (hasExisting) {
      return false;
    }

    // 6. Check product_rules.work_in_chats (optional)
    const chat = await dbHelpers.getChatById(chatId);
    if (!chat) return false;

    if (chat.product_nm_id) {
      const rules = await dbHelpers.getProductRulesByNmId(storeId, chat.product_nm_id);
      if (rules && !rules.work_in_chats) {
        // Product explicitly disabled for chat work
        console.log(`[AUTO-SEQ] Chat ${chatId}: product rules disabled work_in_chats, skipping`);
        return false;
      }
    }

    // 7. Determine sequence type and templates
    const is4Star = rating === 4;
    const sequenceType = is4Star ? 'no_reply_followup_4star_30d' : 'no_reply_followup_30d';
    const templates = is4Star ? DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D : DEFAULT_FOLLOWUP_TEMPLATES_30D;

    // 8. Create sequence with Day 0 = today (nearest business slot)
    const nextSendAt = getNextSlotTime(0);
    const seq = await query(
      `INSERT INTO chat_auto_sequences
        (chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [chatId, storeId, chat.owner_id, sequenceType, JSON.stringify(templates), templates.length, nextSendAt]
    );

    if (!seq.rows[0]) {
      console.error(`[AUTO-SEQ] Failed to create sequence for chat ${chatId}`);
      return false;
    }

    // 9. Update chat: tag=deletion_candidate, status=awaiting_reply
    await dbHelpers.updateChat(chatId, {
      tag: 'deletion_candidate' as ChatTag,
      status: 'awaiting_reply' as ChatStatus,
      status_updated_at: new Date().toISOString(),
    });

    console.log(
      `[AUTO-SEQ] Chat ${chatId}: auto-sequence created [${sequenceType}] ` +
      `(${templates.length} msgs, rating=${rating}★, next_send=${nextSendAt})`
    );

    return true;
  } catch (error: any) {
    console.error(`[AUTO-SEQ] Error for chat ${chatId}:`, error.message);
    return false;
  }
}
