/**
 * ChatStatusService — domain service for chat status/tag changes.
 *
 * Methods:
 *   - changeStatus: validate + update status/tag + stop sequences (PR-10)
 */
import * as dbHelpers from '@/db/helpers';
import type { ChatStatus, ChatTag, CompletionReason } from '@/db/helpers';
import type { StatusChangeResponse } from '@/core/contracts/tma-status';
import { validateTransition } from '@/lib/chat-transitions';
import { ChatNotFoundError } from '@/core/services/chat-service';
import * as chatRepo from '@/db/repositories/chat-repository';

const VALID_STATUSES: ChatStatus[] = ['inbox', 'in_progress', 'awaiting_reply', 'closed'];
const VALID_REASONS: CompletionReason[] = [
  'review_deleted', 'review_upgraded', 'review_resolved', 'refusal',
  'no_reply', 'old_dialog', 'not_our_issue', 'spam', 'negative', 'other',
  'temporarily_hidden',
];
const MANUALLY_SETTABLE_TAGS: ChatTag[] = [
  'deletion_candidate', 'deletion_offered', 'deletion_agreed',
  'deletion_confirmed',
];

/**
 * Change chat status and/or tag.
 *
 * Performs:
 * - Input validation (status, completion_reason, tag)
 * - Access check
 * - Transition validation (warns on invalid, doesn't block)
 * - Update status + optional tag + completion_reason
 * - Stop active sequence on tag change or close
 *
 * @throws ChatNotFoundError if chat not accessible
 * @throws InvalidStatusError on validation failures
 */
export async function changeStatus(
  chatId: string,
  accessibleStoreIds: string[],
  status: string,
  completionReason?: string,
  tag?: string
): Promise<StatusChangeResponse> {
  // Validate status
  if (!status || !VALID_STATUSES.includes(status as ChatStatus)) {
    throw new InvalidStatusError('Invalid status');
  }

  // Require completion_reason for closed
  if (status === 'closed') {
    if (!completionReason || !VALID_REASONS.includes(completionReason as CompletionReason)) {
      throw new InvalidStatusError('completion_reason is required for closed status');
    }
  }

  // Validate tag if provided
  if (tag && !MANUALLY_SETTABLE_TAGS.includes(tag as ChatTag)) {
    throw new InvalidStatusError('Invalid tag');
  }

  // Access check
  const hasAccess = await chatRepo.verifyChatAccess(chatId, accessibleStoreIds);
  if (!hasAccess) {
    throw new ChatNotFoundError(chatId);
  }

  // Validate transition from current status
  const currentChat = await dbHelpers.getChatById(chatId);
  if (currentChat) {
    const transitionError = validateTransition(
      currentChat.status as ChatStatus,
      status as ChatStatus
    );
    if (transitionError) {
      console.warn(`[STATUS] ${transitionError} for chat ${chatId}`);
    }
  }

  // Build update data
  const updateData: Record<string, any> = {
    status,
    status_updated_at: new Date().toISOString(),
  };

  if (status === 'closed' && completionReason) {
    updateData.completion_reason = completionReason;
  }

  if (tag) {
    updateData.tag = tag;
    console.log(`[STATUS] Tag changed: chat ${chatId}, ${currentChat?.tag} → ${tag}`);
  }

  await dbHelpers.updateChat(chatId, updateData);

  // Stop active sequence when tag changes (family mismatch)
  let sequenceStopped = false;
  if (tag && tag !== currentChat?.tag) {
    try {
      const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
      if (activeSeq) {
        await dbHelpers.stopSequence(activeSeq.id, 'tag_changed');
        sequenceStopped = true;
        console.log(`[STATUS] Sequence stopped: chat ${chatId}, tag ${currentChat?.tag}→${tag} (was ${activeSeq.sequence_type})`);
      }
    } catch (seqErr: any) {
      console.error(`[STATUS] Failed to stop sequence on tag change:`, seqErr.message);
    }
  }

  // Stop active auto-sequence when closing or moving away from awaiting_reply
  if (!sequenceStopped && (status === 'closed' || (currentChat?.status === 'awaiting_reply' && status !== 'awaiting_reply'))) {
    try {
      const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
      if (activeSeq) {
        const reason = status === 'closed' ? 'manual_close' : 'manual';
        await dbHelpers.stopSequence(activeSeq.id, reason);
        sequenceStopped = true;
        console.log(`[STATUS] Auto-sequence stopped for chat ${chatId} (${reason})`);
      }
    } catch (seqError: any) {
      console.error(`[STATUS] Failed to stop auto-sequence for chat ${chatId}:`, seqError.message);
    }
  }

  return {
    success: true,
    tag: tag as ChatTag | undefined,
    sequenceStopped,
  };
}

/**
 * Validation error for status change inputs.
 */
export class InvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStatusError';
  }
}
