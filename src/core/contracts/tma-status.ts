/**
 * TMA Chat Status Contracts
 *
 * PATCH /api/telegram/chats/[chatId]/status
 */

import type { ChatStatus, ChatTag, CompletionReason } from '@/db/helpers';

export interface StatusChangeRequest {
  status: ChatStatus;
  completion_reason?: CompletionReason;
  tag?: ChatTag;
}

export interface StatusChangeResponse {
  success: boolean;
  tag?: ChatTag;
  sequenceStopped: boolean;
}
