/**
 * WB Chat API helpers
 * Wrapper functions for sending messages to Wildberries Chat API
 */

import { getStoreById, getChatById } from '@/db/helpers';

/**
 * Send a message to a chat via WB Chat API
 * @param storeId - Store ID
 * @param chatId - Chat ID
 * @param message - Message text to send
 * @returns Promise<void>
 * @throws Error if message sending fails
 */
export async function sendChatMessage(
  storeId: string,
  chatId: string,
  message: string
): Promise<void> {
  // Get store to retrieve API token
  const store = await getStoreById(storeId);
  if (!store) {
    throw new Error(`Store with ID ${storeId} not found`);
  }

  const wbToken = store.chat_api_token || store.api_token;
  if (!wbToken) {
    throw new Error(`Chat API token not configured for store ${storeId}`);
  }

  // Get chat to retrieve replySign
  const chat = await getChatById(chatId);
  if (!chat) {
    throw new Error(`Chat with ID ${chatId} not found`);
  }

  if (!chat.reply_sign) {
    throw new Error(`Chat ${chatId} does not have a replySign`);
  }

  // Send message via WB Chat API
  const formData = new FormData();
  formData.append('replySign', chat.reply_sign);
  formData.append('message', message);

  const response = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/message', {
    method: 'POST',
    headers: {
      'Authorization': wbToken,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: { message: `WB API error: ${response.status}` }
    }));
    const errorMessage = errorData.error?.message || errorData?.message || `WB API error: ${response.status}`;
    throw new Error(errorMessage);
  }

  // Message sent successfully
  console.log(`✅ [WB-CHAT-API] Message sent to chat ${chatId} successfully`);
}
