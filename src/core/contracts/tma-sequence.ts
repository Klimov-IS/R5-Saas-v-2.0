/**
 * TMA Sequence Contracts
 *
 * GET    /api/telegram/chats/[chatId]/sequence
 * POST   /api/telegram/chats/[chatId]/sequence/start
 * POST   /api/telegram/chats/[chatId]/sequence/stop
 */

// --- Get Sequence Status (GET) ---

export interface SequenceInfoDTO {
  id: string;
  sequenceType: string;
  status: 'active' | 'completed' | 'stopped';
  currentStep: number;
  maxSteps: number;
  stopReason: string | null;
  nextSendAt: string | null;
  lastSentAt: string | null;
  startedAt: string | null;
  createdAt: string;
}

export interface GetSequenceResponse {
  sequence: SequenceInfoDTO | null;
}

// --- Start Sequence (POST) ---

export interface StartSequenceRequest {
  sequenceType?: string;
}

export interface StartSequenceResponse {
  success: boolean;
  immediateSent?: boolean;
  deferred?: boolean;
  resumed?: boolean;
  sequence: {
    id: string;
    sequenceType: string;
    currentStep: number;
    maxSteps: number;
    nextSendAt?: string;
  };
}

// --- Stop Sequence (POST) ---

export interface StopSequenceResponse {
  success: boolean;
  sequenceId: string;
}
