/**
 * TMA Chat Contracts
 *
 * GET    /api/telegram/chats/[chatId]
 * POST   /api/telegram/chats/[chatId]/send
 * POST   /api/telegram/chats/[chatId]/generate-ai
 */

import type { ChatStatus, ChatTag } from '@/db/helpers';

// --- Chat Detail (GET) ---

export interface ChatMessageDTO {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  isAutoReply: boolean;
}

export interface ChatDetailDTO {
  id: string;
  storeId: string;
  storeName: string;
  marketplace: string;
  clientName: string;
  productName: string | null;
  productNmId: string | null;
  status: ChatStatus;
  tag: ChatTag | null;
  draftReply: string | null;
  draftReplyGeneratedAt: string | null;
  completionReason: string | null;
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
  chatUrl: string | null;
}

export interface ChatDetailResponse {
  chat: ChatDetailDTO;
  messages: ChatMessageDTO[];
}

// --- Send Message (POST) ---

export interface SendMessageRequest {
  message: string;
}

export interface SendMessageResponse {
  success: boolean;
}

// --- Generate AI Reply (POST) ---

export interface GenerateAiResponse {
  success: boolean;
  draftReply: string;
}
