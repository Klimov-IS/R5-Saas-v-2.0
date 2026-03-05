/**
 * Shared marketplace message dispatch.
 *
 * Single source of truth for sending messages to WB and OZON.
 * Used by:
 *   - ChatService.sendMessage (manual replies from TMA/Web)
 *   - auto-sequence-sender (cron + immediate first message)
 */
import { createOzonClient } from '@/lib/ozon-api';

export interface StoreForSend {
  id: string;
  marketplace: string;
  // WB
  chat_api_token?: string | null;
  api_token?: string | null;
  // OZON
  ozon_client_id?: string | null;
  ozon_api_key?: string | null;
}

export interface SendResult {
  sent: boolean;
  error?: 'permanent' | 'transient' | 'credentials';
  errorMessage?: string;
}

/**
 * Error patterns that indicate the message can never be delivered.
 * On permanent error, caller should stop retrying (e.g. stop sequence).
 */
const PERMANENT_ERROR_PATTERNS = [
  'does not have a replySign',
  'Chat not found',
  'Store not found',
  '"code":7',
  'chat not started',
  'chat_not_started',
  'CHAT_IS_NOT_STARTED',
  'access period has expired',
  'PermissionDenied',
];

/**
 * Send a message to a buyer via the marketplace API.
 *
 * WB path (two modes):
 *   - With replySign: direct FormData POST (from TMA/Web routes that already have it)
 *   - Without replySign: delegates to wb-chat-api helper (fetches store+chat internally)
 *
 * OZON path: createOzonClient → sendChatMessage
 */
export async function sendMessageToMarketplace(params: {
  store: StoreForSend;
  chatId: string;
  message: string;
  replySign?: string | null;
}): Promise<SendResult> {
  const { store, chatId, message, replySign } = params;

  try {
    if (store.marketplace === 'ozon') {
      return await sendOzon(store, chatId, message);
    } else {
      return await sendWb(store, chatId, message, replySign);
    }
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    const isPermanent = PERMANENT_ERROR_PATTERNS.some(p => errorMsg.includes(p));
    return {
      sent: false,
      error: isPermanent ? 'permanent' : 'transient',
      errorMessage: errorMsg,
    };
  }
}

async function sendOzon(store: StoreForSend, chatId: string, message: string): Promise<SendResult> {
  if (!store.ozon_client_id || !store.ozon_api_key) {
    return { sent: false, error: 'credentials', errorMessage: 'OZON credentials not configured' };
  }

  const client = createOzonClient(store.ozon_client_id, store.ozon_api_key);
  await client.sendChatMessage(chatId, message);
  return { sent: true };
}

async function sendWb(
  store: StoreForSend,
  chatId: string,
  message: string,
  replySign?: string | null
): Promise<SendResult> {
  if (replySign) {
    // Direct send — caller already has replySign (e.g., TMA send route)
    const token = store.chat_api_token || store.api_token;
    if (!token) {
      return { sent: false, error: 'credentials', errorMessage: 'Chat API token not configured' };
    }

    const formData = new FormData();
    formData.append('replySign', replySign);
    formData.append('message', message);

    const response = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/message', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WB API error: ${response.status} ${errorText}`);
    }

    return { sent: true };
  } else {
    // Delegate to wb-chat-api helper — it fetches store + chat (replySign) internally.
    // Used by auto-sequence-sender where replySign is not pre-fetched.
    const { sendChatMessage } = await import('@/lib/wb-chat-api');
    await sendChatMessage(store.id, chatId, message);
    return { sent: true };
  }
}

/**
 * Classify a send error as permanent or transient.
 * Exported for callers that catch errors themselves.
 */
export function isPermamentSendError(errorMessage: string): boolean {
  return PERMANENT_ERROR_PATTERNS.some(p => errorMessage.includes(p));
}
