/**
 * QueueService — domain service for TMA queue operations.
 *
 * Methods:
 *   - getQueue: cross-store chat queue with filters + status counts (PR-07)
 */
import { getUnifiedChatQueue, getUnifiedChatQueueCount, getUnifiedChatQueueCountsByStatus } from '@/db/telegram-helpers';
import type { QueueQueryParams, QueueItemDTO, QueueResponse } from '@/core/contracts/tma-queue';

/**
 * Get cross-store chat queue with status and store filtering.
 *
 * Performs:
 * - 3 parallel queries: items, totalCount, statusCounts
 * - Maps DB rows → QueueItemDTO[]
 *
 * @returns QueueResponse with data, totalCount, statusCounts
 */
export async function getQueue(
  accessibleStoreIds: string[],
  params: QueueQueryParams
): Promise<QueueResponse> {
  if (accessibleStoreIds.length === 0) {
    return { data: [], totalCount: 0, statusCounts: { inbox: 0, in_progress: 0, awaiting_reply: 0, closed: 0 } };
  }

  const { status, limit, offset, filterStoreIds, filterRatings } = params;

  const [chats, totalCount, statusCounts] = await Promise.all([
    getUnifiedChatQueue(accessibleStoreIds, limit, offset, status, filterStoreIds, filterRatings),
    getUnifiedChatQueueCount(accessibleStoreIds, status, filterStoreIds, filterRatings),
    getUnifiedChatQueueCountsByStatus(accessibleStoreIds, filterStoreIds, filterRatings),
  ]);

  const data: QueueItemDTO[] = chats.map((c: any) => ({
    id: c.id,
    storeId: c.store_id,
    storeName: c.store_name,
    marketplace: c.marketplace,
    clientName: c.client_name,
    productName: c.product_name,
    lastMessageText: c.last_message_text,
    lastMessageDate: c.last_message_date,
    lastMessageSender: c.last_message_sender,
    hasDraft: !!c.draft_reply,
    draftPreview: c.draft_reply ? c.draft_reply.substring(0, 100) : null,
    status: c.status,
    tag: c.tag,
    completionReason: c.completion_reason,
    reviewRating: c.review_rating,
    reviewDate: c.review_date,
    complaintStatus: c.complaint_status,
    reviewStatusWb: c.review_status_wb,
    productStatus: c.product_status,
    offerCompensation: c.offer_compensation,
    maxCompensation: c.max_compensation,
    compensationType: c.compensation_type,
    compensationBy: c.compensation_by,
    chatStrategy: c.chat_strategy,
    reviewText: c.review_text ?? null,
    seqCurrentStep: c.seq_current_step,
    seqMaxSteps: c.seq_max_steps,
    seqStatus: c.seq_status,
  }));

  return { data, totalCount, statusCounts };
}
