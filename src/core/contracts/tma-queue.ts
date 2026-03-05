/**
 * TMA Queue Contracts
 *
 * GET /api/telegram/queue
 */

import type { ChatStatus, ChatTag, CompletionReason } from '@/db/helpers';

export interface QueueQueryParams {
  status: ChatStatus | 'all';
  limit: number;
  offset: number;
  filterStoreIds?: string[];
  filterRatings?: number[];
}

export interface QueueItemDTO {
  id: string;
  storeId: string;
  storeName: string;
  marketplace: string;
  clientName: string;
  productName: string | null;
  lastMessageText: string | null;
  lastMessageDate: string | null;
  lastMessageSender: string | null;
  hasDraft: boolean;
  draftPreview: string | null;
  status: ChatStatus;
  tag: ChatTag | null;
  completionReason: CompletionReason | null;
  // Review & product rules
  reviewRating: number | null;
  reviewDate: string | null;
  complaintStatus: string | null;
  reviewStatusWb: string | null;
  productStatus: string | null;
  offerCompensation: boolean | null;
  maxCompensation: string | null;
  compensationType: string | null;
  compensationBy: string | null;
  chatStrategy: string | null;
  reviewText: string | null;
  // Auto-sequence
  seqCurrentStep: number | null;
  seqMaxSteps: number | null;
  seqStatus: string | null;
}

export interface StatusCounts {
  inbox: number;
  in_progress: number;
  awaiting_reply: number;
  closed: number;
}

export interface QueueResponse {
  data: QueueItemDTO[];
  totalCount: number;
  statusCounts: StatusCounts;
}
