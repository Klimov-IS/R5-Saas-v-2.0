/**
 * Shared utility for sending auto-sequence messages.
 * Used by both the TG sequence start API (immediate first message)
 * and the cron processor (subsequent messages).
 */
import * as dbHelpers from '@/db/helpers';
import { getDaysUntilNextMessage, type SequenceMessage } from '@/lib/auto-sequence-templates';

interface SendSequenceMessageParams {
  sequenceId: string;
  chatId: string;
  storeId: string;
  ownerId: string;
  currentStep: number;
  templates: SequenceMessage[];
}

/**
 * Send a single auto-sequence message and advance the sequence.
 *
 * Handles:
 * - Marketplace-aware dispatch (WB / OZON)
 * - Recording sent message in chat_messages
 * - Updating chat's last_message_* fields
 * - Advancing the sequence to the next step
 *
 * Does NOT check stop conditions — caller's responsibility.
 */
export async function sendSequenceMessage(
  params: SendSequenceMessageParams
): Promise<{ sent: boolean; error?: string }> {
  const { sequenceId, chatId, storeId, ownerId, currentStep, templates } = params;

  const template = templates[currentStep];
  if (!template) {
    return { sent: false, error: 'No template at current step' };
  }

  const store = await dbHelpers.getStoreById(storeId);
  if (!store) {
    return { sent: false, error: 'Store not found' };
  }

  // Send message via marketplace-aware dispatch
  if (store.marketplace === 'ozon' && store.ozon_client_id && store.ozon_api_key) {
    const { createOzonClient } = await import('@/lib/ozon-api');
    const ozonClient = createOzonClient(store.ozon_client_id, store.ozon_api_key);
    await ozonClient.sendChatMessage(chatId, template.text);
  } else {
    const { sendChatMessage } = await import('@/lib/wb-chat-api');
    await sendChatMessage(storeId, chatId, template.text);
  }

  // Record sent message in chat_messages
  const msgId = `auto_${sequenceId}_${currentStep}`;
  await dbHelpers.createChatMessage({
    id: msgId,
    chat_id: chatId,
    store_id: storeId,
    owner_id: ownerId,
    sender: 'seller',
    text: template.text,
    timestamp: new Date().toISOString(),
    is_auto_reply: true,
  });

  // Update chat's last message info
  await dbHelpers.updateChat(chatId, {
    last_message_text: template.text,
    last_message_sender: 'seller',
    last_message_date: new Date().toISOString(),
  });

  // Advance sequence — compute days until next message based on template schedule
  const daysAhead = getDaysUntilNextMessage(templates, currentStep + 1);
  await dbHelpers.advanceSequence(sequenceId, daysAhead || 1);

  return { sent: true };
}
