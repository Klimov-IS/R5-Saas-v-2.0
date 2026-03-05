/**
 * Core contracts barrel export
 *
 * Usage: import { ChatDetailDTO, QueueItemDTO, ... } from '@/core';
 */

// Auth
export type {
  VerifyRequest,
  VerifyResponse,
  LoginRequest,
  LoginResponse,
  TmaStoreItem,
} from './contracts/tma-auth';

// Queue
export type {
  QueueQueryParams,
  QueueItemDTO,
  QueueResponse,
  StatusCounts,
} from './contracts/tma-queue';

// Chat
export type {
  ChatDetailDTO,
  ChatDetailResponse,
  ChatMessageDTO,
  SendMessageRequest,
  SendMessageResponse,
  GenerateAiResponse,
} from './contracts/tma-chat';

// Status
export type {
  StatusChangeRequest,
  StatusChangeResponse,
} from './contracts/tma-status';

// Sequence
export type {
  SequenceInfoDTO,
  GetSequenceResponse,
  StartSequenceRequest,
  StartSequenceResponse,
  StopSequenceResponse,
} from './contracts/tma-sequence';
