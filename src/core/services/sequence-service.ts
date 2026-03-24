/**
 * SequenceService — domain service for auto-sequence operations.
 *
 * Methods:
 *   - getSequenceInfo: get active or latest sequence for a chat (PR-08)
 *   - stopSequence: manually stop active sequence (PR-08)
 *   - startSequence: start new or resume sequence (PR-09)
 */
import * as dbHelpers from '@/db/helpers';
import type { ChatTag, ChatStatus } from '@/db/helpers';
import type { GetSequenceResponse, StopSequenceResponse, StartSequenceResponse, SequenceInfoDTO } from '@/core/contracts/tma-sequence';
import { ChatNotFoundError } from '@/core/services/chat-service';
import * as chatRepo from '@/db/repositories/chat-repository';
import * as seqRepo from '@/db/repositories/sequence-repository';
import { transaction, query } from '@/db/client';
import { findLinkByChatId, isReviewResolvedForChat } from '@/db/review-chat-link-helpers';
import {
  DEFAULT_FOLLOWUP_TEMPLATES_30D,
  DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D,
  TAG_SEQUENCE_CONFIG,
  getNextSlotTime,
} from '@/lib/auto-sequence-templates';
import { sendSequenceMessage } from '@/lib/auto-sequence-sender';

/**
 * Check if a SELLER message exists in chat_messages for today (MSK).
 * Uses the same MSK midnight calculation as the cron processor (cron-jobs.ts:719-729).
 *
 * Important: checks actual chat_messages (sender='seller'), NOT chat.last_message_date.
 * This avoids false positives from WB system messages ("Чат по товару...") which
 * update chat.last_message_date but are not real seller messages.
 */
async function hasSellerMessageTodayMSK(chatId: string): Promise<boolean> {
  const todayStart = new Date();
  // MSK midnight (00:00 MSK) = 21:00 UTC previous day
  if (todayStart.getUTCHours() >= 21) {
    todayStart.setUTCHours(21, 0, 0, 0);
  } else {
    todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    todayStart.setUTCHours(21, 0, 0, 0);
  }
  const result = await query(
    `SELECT 1 FROM chat_messages
     WHERE chat_id = $1 AND sender = 'seller' AND timestamp >= $2
     LIMIT 1`,
    [chatId, todayStart.toISOString()]
  );
  return result.rows.length > 0;
}

/**
 * Verify chat exists and is accessible, then return the chat row.
 * Extended fields returned for startSequence needs.
 */
async function verifyChatAccess(chatId: string, accessibleStoreIds: string[]): Promise<any> {
  const chat = await chatRepo.findChatForSequence(chatId, accessibleStoreIds);
  if (!chat) {
    throw new ChatNotFoundError(chatId);
  }
  return chat;
}

/**
 * Map a DB sequence row to SequenceInfoDTO.
 */
function toSequenceDTO(seq: any): SequenceInfoDTO {
  return {
    id: seq.id,
    sequenceType: seq.sequence_type,
    status: seq.status,
    currentStep: seq.current_step,
    maxSteps: seq.max_steps,
    stopReason: seq.stop_reason,
    nextSendAt: seq.next_send_at,
    lastSentAt: seq.last_sent_at,
    startedAt: seq.started_at,
    createdAt: seq.created_at,
  };
}

/**
 * Get auto-sequence status for a chat.
 * Returns active sequence if exists, or latest completed/stopped.
 *
 * @throws ChatNotFoundError if chat not accessible
 */
export async function getSequenceInfo(
  chatId: string,
  accessibleStoreIds: string[]
): Promise<GetSequenceResponse> {
  await verifyChatAccess(chatId, accessibleStoreIds);

  const active = await dbHelpers.getActiveSequenceForChat(chatId);
  const sequence = active || await dbHelpers.getLatestSequenceForChat(chatId);

  if (!sequence) {
    return { sequence: null };
  }

  return { sequence: toSequenceDTO(sequence) };
}

/**
 * Manually stop an active auto-sequence for a chat.
 *
 * @throws ChatNotFoundError if chat not accessible
 * @throws SequenceNotFoundError if no active sequence
 */
export async function stopSequence(
  chatId: string,
  accessibleStoreIds: string[]
): Promise<StopSequenceResponse> {
  await verifyChatAccess(chatId, accessibleStoreIds);

  const active = await dbHelpers.getActiveSequenceForChat(chatId);
  if (!active) {
    throw new SequenceNotFoundError(chatId);
  }

  await dbHelpers.stopSequence(active.id, 'manual');
  console.log(`[SEQUENCE] Manual stop: chat ${chatId}, sequence ${active.id}`);

  return { success: true, sequenceId: active.id };
}

/**
 * Start a new auto-sequence or resume a paused one.
 *
 * Supports two modes:
 *   1. Default (no requestedType) — 30-day base sequence (by rating: 4★ vs 1-3★)
 *   2. Tag-based (requestedType) — short funnel follow-up
 *
 * Performs:
 * - Access check
 * - Active sequence conflict check (409)
 * - Review resolved check (400)
 * - Resumable sequence detection (paused by manual_reply)
 * - Family dedup check (409)
 * - Create sequence + immediate first message send
 * - Update chat status → awaiting_reply
 *
 * @throws ChatNotFoundError if chat not accessible
 * @throws SequenceConflictError if active sequence or completed family exists
 * @throws SequenceReviewResolvedError if review is resolved
 */
export async function startSequence(
  chatId: string,
  accessibleStoreIds: string[],
  requestedType?: string,
  changedByUserId?: string
): Promise<StartSequenceResponse> {
  const chat = await verifyChatAccess(chatId, accessibleStoreIds);

  // Fast-path: check for existing active sequence (app-level, no transaction)
  const existing = await dbHelpers.getActiveSequenceForChat(chatId);
  if (existing) {
    throw new SequenceConflictError(chatId, existing.id, 'active');
  }

  // Check if review is resolved
  const { resolved, reason: resolvedReason } = await isReviewResolvedForChat(chatId);
  if (resolved) {
    throw new SequenceReviewResolvedError(chatId, resolvedReason || 'unknown');
  }

  let sequenceType: string;
  let templates;
  let familyPrefix: string;
  let chatTag: ChatTag;

  if (requestedType && TAG_SEQUENCE_CONFIG[requestedType]) {
    const config = TAG_SEQUENCE_CONFIG[requestedType];
    sequenceType = config.sequenceType;
    templates = config.templates;
    familyPrefix = config.familyPrefix;
    chatTag = requestedType as ChatTag;
  } else if (requestedType && Object.values(TAG_SEQUENCE_CONFIG).some(c => c.sequenceType === requestedType)) {
    const config = Object.values(TAG_SEQUENCE_CONFIG).find(c => c.sequenceType === requestedType)!;
    const tagName = Object.entries(TAG_SEQUENCE_CONFIG).find(([, c]) => c.sequenceType === requestedType)?.[0];
    sequenceType = config.sequenceType;
    templates = config.templates;
    familyPrefix = config.familyPrefix;
    chatTag = (tagName || chat.tag) as ChatTag;
  } else {
    const rcl = await findLinkByChatId(chatId);
    const rating = rcl?.review_rating;

    if (rating === 4) {
      sequenceType = 'no_reply_followup_4star_30d';
      templates = DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D;
      familyPrefix = 'no_reply_followup_4star';
    } else {
      sequenceType = 'no_reply_followup_30d';
      templates = DEFAULT_FOLLOWUP_TEMPLATES_30D;
      familyPrefix = 'no_reply_followup';
    }
    chatTag = 'deletion_candidate' as ChatTag;
  }

  // Check if there's a paused sequence to resume
  const resumable = await dbHelpers.findResumableSequence(chatId, familyPrefix);
  if (resumable) {
    const resumeNextSendAt = getNextSlotTime(resumable.current_step);
    await dbHelpers.resumeSequence(resumable.id, resumeNextSendAt);
    await dbHelpers.updateChatWithAudit(
      chatId,
      {
        status: 'awaiting_reply' as ChatStatus,
        status_updated_at: new Date().toISOString(),
      },
      { changedBy: changedByUserId || null, source: 'tg_app' }
    );
    console.log(
      `[SEQUENCE] Resumed: chat ${chatId}, type=${resumable.sequence_type}, ` +
      `step ${resumable.current_step}/${resumable.max_steps}`
    );
    return {
      success: true,
      resumed: true,
      sequence: {
        id: resumable.id,
        sequenceType: resumable.sequence_type,
        currentStep: resumable.current_step,
        maxSteps: resumable.max_steps,
      },
    };
  }

  // Check family dedup
  const hasFamily = await dbHelpers.hasCompletedSequenceFamily(chatId, familyPrefix);
  if (hasFamily) {
    throw new SequenceConflictError(chatId, '', 'family');
  }

  // Check if a SELLER message was already sent today (MSK) — defer first message to tomorrow.
  // Uses chat_messages (not chat.last_message_date) to avoid false positives from WB system messages.
  const sellerSentToday = await hasSellerMessageTodayMSK(chatId);

  // Create sequence inside transaction (TOCTOU-safe).
  // Belt: transaction re-checks for active sequence before INSERT.
  // Suspenders: UNIQUE partial index (migration 030) catches any remaining race.
  const nextSendAt = getNextSlotTime(sellerSentToday ? 1 : 0);
  let seq;
  try {
    seq = await transaction(async (client) => {
      // Re-check for active sequence inside transaction
      const activeCheck = await client.query(
        `SELECT id FROM chat_auto_sequences WHERE chat_id = $1 AND status = 'active' LIMIT 1`,
        [chatId]
      );
      if (activeCheck.rows.length > 0) {
        throw new SequenceConflictError(chatId, activeCheck.rows[0].id, 'active');
      }

      return await seqRepo.createSequence({
        chatId,
        storeId: chat.store_id,
        ownerId: chat.owner_id,
        sequenceType,
        templates,
        nextSendAt,
      }, client);
    });
  } catch (error: any) {
    if (error instanceof SequenceConflictError) throw error;
    // UNIQUE partial index violation fallback (migration 030)
    if (error.code === '23505' && error.constraint === 'idx_sequences_one_active_per_chat') {
      throw new SequenceConflictError(chatId, '', 'active');
    }
    throw error;
  }

  if (!seq) {
    throw new Error('Failed to create sequence');
  }

  const sequenceId = seq.id;

  // Attempt to send the first message immediately (skip if deferred to tomorrow)
  let immediateSent = false;
  if (sellerSentToday) {
    console.log(
      `[SEQUENCE] Deferred start: chat ${chatId}, seller message sent today (MSK), ` +
      `first sequence message scheduled for tomorrow`
    );
  } else {
    try {
      const result = await sendSequenceMessage({
        sequenceId,
        chatId,
        storeId: chat.store_id,
        ownerId: chat.owner_id,
        currentStep: 0,
        templates,
      });
      immediateSent = result.sent;
    } catch (sendErr: any) {
      console.warn(
        `[SEQUENCE] Immediate send failed for chat ${chatId}, cron will pick up: ${sendErr.message}`
      );
    }
  }

  // Active sequence = always awaiting_reply
  await dbHelpers.updateChatWithAudit(
    chatId,
    {
      status: 'awaiting_reply' as ChatStatus,
      status_updated_at: new Date().toISOString(),
    },
    { changedBy: changedByUserId || null, source: 'tg_app' }
  );

  console.log(
    `[SEQUENCE] Manual start: chat ${chatId}, type=${sequenceType}, ` +
    `${templates.length} msgs, tag=${chatTag}, immediateSent=${immediateSent}, deferred=${sellerSentToday}`
  );

  return {
    success: true,
    immediateSent,
    deferred: sellerSentToday,
    sequence: {
      id: sequenceId,
      sequenceType,
      currentStep: immediateSent ? 1 : 0,
      maxSteps: templates.length,
      nextSendAt: immediateSent ? undefined : nextSendAt,
    },
  };
}

/**
 * No active sequence found for this chat.
 */
export class SequenceNotFoundError extends Error {
  constructor(chatId: string) {
    super(`No active sequence found for chat: ${chatId}`);
    this.name = 'SequenceNotFoundError';
  }
}

/**
 * Active or family sequence already exists.
 */
export class SequenceConflictError extends Error {
  public readonly existingId: string;
  public readonly conflictType: 'active' | 'family';
  constructor(chatId: string, existingId: string, conflictType: 'active' | 'family') {
    super(
      conflictType === 'active'
        ? `Active sequence already exists for chat: ${chatId}`
        : `Sequence of this type already exists (active or completed) for chat: ${chatId}`
    );
    this.name = 'SequenceConflictError';
    this.existingId = existingId;
    this.conflictType = conflictType;
  }
}

/**
 * Review is resolved — cannot start sequence.
 */
export class SequenceReviewResolvedError extends Error {
  public readonly reason: string;
  constructor(chatId: string, reason: string) {
    super(`Review is resolved (${reason}), cannot start sequence for chat: ${chatId}`);
    this.name = 'SequenceReviewResolvedError';
    this.reason = reason;
  }
}
